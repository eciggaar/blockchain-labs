### Lab 2: Chaincode - Solution
After lab 2, the bottom of the _start_ function in `app.ts` should look a bit like this:

```typescript
    // Lab 2
    payload = await chaincode.query('queryMarblesByColor', ['blue']);
    console.log('\nThe result of the query queryMarblesByColor is: ', payload, '\n');

    payload = await chaincode.invoke('paintMarble', ['marble1', 'green']);
    console.log('\nThe result of the query paintMarble is: ', payload, '\n');

    await this.helper.sleep(8000);

    payload = await chaincode.query('readMarble', ['marble1']);
    console.log('\nThe result of the query readMarble is: ', payload, '\n');
```

And in `chaincode/marbles_chaincode.js`:

The query works like this:
```javascript
  async queryMarblesByColor(stub, args) {
    if (args.length !== 1) {
      throw new Error('Incorrect number of arguments. Expecting a color.');
    }

    let queryString = {
        selector: {
            docType: 'marble',
            color: args[0]
        },
    };

    return await this.getQueryResultForQueryString.apply(this, [stub, JSON.stringify(queryString)]);
  }
```

The paintMarble function may look a bit like this:
```javascript
  async paintMarble(stub, args) {
    if (args.length !== 2) {
      throw new Error('Incorrect number of arguments. Expecting marbleName and color')
    }

    let marbleName = args[0];
    let newColor = args[1];
    console.info('- start coloring marble ', marbleName, newColor);

    let marbleAsBytes = await stub.getState(marbleName);
    if (!marbleAsBytes || !marbleAsBytes.toString()) {
      throw new Error('marble does not exist');
    }

    let marbleToPaint = {};
    try {
      marbleToPaint = JSON.parse(marbleAsBytes.toString()); //unmarshal
    } catch (err) {
      throw new Error('Failed to decode JSON of: ' + marbleName + '. Reason: ' + err.message);
    }

    console.info(marbleToPaint);

    // Solution to bonus exercise
    if (marbleToPaint.color === newColor) {
      throw new Error(' Failed to paint marble with id: ' + marbleName + ' ' + newColor + '. The marble is already ' + marbleToPaint.color);
    }

    marbleToPaint.color = newColor; //change the color

    let marbleJSONAsBytes = Buffer.from(JSON.stringify(marbleToPaint));
    await stub.putState(marbleName, marbleJSONAsBytes); // Rewrite the marble

    console.info('- end paintMarble (success)');

    return marbleJSONAsBytes;
  }
```