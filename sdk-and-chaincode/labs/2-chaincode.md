# Lab 2: Chaincode
__Note__: If you got here through a direct link, please read the main [README](../../README.md
) first.

## Add a query
In this course we are going to be writing chaincode. We will have the choice to write chaincode in ___JavaScript___ or ___TypeScript___ 
##
##### Find the chaincode folder in your project:
> you can find this under `app/chaincode/javascript` or `app/chaincode/typescript`
##### Open the file with the chaincode: 
> ___"marbles_chaincode.js"___ or  ___"marbles_chaincode.ts"___
##

##### Find and read trough the following function: 
`queryMarblesByOwner()`
 > In this function the chaincode is queried for marbles. 
 Only the results with a specified owner will be returned.
##

> **Note:** this function leverages  _stub.getQueryResult_. This is a powerful method that allows us to create complex (or simple) queries for the world state database. It only works if you use CouchDB as your database (as opposed to the simple key value store LevelDB). 

##### Make a query function called queryMarblesByColor
 > Hint: if you get stuck compare your code to the `queryMarblesByOwner()` function.
##

##### Make sure the new chaincode is installed on the peers.
We made this easy for you: the code in `chaincode-wrapper.ts` compares the version number of the chaincode that we specify in the BasicChaincodeInfo object with the one that is installed. 

Bump the version number with 1 and restart the app to install.

You may see a warning; as Org1 we are not allowed to install chaincode for Org2. If you want to do it properly, change your identity by changing the CONFIG_PATH on the top of `app.ts`. This is however not needed for a working application. 

##### Call the queryMarblesByColor() function from the SDK
> In our previous lab, we worked with the SDK. Here we learned how to call chaincode functions.
Try to add some marbles by doing some ___Invoke___ functions from the sdk, and try to retrieve them by color using this function.

>Hint: if you get stuck, do the first lab (in this directory). If you already did that, check out app.ts and search for ___Query___ or ___Invoke___. 
##

## Add an Invoke
 
##### Open the file with the chaincode: 
> ___"marbles_chaincode.js"___ or  ___"marbles_chaincode.ts"___
##

##### Find and read trough the following function: 
`transferMarble()`
 > In this function the chaincode is changing the owner for a certain marble. 
##

##### Make an invoke function called paintMarble
> this function should change the color of a certain marble to a color of your choice.

> Hint: if you get stuck compare your code to the `transferMarble()` function.

##### Call the paintMarble() function from the SDK
> In our previous lab, we worked with the SDK. Here we learned how to call chaincode functions.
Try to change some colors of marbles

> Hint: if you get stuck, do the first lab (in this directory). If you already did that, check out app.ts and search for ___Query___ or ___Invoke___. 
##

## Bonus exercise
##### Make sure that the chaincode throws an error if you try to paint the marble in the same color that it already has
###### example: If you paint a green marble green throw an error

> Call this function by using the SDK. Check your logs and the chaincode container in __Kitematic__ to see the error.

