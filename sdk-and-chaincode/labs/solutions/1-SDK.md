### Lab 1: SDK - Solution
After lab 1, the bottom of the _start_ function in `app.ts` should look a bit like this:

```typescript
    // We can access the invoke and query functions via the Chaincode wrapper.
    // make sure to await the result, since it's an asynchronous function.

    // 2. Initialize the marble here
    let payload = await chaincode.invoke('initMarble', ['marble1', 'blue', '35', 'tom']);
    console.log(payload);

    // We wait for the invoke to be completed. Normally you'd use events for this,
    // but we'll save that for some other time.
    await this.helper.sleep(8000);

    // 1. Get marbles by range
    payload = await chaincode.query('getMarblesByRange', ['', '']);
    console.log(payload);

    payload = await chaincode.query('readMarble', ['marble1']);
    console.log(payload);
```

And the bottom part of the _invoke_ function in `chaincode-wrapper.ts`:

```typescript
    // Send the responses to the ordering service so it can carve a block and send the results to the committers.
    try {
      const broadcastResponse = await this.channel.sendTransaction(<any> {
        proposalResponses: response[0],
        proposal: response[1],
        txId: request.txId
      });

      console.log(`${logPrefix}. Broadcast ${broadcastResponse.status}`);

      return invokeResult;
    } catch (err) {
      this.helper.error(`Error Occurred. Reason: ${err.message}`);

      return 'ERROR';
    }
``` 

Now the orderer receives the transaction, creates a block and delivers the block to the peers.

The peers update their worldstate with the new information. Subsequent queries return our marble.
