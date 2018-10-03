import Client = require('fabric-client');
import {BasicChaincodeInfo, ChaincodeWrapper} from './chaincode-wrapper';
import {ChannelWrapper} from './channel-wrapper';
import {Helper} from './helper';
import * as path from 'path';

/**
 * In this line, the organisation that starts the blockchain is set
 * change org2 to org1 and run the start script again to start the blockchain as the other organisation.
 * */
const CONFIG_PATH = 'network/connectionprofile.localhost.org1.yaml';

class App {
  private helper = new Helper();

  /**
   * The main function of our application. It runs when we start the app with 'node index.js'.
   * */
  public async start(): Promise<any> {
    const client = await this.initializeClient();

    // Create and join channel, make a local representation for the sdk
    const channelWrapper = new ChannelWrapper(client);
    await channelWrapper.createAndJoinChannel();

    // Update the version number to deploy
    const mychaincode: BasicChaincodeInfo = {
      chaincodeVersion: '1',
      chaincodeId: 'mychaincode',
      chaincodePath: path.join(__dirname, 'chaincode', 'javascript'),
      chaincodeType: 'node'
    };

    // Install and instantiate chaincode
    const chaincode = new ChaincodeWrapper(client, channelWrapper.channel, mychaincode);
    await chaincode.initialize();

    // We can access the invoke and query functions via the Chaincode wrapper.
    // make sure to await the result, since it's an asynchronous function.

    // Lab 1 step 2. Initialize the marble here


    // We wait for the invoke to be completed. Normally you'd use events for this,
    // but we'll save that for some other time.
    await this.helper.sleep(8000);

    // Lab 1 step 1. Get marbles by range

    // Lab 2

  }

  /**
   * This prepares the fabric-client sdk by loading the configuration, initializing the credential stores and
   * Setting the user context to an admin user.
   */
  private async initializeClient(): Promise<Client> {
    const client = Client.loadFromConfig(CONFIG_PATH);
    await client.initCredentialStores();

    // https://fabric-sdk-node.github.io/global.html#UserNamePasswordObject
    await client.setUserContext({username: 'admin', password: 'adminpw'});

    return client;
  }
}

new App().start().catch((err: Error) => {
  console.error('Uncaught error:', err);
});