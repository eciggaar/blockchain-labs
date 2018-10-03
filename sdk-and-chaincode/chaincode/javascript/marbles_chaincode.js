/*
 # Copyright IBM Corp. All Rights Reserved.
 #
 # SPDX-License-Identifier: Apache-2.0
 */

// ====CHAINCODE EXECUTION SAMPLES (CLI) ==================

// ==== Invoke marbles ====
// peer chaincode invoke -C myc1 -n marbles -c '{"Args":["initMarble","marble1","blue","35","tom"]}'
// peer chaincode invoke -C myc1 -n marbles -c '{"Args":["initMarble","marble2","red","50","tom"]}'
// peer chaincode invoke -C myc1 -n marbles -c '{"Args":["initMarble","marble3","blue","70","tom"]}'
// peer chaincode invoke -C myc1 -n marbles -c '{"Args":["transferMarble","marble2","jerry"]}'
// peer chaincode invoke -C myc1 -n marbles -c '{"Args":["transferMarblesBasedOnColor","blue","jerry"]}'
// peer chaincode invoke -C myc1 -n marbles -c '{"Args":["delete","marble1"]}'

// ==== Query marbles ====
// peer chaincode query -C myc1 -n marbles -c '{"Args":["readMarble","marble1"]}'
// peer chaincode query -C myc1 -n marbles -c '{"Args":["getMarblesByRange","marble1","marble3"]}'
// peer chaincode query -C myc1 -n marbles -c '{"Args":["getHistoryForMarble","marble1"]}'

// Rich Query (Only supported if CouchDB is used as state database):
//   peer chaincode query -C myc1 -n marbles -c '{"Args":["queryMarblesByOwner","tom"]}'
//   peer chaincode query -C myc1 -n marbles -c '{"Args":["queryMarbles","{\"selector\":{\"owner\":\"tom\"}}"]}'

'use strict';
const shim = require('fabric-shim');
const util = require('util');

let Chaincode = class {
  async Init(stub) {
    let ret = stub.getFunctionAndParameters();
    console.info(ret);
    console.info('=========== Instantiated Marbles Chaincode ===========');
    console.info('=========== Running Chaincode in JavaScript ===========');

    return shim.success();
  }

  async Invoke(stub) {
    console.info('Transaction ID: ' + stub.getTxID());
    console.info(util.format('Args: %j', stub.getArgs()));

    let ret = stub.getFunctionAndParameters();
    console.info(ret);

    let method = this[ret.fcn];
    if (!method) {
      console.log('no function of name:' + ret.fcn + ' found');
      throw new Error('Received unknown function ' + ret.fcn + ' invocation');
    }
    try {
      let payload = await method.apply(this, [stub, ret.params]);
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
  async initMarble(stub, args) {
    if (args.length !== 4) {
      throw new Error('Incorrect number of arguments. Expecting 4');
    }

    // ==== Input sanitation ====
    console.info('--- start init marble ---');

    args.forEach((arg, index) => {
      if (arg.length <= 0) {
        throw new Error('argument ' + index + ' is not a non-empty string');
      }
    });

    let marbleName = args[0];
    let color = args[1].toLowerCase();
    let owner = args[3].toLowerCase();
    let size = parseInt(args[2]);

    if (typeof size !== 'number') {
      throw new Error('3rd argument must be a numeric string');
    }

    // ==== Check if marble already exists ====
    let marbleState = await stub.getState(marbleName);
    if (marbleState.toString()) {
      throw new Error('Marble "' + marbleName + '" already exists');
    }

    // ==== Create marble object and marshal to JSON ====
    let marble = {};
    marble.docType = 'marble';
    marble.name = marbleName;
    marble.color = color;
    marble.size = size;
    marble.owner = owner;

    // === Put marble as a JSON string in a buffer and save the marble to state ===
    await stub.putState(marbleName, Buffer.from(JSON.stringify(marble)));

    // Add the name and color of the new marble to the index 'color~name' index
    let indexName = 'color~name';
    let colorNameIndexKey = await stub.createCompositeKey(indexName, [marble.color, marble.name]);
    console.info(colorNameIndexKey);

    //  Note - passing a 'nil' value will effectively delete the key from state, therefore we pass null character as value
    await stub.putState(colorNameIndexKey, Buffer.from('\u0000'));
    // ==== Marble saved and indexed. Return success ====
    console.info('- end init marble');

    return Buffer.from(JSON.stringify(marble));
  }

  // ===============================================
  // readMarble - Read a marble from Chaincode state
  // ===============================================
  async readMarble(stub, args) {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting name of the marble to query');
    }

    let name = args[0];
    if (!name) {
      throw new Error(' marble name must not be empty');
    }

    let marbleAsbytes = await stub.getState(name); //get the marble from chaincode state
    if (!marbleAsbytes.toString()) {
      throw new Error('Marble does not exist: ' + name);
    }

    return marbleAsbytes;
  }

  // ==================================================
  // delete - Remove a marble key/value pair from state
  // ==================================================
  async delete(stub, args) {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting name of the marble to delete');
    }
    let marbleName = args[0];
    if (!marbleName) {
      throw new Error('Marble name must not be empty');
    }

    // to maintain the color~name index, we need to read the marble first and get its color
    let valAsbytes = await stub.getState(marbleName); //get the marble from chaincode state
    if (!valAsbytes) {
      throw new Error('Marble "' + marbleName + '" does not exist.');
    }

    let marbleJSON = {};
    try {
      marbleJSON = JSON.parse(valAsbytes.toString());
    } catch (err) {
      throw new Error('Failed to decode JSON of: ' + marbleName + '. Error message: ' + err.message);
    }

    await stub.deleteState(marbleName); //remove the marble from Chaincode state

    // Delete the index
    let indexName = 'color~name';
    let colorNameIndexKey = stub.createCompositeKey(indexName, [marbleJSON.color, marbleJSON.name]);
    if (!colorNameIndexKey) {
      throw new Error('Failed to create the createCompositeKey');
    }

    //  Delete index entry to state.
    await stub.deleteState(colorNameIndexKey);
  }

  // ===========================================================
  // transfer a marble by setting a new owner name on the marble
  // ===========================================================
  async transferMarble(stub, args) {
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting marbleName and owner');
    }

    let marbleName = args[0];
    let newOwner = args[1].toLowerCase();
    console.info('- start transferMarble ', marbleName, newOwner);

    let marbleAsBytes = await stub.getState(marbleName);
    if (!marbleAsBytes || !marbleAsBytes.toString()) {
      throw new Error('marble does not exist');
    }

    let marbleToTransfer = {};
    try {
      marbleToTransfer = JSON.parse(marbleAsBytes.toString()); //unMarshal
    } catch (err) {
      throw new Error('Failed to decode JSON of: ' + marbleName + '. Reason: ' + err.message);
    }

    marbleToTransfer.owner = newOwner; // change owner
    console.info(marbleToTransfer);

    let marbleJSONAsBytes = Buffer.from(JSON.stringify(marbleToTransfer));
    await stub.putState(marbleName, marbleJSONAsBytes); // Rewrite the marble

    console.info('- end transferMarble (success)');
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
  async getMarblesByRange(stub, args) {
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting two arguments');
    }

    let startKey = args[0];
    let endKey = args[1];

    let resultsIterator = await stub.getStateByRange(startKey, endKey);
    let results = await this.getAllResults.apply(this, [resultsIterator, false]);

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
  async transferMarblesBasedOnColor(stub, args) {
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting color and owner');
    }

    let color = args[0];
    let newOwner = args[1].toLowerCase();
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

      let objectType;
      let attributes;

      ({
        objectType,
        attributes
      } = await stub.splitCompositeKey(responseRange.value.key));

      let returnedColor = attributes[0];
      let returnedMarbleName = attributes[1];
      console.info(util.format('- found a marble from index:%s color:%s name:%s\n', objectType, returnedColor, returnedMarbleName));

      // Now call the transfer function for the found marble.
      // Re-use the same function that is used to transfer individual marbles
      await this.transferMarble.apply(this, [stub, [returnedMarbleName, newOwner]]);
    }
  }

  // ===== Example: Parameterized rich query =================================================
  // queryMarblesByOwner queries for marbles based on a passed in owner.
  // This is an example of a parameterized query where the query logic is baked into the chaincode,
  // and accepting a single query parameter (owner).
  // Only available on state databases that support rich query (e.g. CouchDB)
  // =========================================================================================
  async queryMarblesByOwner(stub, args) {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting owner name.');
    }

    let queryString = {
      selector: {
        docType: 'marble',
        owner: args[0].toLowerCase()
      },
    };

    return await this.getQueryResultForQueryString.apply(this, [stub, JSON.stringify(queryString)]);
  }


  // ===== Example: Ad hoc rich query ========================================================
  // queryMarbles uses a query string to perform a query for marbles.
  // Query string matching state database syntax is passed in and executed as is.
  // Supports ad hoc queries that can be defined at runtime by the client.
  // If this is not desired, follow the queryMarblesForOwner example for parameterized queries.
  // Only available on state databases that support rich query (e.g. CouchDB)
  // =========================================================================================
  async queryMarbles(stub, args) {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting queryString');
    }

    let queryString = args[0];

    if (!queryString) {
      throw new Error('queryString must not be empty');
    }

    return await this.getQueryResultForQueryString.apply(this, [stub, JSON.stringify(queryString)]);
  }

  async getAllResults(iterator, isHistory) {
    let allResults = [];
    while (true) {
      let res = await iterator.next();

      if (res.value && res.value.value.toString()) {
        let jsonRes = {};
        console.log(res.value.value.toString('utf8'));

        if (isHistory && isHistory === true) {
          jsonRes.TxId = res.value.tx_id;
          jsonRes.Timestamp = res.value.timestamp;
          jsonRes.IsDelete = res.value.is_delete.toString();
          try {
            jsonRes.Value = JSON.parse(res.value.value.toString('utf8'));
          } catch (err) {
            console.log(err);
            jsonRes.Value = res.value.value.toString('utf8');
          }
        } else {
          jsonRes.Key = res.value.key;
          try {
            jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
          } catch (err) {
            console.log(err);
            jsonRes.Record = res.value.value.toString('utf8');
          }
        }
        allResults.push(jsonRes);
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
  async getQueryResultForQueryString(stub, queryString) {
    console.info('- getQueryResultForQueryString queryString:\n' + queryString);
    let resultsIterator = await stub.getQueryResult(queryString);

    let results = await this.getAllResults(resultsIterator, false);

    return Buffer.from(JSON.stringify(results));
  }

  async getHistoryForMarble(stub, args) {
    if (args.length < 1) {
      throw new Error('Incorrect number of arguments. Expecting 1')
    }

    let marbleName = args[0];
    console.info('- start getHistoryForMarble: %s\n', marbleName);

    let resultsIterator = await stub.getHistoryForKey(marbleName);
    let results = await this.getAllResults(resultsIterator, true);

    return Buffer.from(JSON.stringify(results));
  }
};

shim.start(new Chaincode());
