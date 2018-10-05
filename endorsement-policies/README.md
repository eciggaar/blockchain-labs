# Endorsement Policy Lab
This lab heavily relies on *'fabcar'*, which is one of the default fabric samples. The same pre-requisites apply as for the other labs. Please read the main [README](../README.md) for further details on how to install these pre-reqs.
## Obtain the Hyperledger images
If not already done so, enter the following command in the directory where the samples need to be stored.
```
curl -sSL http://bit.ly/2ysbOFE | bash -s 1.2.1 1.2.1 0.4.10
```
Amongst cloning the samples to the `fabric-samples` directory on your local disk, the above command will also pull the Hyperledger Fabric, the Fabric CA images (both v1.2.1) and the supporting images (v0.4.10) from Docker Hub to your local Docker repository.

## Set up the default scenario
In the `fabric-samples` folder, change directory to the `fabcar` folder and have a closer look at the `startFabric.sh` script to understand what actually is happening when you run the script.
```
cd ./fabric-samples/fabcar
less startFabric.sh node
```
Next, run the script. Wait until it completes and run `npm install` to install the dependencies.
```
./startFabric.sh
npm install
```
Finally, enroll the admin user and register a regular user to interact with the peers.
```
node enrollAdmin.js
node registerUser.js
```
## Change Endorsement Policy
By default the chaincode is instantiated with the following endorsement policy:
```
"OR ('Org1MSP.member','Org2MSP.member')"
```
This means that only signature is required from one of the two members. As we have only one organization defined in our set-up, this will always work.

> This is not a recommended policy for production scenarios.

Imagine we change the policy to request a signature from both a member of `Org1` and `Org2`. This would cause the transaction proposal to fail, because we do not have two organizations defined.

To deploy the chaincode with a new policy, first define two environment variables to locate the chaincode source code and the chaincode language used.
```
export CC_SRC_PATH=/opt/gopath/src/github.com/fabcar/node
export LANGUAGE=node
```
Next, install a new version of the chaincode.
```
docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode install -n fabcar -p "$CC_SRC_PATH" -l "$LANGUAGE" -v 1.1
```
where `1.1` is the new version that is instantiated. Now upgrade the existing chaincode to the new version by running:
```
docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode upgrade -o orderer.example.com:7050 -C mychannel -n fabcar -l "$LANGUAGE" -c '{"Args":[""]}' -P "OR ('Org1MSP.member','Org2MSP.member')" -v 1.1
```
In the above command, the `-P` parameter sets the new endorsement policy to:
```
"AND ('Org1MSP.member','Org2MSP.member')"
```
Finally, execute the `chaincode invoke` to init the ledger again (i.e. add 10 cars to the ledger).
```
docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp" cli peer chaincode invoke -o orderer.example.com:7050 -C mychannel -n fabcar -c '{"function":"initLedger","Args":[""]}'
```
Check the peer logs for messages. You should see something like:
```
2018-10-04 13:11:40.552 UTC [gossip/privdata] StoreBlock -> INFO 060 [mychannel] Received block [9] from buffer
2018-10-04 13:11:40.558 UTC [vscc] Validate -> WARN 061 Endorsement policy failure for transaction txid=a0f2e1b38b43d1336cd979f8ee7fe461d3cc23d4173db2afcc0c840923179671, err: signature set did not satisfy policy
2018-10-04 13:11:40.558 UTC [committer/txvalidator] validateTx -> ERRO 062 VSCCValidateTx for transaction txId = a0f2e1b38b43d1336cd979f8ee7fe461d3cc23d4173db2afcc0c840923179671 returned error: VSCC error: endorsement policy failure, err: signature set did not satisfy policy
2018-10-04 13:11:40.558 UTC [committer/txvalidator] Validate -> INFO 063 [mychannel] Validated block [9] in 5ms
2018-10-04 13:11:40.558 UTC [valimpl] preprocessProtoBlock -> WARN 064 Channel [mychannel]: Block [9] Transaction index [0] TxId [a0f2e1b38b43d1336cd979f8ee7fe461d3cc23d4173db2afcc0c840923179671] marked as invalid by committer. Reason code [ENDORSEMENT_POLICY_FAILURE]
2018-10-04 13:11:40.615 UTC [kvledger] CommitWithPvtData -> INFO 065 [mychannel] Committed block [9] with 1 transaction(s) in 56ms (state_validation=0ms block_commit=22ms state_commit=27ms)
```
## Additional Exercise
Make a change to the client-side `invoke.js` to call the `initLedger` chaincode function, whenever a request is made.
Next, run it and verify the results...
```
node invoke.js
```
With the new endorsement policy in place, this should now return something like:
```
Successfully loaded user1 from persistence
Assigning transaction_id:  0f6587dc621d0d88eebd95a12a822bafac36e97625bb19a1f87ff7781c7f093e
Transaction proposal was good
Successfully sent Proposal and received ProposalResponse: Status - 200, message - ""
The transaction was invalid, code = ENDORSEMENT_POLICY_FAILURE
Send transaction promise and event listener promise have completed
Successfully sent transaction to the orderer.
Transaction failed to be committed to the ledger due to ::ENDORSEMENT_POLICY_FAILURE
```
Feel free to send me pull requests to further improvement this lab. Thanks and happy coding!! :smiley:
