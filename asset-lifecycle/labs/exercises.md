# Asset-lifecycle - Exercises
Run `./scripts/script.sh listFunctions` for a complete list of the methods to use for those exercises.

## Exercise 1
A new issuer (and only shareholder) `alice`, accessing the blockchain network through `peer2`, would like to issue a new asset with an initial quantity of `200` and with ID `NL1234567890`.

- How should the JSON input of the transaction look like?
- In which channel should the issuing procedure happen?
- What are the steps needed to allow `alice` to perform the issuing?
- Who will be able to see the content of the asset once the transaction completed?

Base format of the `Wallet` JSON object:
```json
{
   "userID":"string",
   "accountID":"string",
   "assetID":"string",
   "assetTitle":"string",
   "assetIssuedQuantity":0,
   "assetMyQuantity":0,
   "shareholders":[
      "string"
   ],
   "issuer":"string",
   "status":"string"
}
```

## Exercise 2
The issuer `alice` (through `peer2`) would like to sell `50` units of her asset `NL1234567890` to `bob`. 
Once the transaction is done:

1. `bob` would like to see the current transaction connecting through is access peer, `peer3`.
2. a regulator (through `peer0`) should update the balance of the asset in `alice`'s wallet.
3. now `bob` would like to see the complete information of the asset including the **shareholders** list.

- How should the JSON input of the selling transaction look like?
- In which channel should the selling procedure happen?
- What are the steps `bob` needs to perform in order to complete _(1)_?
- How should the transaction of the update function for _(2)_ look like?
- What are the steps `bob` needs to perform in order to complete _(3)_?

Base format of the `Transaction` JSON object:
```json
{
   "transactionID":"string",
   "sellerAccount":"string",
   "receiverAccount":"string",
   "amount":"string",
   "assetID":"string",
   "assetTitle":"string",
   "timestamp": 0
}
```