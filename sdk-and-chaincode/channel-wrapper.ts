import * as fs from 'fs';
import * as path from 'path';
import {Channel, ChannelRequest, JoinChannelRequest, Peer} from 'fabric-client';
import Client = require('fabric-client');
import {Helper} from './helper';

export class ChannelWrapper {
  private helper = new Helper();
  private readonly channelName = 'mychannel';
  private readonly responseStatuses = {
    BAD_REQUEST: 'BAD_REQUEST',
    SUCCESS: 'SUCCESS'
  };

  public constructor(private client: Client) {}

  public async createAndJoinChannel(): Promise<any> {
    await this.create();
    await this.join();
  }

  public get channel(): Channel {
    return this.client.getChannel(this.channelName);
  }

  public async create(): Promise<void> {
    const envelope_bytes = fs.readFileSync(path.join(__dirname, 'network/shared/channel-artifacts/channel.tx'));
    const config =  this.client.extractChannelConfig(envelope_bytes);
    const signatures = [this.client.signChannelConfig(config)];
    this.helper.debug('Signed channel configuration');

    const request: ChannelRequest = {
      config: config,
      signatures: signatures,
      name: this.channelName,
      orderer: this.channel.getOrderers()[0],
      txId: this.client.newTransactionID()
    };

    this.helper.debug('Sending create channel request to orderer');
    const response = await this.client.createChannel(request);

    this.helper.debug(`Create channel ${response.status}`);
    if (response.status === this.responseStatuses.BAD_REQUEST) {
      if (response.info && response.info.indexOf('readset expected key [Group]  /Channel/Application at version 0') > -1) {
        this.helper.debug('Channel already exists.');
      } else {
        throw new Error(response.info);
      }
    } else if (response.status === this.responseStatuses.SUCCESS) {
      await this.helper.sleep(5000);
    }
  }

  public async join(): Promise<void> {
    const channelGenesisBlock = await this.channel.getGenesisBlock({
      txId: this.client.newTransactionID()
    });

    const targets: Peer[] = this.client.getPeersForOrg(this.client.getMspid());
    this.helper.debug(`Joining channel with ${targets.length} peers of ${this.client.getMspid()}`);

    let proposal: JoinChannelRequest = {
      targets: targets, // This can also be omitted, it defaults to all peers of our own organization.
      block: channelGenesisBlock,
      txId: this.client.newTransactionID(true) // Admin action, so we need to pass 'true'
    };
    const responses: any[] = await this.channel.joinChannel(proposal);

    responses.forEach((r: Error | any) => {
      const errorMessage = r.message;

      if (errorMessage) {
        if (errorMessage.indexOf('Cannot create ledger from genesis block, due to LedgerID already exists') > -1) {
          this.helper.debug(`Peer has already joined this channel.`);
        } else if(errorMessage.indexOf('This identity is not an admin') > -1) {
          throw new Error(`Got 'this identity is not an admin'. Did you create a txId with admin: true?`);
        } else if(errorMessage.indexOf('Failed to deserialize creator identity') > -1) {
          throw new Error(`Join channel error (are you referring to the right peer?) - ${errorMessage}`);
        }
      }
    });
  }
}