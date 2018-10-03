# Asset-lifecycle - Solutions

## Exercise 1
A new issuer (and only shareholder) `alice`, accessing the blockchain network through `peer2`, would like to issue a new asset with an initial quantity of `200` and with ID `NL1234567890`.

- **How should the JSON input of the transaction look like?**
```json
{
   "userID":"alice",
   "accountID":"ACC12345",
   "assetID":"NL1234567890",
   "assetTitle":"aliceAsset",
   "assetIssuedQuantity":200,
   "assetMyQuantity":200,
   "shareholders":[
      "alice"
   ],
   "issuer":"alice",
   "status":"ISSUED"
}
```
- **In which channel should the issuing procedure happen?**

The issuing of the asset should happen in the `private` channel because it is the only one hosting the `private-cc` at the moment and containing the information of issuer's wallet.

- **What are the steps needed to allow `alice` to perform the issuing?**

The issuer `alice` is operating through `peer2` which is not part of the `private` channel. Therefore, the steps to perform are the following:
1. `peer2` should first join the `private` channel

`./scripts/script.sh joinChannel 2 private`

2. the `private-cc` chaincode should be installed on `peer2`

`./scripts/script.sh installChaincode 2 private-cc`

3. (optional) the `private-cc` chaincode can be instantiate on `peer2` in `private` channel

`./scripts/script.sh instantiateChaincode 2 private private-cc`

4. `peer2` is now able to issue a new asset

`./scripts/script.sh invoke 2 private private-cc issueAsset '{"userID":"alice","accountID":"ACC12345","assetID":"NL1234567890","assetTitle":"aliceAsset","assetIssuedQuantity":200,"assetMyQuantity":200,"shareholders":["alice"],"issuer":"alice","status":"ISSUED"}'`

- **Who will be able to see the content of the asset once the transaction completed?**

All the peers which are in the `private` channel and hold the `private-cc` chaincode will be able to `query` the asset `alice`.
That means: `peer0`, `peer1` and `peer2`. You can test it out running the function:

`./scripts/script.sh query [PEER_NR] private private-cc alice`

## Exercise 2
The issuer `alice` (through `peer2`) would like to sell `50` units of her asset `NL1234567890` to `bob`. 
Once the transaction is done:

1. `bob` would like to see the current transaction connecting through is access peer, `peer3`.
2. a regulator (through `peer0`) should update the balance of the asset in `alice`'s wallet.
3. now `bob` would like to see the complete information of the asset including the **shareholders** list.

- **How should the JSON input of the selling transaction look like?**
```json
{
   "transactionID":"transaction2",
   "sellerAccount":"alice",
   "receiverAccount":"bob",
   "amount":"50",
   "assetID":"alice",
   "assetTitle":"aliceAsset",
   "timestamp": 0
}
```

- **In which channel should the selling procedure happen?**

The trade should happen on the `trading` channel, as it is the only one hosting the `trading-cc` chaincode at the moment and containing the information for processing a transaction.

The trade transaction would be:

`./scripts/script.sh invoke 2 trading trading-cc transfer '{"transactionID":"transaction2","sellerAccount":"alice","receiverAccount":"bob","amount":"50","assetID":"alice","assetTitle":"aliceAsset","timestamp":0}'`

- **What are the steps `bob` needs to perform in order to complete _(1)_?**

The user `bob` does not really need to exist! That is because we are using the identity of peer itself to operate and not the one associated with the single participant.
So, the right question to answer is: what are the steps `peer3` needs to perform? 
1. `peer3` needs to join the `trading` channel

`./scripts/script.sh joinChannel 3 trading`

2. the `trading-cc` chaincode should be installed on `peer3`

`./scripts/script.sh installChaincode 3 trading-cc`

3. (optional) the `trading-cc` chaincode can be instantiate on `peer3` in `trading` channel

`./scripts/script.sh instantiateChaincode 3 trading trading-cc`

4. `peer3` is now able to query the new transaction

`./scripts/script.sh query 3 trading trading-cc transaction2`

- **How should the transaction of the update function for _(2)_ look like?**

`./scripts/script.sh invoke 0 private private-cc updateBalance alice bob 50`

- **What are the steps `bob` needs to perform in order to complete _(3)_?**

The `shareholders` list is only available on the `private-cc` chaincode, which is available at the moment only on the `private` channel.
That means the steps `peer2` needs to perform are the following:
1. `peer3` needs to join the `private` channel

`./scripts/script.sh joinChannel 3 private`

2. the `private-cc` chaincode should be installed on `peer3`

`./scripts/script.sh installChaincode 3 private-cc`

3. (optional) the `private-cc` chaincode can be instantiate on `peer3` in `private` channel

`./scripts/script.sh instantiateChaincode 3 private private-cc`

4. `peer3` is now able to query `alice`'s wallet

`./scripts/script.sh query 3 private private-cc alice`