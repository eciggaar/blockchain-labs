import Client = require('fabric-client');
import {ChaincodeType, Channel, ChaincodeInstallRequest, ChaincodeInvokeRequest, ProposalResponseObject,
  BroadcastResponse, ChaincodeInstantiateUpgradeRequest, ProposalResponse, ChaincodeInfo} from 'fabric-client';
import {Helper} from './helper';

export interface BasicChaincodeInfo {
  chaincodeId: string;
  chaincodeVersion: string;
  chaincodePath: string;
  chaincodeType: ChaincodeType;
}

export class ChaincodeWrapper {
  private helper = new Helper();
  private readonly MS_SLEEP_AFTER_INSTANTIATE = 10000;

  public constructor(private client: Client, private channel: Channel, private basicChaincodeInfo: BasicChaincodeInfo) {
  }

  /**
   * If the chaincode is not instantiated yet, install it and instantiate.
   * If the version is different than the one passed to the constructor of this function, upgrade.
   */
  public async initialize(): Promise<any> {
    const instantiatedChaincode = await this.getInstantiatedChaincode();

    this.helper.debug('Going to install chaincode...');
    await this.install();

    if (this.isTheInstantiatedVersionUpToDate(instantiatedChaincode)) {
      return;
    }

    if (typeof instantiatedChaincode !== 'undefined') {
      await this.upgrade();
    } else {
      await this.instantiate();
    }
  }

  public async install(): Promise<void> {
    const request: ChaincodeInstallRequest = {
      txId: this.client.newTransactionID(true),
      targets: (this.channel as any).getPeersForOrg(this.client.getMspid()),
      ...this.basicChaincodeInfo // Take the fields from basicChaincodeInfo and add them to the request.
    };

    const response = await this.client.installChaincode(request);
    this.getPayloadFromResponseAndLogAnyErrors('Install chaincode', response);
  }

  public async invoke(functionName: string, args: string[]): Promise<string> {
    const logPrefix = `Invoke: ${functionName} ${args}`;

    // Build the request. See https://fabric-sdk-node.github.io/global.html#ChaincodeInvokeRequest
    const request: ChaincodeInvokeRequest = {
      txId: this.client.newTransactionID(),
      chaincodeId: this.basicChaincodeInfo.chaincodeId,
      fcn: functionName,
      args: args
    };

    // Send the transaction proposal to the endorsers so they can simulate the invoke
    const response: ProposalResponseObject = await this.channel.sendTransactionProposal(request);
    let invokeResult: any;

    // We keep the payload (return value) of the simulation to return in the end
    invokeResult = this.getPayloadFromResponseAndLogAnyErrors(logPrefix, response);

    // Send the responses to the ordering service so it can carve a block and send the results to the committers.
    try {
      const broadcastResponse: BroadcastResponse = {status: 'NOT IMPLEMENTED', info: 'Lab assignment'};

      // TODO: send transaction to orderer

      this.helper.debug(`${logPrefix}. Broadcast ${broadcastResponse.status}`);

      return invokeResult;
    } catch (err) {
      this.helper.error(`Error Occurred. Reason: ${err.message}`);

      return 'ERROR';
    }
  }

  public async query(functionName: string, args: string[]): Promise<string> {
    // Build the request
    const request: ChaincodeInvokeRequest = {
      txId: this.client.newTransactionID(),
      chaincodeId: this.basicChaincodeInfo.chaincodeId,
      fcn: functionName,
      args: args
    };

    // Send the transaction proposal to the endorsers so they can execute the function
    const response: ProposalResponseObject = await this.channel.sendTransactionProposal(request);

    // Return the payload (return value) of the function execution. Note that we don't send anything to the orderer,
    // so there is no transaction added to the ledger.
    return this.getPayloadFromResponseAndLogAnyErrors(`Query: ${functionName} ${args}`, response);
  }

  public async instantiate(): Promise<any> {
    return this.instantiateOrUpgradeChaincode('instantiate');
  }

  public async upgrade(): Promise<any> {
    return this.instantiateOrUpgradeChaincode('upgrade');
  }

  private async instantiateOrUpgradeChaincode(instantiateOrUpgrade: 'instantiate' | 'upgrade'): Promise<any> {
    this.helper.debug(`Going to ${instantiateOrUpgrade} chaincode (this may take a minute)...`);

    const proposal: ChaincodeInstantiateUpgradeRequest | any = {
      txId: this.client.newTransactionID(true),
      ...this.basicChaincodeInfo // Take the fields from basicChaincodeInfo and add them to the request.
    };

    let response: ProposalResponseObject;

    if (instantiateOrUpgrade === 'instantiate') {
      response = await this.channel.sendInstantiateProposal(proposal);
    } else {
      response = await this.channel.sendUpgradeProposal(proposal);
    }

    this.getPayloadFromResponseAndLogAnyErrors(`Chaincode ${instantiateOrUpgrade}`, response);

    const broadcastResponse = await this.channel.sendTransaction({
      proposalResponses: response[0],
      proposal: response[1],
      txId: proposal.txId
    });

    this.helper.debug(`Chaincode ${instantiateOrUpgrade} broadcast ${broadcastResponse.status}`);

    await this.helper.sleep(this.MS_SLEEP_AFTER_INSTANTIATE);
  }

  /**
   * Function to parse the payload (return value) out of the proposal response. This is a naive approach that doesn't
   * handle errors and doesn't care if the responses are all the same.
   */
  private getPayloadFromResponseAndLogAnyErrors(logPrefix: string, proposalResponseObject: ProposalResponseObject): string {
    let payload = '';

    proposalResponseObject[0].forEach((response: ProposalResponse | Error, index: number) => {
      const errorMessage = (response as Error).message;

      if (errorMessage) {
        if (errorMessage.indexOf(' exists)') > -1) {
          this.helper.debug('Chaincode exists.');

          return;
        }

        this.helper.warn(`[${index}] ${logPrefix}. Error: ${errorMessage}`);

        if (errorMessage.indexOf('cannot retrieve package for chaincode') > -1) {
          this.helper.warn('====> This means the chaincode is not installed yet on the peer. Maybe you should run the app as the other organization?');
        }

        if (errorMessage.indexOf('Failed to deserialize creator identity,') > -1) {
          this.helper.warn('====> This means the peer has not joined the channel yet. Maybe you should run the app as the other organization?');
        }

        if (errorMessage.indexOf('cannot get package for the chaincode to be upgraded') > -1) {
          this.helper.warn('====> This means the chaincode is not installed yet on the peer. Maybe you should run the app as the other organization?');
        }

        if (errorMessage.indexOf('chaincode fingerprint mismatch data mismatch') > -1) {
          this.helper.warn('====> You\'re trying to install a different chaincode with the same name and version. Did you make changes to the code before changing your organization? Fix by bumping the version up one number.');
        }
      } else {
        this.helper.debug(`[${index}] ${logPrefix}. ${(response as ProposalResponse).response.status}`);
        payload = (response as ProposalResponse).response.payload.toString('utf8');
      }
    });

    return payload;
  }

  /**
   * Does a 'queryInstantiatedChaincodes' request for the first peer of our organization and filters out the one we have
   * in our basicChaincodeInfo object.
   */
  private async getInstantiatedChaincode(): Promise<ChaincodeInfo | undefined> {
    const instantiatedChaincodesResponse = await this.channel.queryInstantiatedChaincodes(
      this.client.getPeersForOrg('')[1], true);

    return instantiatedChaincodesResponse.chaincodes
      .find((cc: ChaincodeInfo) => cc.name === this.basicChaincodeInfo.chaincodeId);
  }

  private isTheInstantiatedVersionUpToDate(instantiatedChaincode: ChaincodeInfo | undefined): boolean {
    const itsUpToDate = !!instantiatedChaincode && instantiatedChaincode.version === this.basicChaincodeInfo.chaincodeVersion;
    if (itsUpToDate) {
      this.helper.debug('Chaincode is up to date.');
    }

    return itsUpToDate;
  }
}
