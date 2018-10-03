/*
 # Copyright IBM Corp. All Rights Reserved.
 #
 # SPDX-License-Identifier: Apache-2.0
 */

'use strict';
import {Marble} from './models/marble.interface';
import {QueryString} from './models/queryString.interface';
import {JsonResponse} from './models/jsonResponse.interface';

const shim = require('fabric-shim');
const util = require('util');

class Chaincode {
  async Init(stub: any): Promise<any> {
    let ret = stub.getFunctionAndParameters();
    console.info(ret);
    console.info('=========== Instantiated Marbles Chaincode ===========');
    console.info('=========== Running Chaincode in TypeScript ===========');

    return shim.success();
  }

  async Invoke(stub: any): Promise<any> {
    console.info('Transaction ID: ' + stub.getTxID());
    console.info(util.format('Args: %j', stub.getArgs()));

    let ret = stub.getFunctionAndParameters();
    console.info(ret);

    let payload: any;
    try {
      switch (ret.fcn) {
        case 'initMarble':
          payload = await this.initMarble(stub, ret.params);
          break;
        case 'readMarble':
          payload = await this.readMarble(stub, ret.params);
          break;
        case 'delete':
          payload = await this.delete(stub, ret.params);
          break;
        case 'transferMarble':
          payload = await this.transferMarble(stub, ret.params);
          break;
        case 'paintMarble':
          throw new Error('Uncomment the code around line 48 in marbles_chaincode.ts');
          // payload = await this.paintMarble(stub, ret.params);
          // break;
        case 'getMarblesByRange':
          payload = await this.getMarblesByRange(stub, ret.params);
          break;
        case 'transferMarblesBasedOnColor':
          payload = await this.transferMarblesBasedOnColor(stub, ret.params);
          break;
        case 'queryMarblesByOwner':
          payload = await this.queryMarblesByOwner(stub, ret.params);
          break;
        case 'queryMarblesByColor':
          throw new Error('Uncomment the code around line 60 in marbles_chaincode.ts');
          // payload = await this.queryMarblesByColor(stub, ret.params);
          // break;
        case 'queryMarbles':
          payload = await this.queryMarbles(stub, ret.params);
          break;
        case 'getAllResults':
          payload = await this.getAllResults(stub, ret.params);
          break;
        case 'getQueryResultForQueryString':
          payload = await this.getQueryResultForQueryString(stub, ret.params);
          break;
        default: {
          console.log('no function of name:' + ret.fcn + ' found');
          return shim.error('Received unknown function ' + ret.fcn + ' invocation');
        }
      }

      console.log(payload.toString());
      return shim.success(payload);
    } catch (err) {
      console.log(err);
      return shim.error(err);
    }
  }

  // ===============================================
  // initMarble - Create a new Marble
  // ===============================================
  private async initMarble(stub: any, args: string[]): Promise<Buffer> {
    if (args.length !== 4) {
      throw new Error('Incorrect number of arguments. Expecting 4');
    }

    // ==== Input sanitation ====
    console.info('--- start init marble ---');

    args.forEach((arg: string, index: number) => {
      if (arg.length <= 0) {
        throw new Error('argument ' + index + ' is not a non-empty string');
      }
    });

    let marble: Marble = {
      name: args[0],
      color: args[1].toLowerCase(),
      size: parseInt(args[2]),
      owner: args[3].toLowerCase(),
    };

    if (typeof marble.size !== 'number') {
      throw new Error('3rd argument must be a numeric string');
    }

    // ==== Check if marble already exists ====
    let marbleState = await stub.getState(marble.name);
    if (marbleState.toString()) {
      throw new Error('Marble "' + marble.name + '" already exists');
    }

    // === Put marble as a JSON string in a buffer and save the marble to state ===
    await stub.putState(marble.name, Buffer.from(JSON.stringify(marble)));

    // Add the name and color of the new marble to the index 'color~name' index
    let indexName: string = 'color~name';
    let colorNameIndexKey = await stub.createCompositeKey(indexName, [marble.color, marble.name]);
    console.info(colorNameIndexKey);

    //  Note - Passing a 'nil' value will effectively delete the key from state, therefore we pass null character as value
    await stub.putState(colorNameIndexKey, Buffer.from('\u0000'));

    // ==== Marble saved and indexed. Return success ====
    console.info('- end init marble');

    return Buffer.from(JSON.stringify(marble));
  }

  // ===============================================
  // readMarble - Read a marble from Chaincode state
  // ===============================================
  private async readMarble(stub: any, args: string[]): Promise<Buffer> {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting name of the marble to query');
    }

    let marbleName: string = args[0];
    if (!marbleName) {
      throw new Error(' marble name must not be empty');
    }

    let marbleAsbytes: Buffer = await stub.getState(marbleName); //get the marble from Chaincode state
    if (!marbleAsbytes.toString()) {
      throw new Error('Marble does not exist: ' + marbleName);
    }

    return marbleAsbytes;
  }

  // ==================================================
  // delete - Remove a marble key/value pair from state
  // ==================================================
  private async delete(stub: any, args: string[]): Promise<void> {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting name of the marble to delete.');
    }

    let marbleName: string = args[0];
    if (!marbleName) {
      throw new Error('Marble name must not be empty.');
    }

    // To maintain the color~name index, we need to read the marble first and get its color
    let valAsbytes: number = await stub.getState(marbleName); //get the marble from Chaincode state
    if (!valAsbytes) {
      throw new Error('Marble "' + marbleName + '" does not exist.');
    }

    let marbleJSON: Marble;

    try {
      marbleJSON = JSON.parse(valAsbytes.toString());
    } catch (err) {
      throw new Error('Failed to decode JSON of: ' + marbleName + '. Error message: ' + err.message);
    }

    await stub.deleteState(marbleName); //remove the marble from Chaincode state

    // Delete the index
    let indexName: string = 'color~name';
    let colorNameIndexKey: any = stub.createCompositeKey(indexName, [marbleJSON.color, marbleJSON.name]);
    if (!colorNameIndexKey) {
      throw new Error('Failed to create the createCompositeKey');
    }

    //  Delete index entry to state.
    await stub.deleteState(colorNameIndexKey);
  }

  // ===========================================================
  // transfer marble by setting a new owner for the marble
  // ===========================================================
  private async transferMarble(stub: any, args: string[]): Promise<Buffer> {
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting marbleName and owner');
    }

    let marbleName: string = args[0];
    let newOwner: string = args[1].toLowerCase();
    console.info('- start transferMarble ', marbleName, newOwner);

    let marbleAsBytes: Buffer = await stub.getState(marbleName);
    if (!marbleAsBytes || !marbleAsBytes.toString()) {
      throw new Error('marble does not exist');
    }

    let marbleToTransfer: Marble;

    try {
      marbleToTransfer = JSON.parse(marbleAsBytes.toString()); //unMarshal
    } catch (err) {
      throw new Error('Failed to decode JSON of: ' + marbleName + '. Reason: ' + err.message);
    }

    marbleToTransfer.owner = newOwner; // change owner
    console.info(marbleToTransfer);

    let marbleJSONAsBytes = Buffer.from(JSON.stringify(marbleToTransfer));
    await stub.putState(marbleToTransfer.name, marbleJSONAsBytes); // Rewrite the marble

    console.info('- end transferMarble (success)');

    return marbleJSONAsBytes;
  }

  // ===========================================================================================
  // getMarblesByRange performs a range query based on the start and end keys provided.
  //
  // Read-only function results are not typically submitted to ordering. If the read-only
  // results are submitted to ordering, or if the query is used in an update transaction
  // and submitted to ordering, then the committing peers will re-execute to guarantee that
  // result sets are stable between endorsement time and commit time. The transaction is
  // invalidated by the committing peers if the result set has changed between endorsement
  // time and commit time.
  // Therefore, range queries are a safe option for performing update transactions based on query results.
  // ===========================================================================================
  private async getMarblesByRange(stub: any, args: string[]): Promise<Buffer> {
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting two arguments');
    }

    let startKey: string = args[0];
    let endKey: string = args[1];

    let results = this.getAllResults(await stub.getStateByRange(startKey, endKey), false);

    return Buffer.from(JSON.stringify(results));
  }

  // ==== Example: GetStateByPartialCompositeKey/RangeQuery =========================================
  // transferMarblesBasedOnColor will transfer marbles of a given color to a certain new owner.
  // Uses a GetStateByPartialCompositeKey (range query) against color~name 'index'.
  // Committing peers will re-execute range queries to guarantee that result sets are stable
  // between endorsement time and commit time. The transaction is invalidated by the
  // committing peers if the result set has changed between endorsement time and commit time.
  // Therefore, range queries are a safe option for performing update transactions based on query results.
  // ===========================================================================================
  private async transferMarblesBasedOnColor(stub: any, args: any[]): Promise<void> {
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting color and owner');
    }

    let color: string = args[0];
    let newOwner: string = args[1].toLowerCase();
    console.info('- start transferMarblesBasedOnColor ', color, newOwner);

    // Query the color~name index by color
    // This will execute a key range query on all keys starting with 'color'
    let coloredMarbleResultsIterator = await stub.getStateByPartialCompositeKey('color~name', [color]);

    // Iterate through result set and for each marble found, transfer to newOwner
    while (true) {
      let responseRange = await coloredMarbleResultsIterator.next();
      if (!responseRange || !responseRange.value || !responseRange.value.key) {
        return;
      }
      console.log(responseRange.value.key);

      let objectType: string;
      let attributes: string;

      ({
        objectType,
        attributes
      } = await stub.splitCompositeKey(responseRange.value.key));

      let returnedColor = attributes[0];
      let returnedMarbleName = attributes[1];
      console.info(util.format('- found a marble from index:%s color:%s name:%s\n', objectType, returnedColor, returnedMarbleName));

      // Now call the transfer function for the found marble.
      // Re-use the same function that is used to transfer individual marbles
      await this.transferMarble(stub, [returnedMarbleName, newOwner]);
    }
  }

  // ===== Example: Parameterized rich query =================================================
  // queryMarblesByOwner queries for marbles based on a passed in owner.
  // This is an example of a parameterized query where the query logic is baked into the chaincode,
  // and accepting a single query parameter (owner).
  // Only available on state databases that support rich query (e.g. CouchDB)
  // =========================================================================================
  private async queryMarblesByOwner(stub: any, args: string[]): Promise<Buffer> {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting owner name.');
    }

    let owner: string = args[0].toLowerCase();

    let queryString: QueryString = {
      selector: {
        docType: 'marble',
        color: '',
        owner: owner
      }
    };

    return await this.getQueryResultForQueryString(stub, queryString);
  }


  // ===== Example: Ad hoc rich query ========================================================
  // queryMarbles uses a query string to perform a query for marbles.
  // Query string matching state database syntax is passed in and executed as is.
  // Supports ad hoc queries that can be defined at runtime by the client.
  // If this is not desired, follow the queryMarblesForOwner example for parameterized queries.
  // Only available on state databases that support rich query (e.g. CouchDB)
  // =========================================================================================
  private async queryMarbles(stub: any, args: string[]): Promise<Buffer> {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting queryString');
    }

    let queryString: QueryString;

    try {
      queryString = JSON.parse(args[0]);
    } catch (err) {
      throw new Error('Failed to decode JSON of queryString: ' + args[0] + '. Reason: ' + err.message);
    }

    return await this.getQueryResultForQueryString(stub, queryString);
  }

  private async getAllResults(iterator: any, isHistory: any): Promise<any[]> {
    let allResults: any[] = [];

    while (true) {
      let res = await iterator.next();

      if (res.value && res.value.value.toString()) {
        let jsonResponse: JsonResponse = {
          TxId: '',
          Timestamp: 0,
          IsDeleted: '',
          Value: '',
          Key: '',
          Record: ''
        };
        console.log(res.value.value.toString('utf8'));

        if (isHistory && isHistory === true) {
          jsonResponse.TxId = res.value.tx_id;
          jsonResponse.Timestamp = res.value.timestamp;
          jsonResponse.IsDeleted = res.value.is_delete.toString();
          try {
            jsonResponse.Value = JSON.parse(res.value.value.toString('utf8'));
          } catch (err) {
            console.log(err);
            jsonResponse.Value = res.value.value.toString('utf8');
          }
        } else {
          jsonResponse.Key = res.value.key;
          try {
            jsonResponse.Record = JSON.parse(res.value.value.toString('utf8'));
          } catch (err) {
            console.log(err);
            jsonResponse.Record = res.value.value.toString('utf8');
          }
        }
        allResults.push(jsonResponse);
      }
      if (res.done) {
        console.log('end of data');
        await iterator.close();
        console.info(allResults);
        return allResults;
      }
    }
  }

  // =========================================================================================
  // getQueryResultForQueryString executes the passed in query string.
  // Result set is built and returned as a byte array containing the JSON results.
  // =========================================================================================
  private async getQueryResultForQueryString(stub: any, queryString: QueryString): Promise<Buffer> {
    console.info('- getQueryResultForQueryString queryString:\n' + JSON.stringify(queryString));
    let resultsIterator = await stub.getQueryResult(JSON.stringify(queryString));

    let results = await this.getAllResults(resultsIterator, false);

    return Buffer.from(JSON.stringify(results));
  }

  private async getHistoryForMarble(stub: any, args: string[]) {
    if (args.length < 1) {
      throw new Error('Incorrect number of arguments. Expecting 1');
    }

    let marbleName: string = args[0];
    console.info('- start getHistoryForMarble: %s\n', marbleName);

    let resultsIterator = await stub.getHistoryForKey(marbleName);
    let results = await this.getAllResults(resultsIterator, true);

    return Buffer.from(JSON.stringify(results));
  }
}

shim.start(new Chaincode());
