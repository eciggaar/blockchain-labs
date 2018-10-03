## Introduction  
This is a minimal implementation of a TypeScript NodeJS app using the fabric-client. Two labs are included to help you get familiar with writing your own Fabric applications;

- [__SDK__](./labs/1-SDK.md)
- [__Chaincode__](./labs/2-chaincode.md)

## To run
First, start the blockchain with `npm run startHLF`.

Run the app with `npm run startApp` or `node index.js`. It calls `app.ts`, which ties everything together. This allow us to use TypeScript without transpiling as a separate build step.  

## Flow
The app instantiates an instance of the client sdk, which gets its settings from `network/connectionprofile.localhost.org1.yaml`. Then it uses
the ChannelWrapper (`channel-wrapper.ts`) to create and join a channel. ChaincodeWrapper (`chaincode-wrapper.ts`) provides a wrapper to
common chaincode functions like install, instantiate, upgrade and of course invoke and query.

## Troubleshooting
**T:** Trying to install node modules with `npm install` and getting the following or similar error related to `node-gyp` module (on Mac):
```
version = re.match(r'(\d\.\d\.?\d*)', version).groups()[0]
AttributeError: 'NoneType' object has no attribute 'groups'
gyp ERR! configure error
gyp ERR! stack Error: `gyp` failed with exit code: 1
gyp ERR! stack     at ChildProcess.onCpExit (/usr/local/Cellar/node@8/8.11.4/lib/node_modules/npm/node_modules/node-gyp/lib/configure.js:336:16)
gyp ERR! stack     at emitTwo (events.js:126:13)
gyp ERR! stack     at ChildProcess.emit (events.js:214:7)
gyp ERR! stack     at Process.ChildProcess._handle.onexit (internal/child_process.js:198:12)
gyp ERR! System Darwin 17.7.0
gyp ERR! node -v v8.11.4
gyp ERR! node-gyp -v v3.6.2
gyp ERR! not ok
npm ERR! code ELIFECYCLE
npm ERR! errno 1
npm ERR! pkcs11js@1.0.16 install: `node-gyp rebuild`
npm ERR! Exit status 1
```
**S:** Update your version of node and it will fix the issue. `node-gyp` v3.6.2 is affected by a bug which does not recognize the installed XCode version.
