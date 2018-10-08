#!/bin/bash

: ${TIMEOUT:="60"}
COUNTER=0
MAX_RETRY=5
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
HELP="List of available commands:

    init                                                        Run the first initialisation of the network
    demo                                                        Run the interactive demo described in the README
    listFunctions                                               Show a list of the available functions divided by smart-contract
    setPeer [PEER_NR]                                           Set credentials as peer [PEER_NR]
    createChannel [CHANNEL]                                     Create a new channel with [CHANNEL]
    joinChannel [PEER_NR] [CHANNEL]                             Add peer [PEER_NR] to [CHANNEL]
    installChaincode [PEER_NR] [CHAINCODE]                      Install [CHAINCODE] on peer [PEER_NR]
    instantiateChaincode [PEER_NR] [CHANNEL] [CHAINCODE]        Instantiate [CHAINCODE] on peer [PEER_NR] in [CHANNEL] channel
    query [PEER_NR] [CHANNEL] [CHAINCODE] [KEY]                 Query by [KEY] on [CHANNEL] and [CHAINCODE] with [PEER_NR]
    invoke [PEER_NR] [CHANNEL] [CHAINCODE] [FUNCTION] [ARGS]    Invoke [FUNCTION] with [ARGS] on [CHANNEL] and [CHAINCODE] with [PEER_NR]
"

listFunctions () {
  FUNCTIONS="List of available functions per chaincode:
    chaincode: private-cc

    issueAsset [JSON]                                                           Create a new asset [JSON] and set the status to ISSUED
    approveAsset [WALLET_ID]                                                    Set the status of the asset as APPROVED
    updateBalance [WALLET_ID_SENDER] [WALLET_ID_RECIPIENT] [TRANSFER_QUANTITY]  Move [TRANSFER_QUANTITY] from [WALLET_ID_SENDER] to [WALLET_ID_RECIPIENT] and set the status to TRADED


    chaincode: trading-cc

    transfer [JSON]                                                             Create a transaction [JSON] with the details of the transfer


    chaincode: sharing-cc

    createAsset [JSON]                                                          Add a new asset [JSON] in the showcase
    updateAsset [ASSET_ID] [ASSET_QUANTITY]                                     Update the quantity availability [ASSET_QUANTITY] of an asset [ASSET_ID]
    getAllAssets available                                                      Return all the available assets for trading
    "

    echo "$FUNCTIONS"
}

gracefulExit () {
    printf "\n\nCTRL-C detected. Exiting...\n"
    # reenable tty echo
    stty icanon echo echok
    exit 1
}

trap gracefulExit INT

verifyResult () {
	if [ $1 -ne 0 ] ; then
		echo "!!!!!!!!!!!!!!! "$2" !!!!!!!!!!!!!!!!"
                echo "================== ERROR !!! FAILED to execute script =================="
		echo
   		exit 1
	fi
}

setGlobals () {
	CORE_PEER_LOCALMSPID="Org1MSP"
	CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer$1.org1.example.com/tls/ca.crt
	CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
	CORE_PEER_ADDRESS=peer$1.org1.example.com:7051
	env |grep CORE
}

createChannel() {
  CHANNEL_NAME=$1
  setGlobals 0
  echo "===================== Going to create Channel \"$CHANNEL_NAME\"  ===================== "

  if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		peer channel create -o orderer.example.com:7050 -c $CHANNEL_NAME -f ./channel-artifacts/$CHANNEL_NAME.tx >&fabric-v1.log
	else
		peer channel create -o orderer.example.com:7050 -c $CHANNEL_NAME -f ./channel-artifacts/$CHANNEL_NAME.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&fabric-v1.log
	fi
	res=$?
	cat fabric-v1.log
	verifyResult $res "Channel creation failed"
	echo "===================== Channel \"$CHANNEL_NAME\" is created successfully ===================== "
	echo
}

updateAnchorPeers() {
  PEER=$1
  CHANNEL_NAME=$2
  setGlobals $PEER

  if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		peer channel update -o orderer.example.com:7050 -c $CHANNEL_NAME -f ./channel-artifacts/${CORE_PEER_LOCALMSPID}anchors-${CHANNEL_NAME}.tx >&fabric-v1.log
	else
		peer channel update -o orderer.example.com:7050 -c $CHANNEL_NAME -f ./channel-artifacts/${CORE_PEER_LOCALMSPID}anchors-${CHANNEL_NAME}.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&fabric-v1.log
	fi
	res=$?
	cat log.txt
	verifyResult $res "Anchor peer update failed"
	echo "===================== Anchor peers for org \"$CORE_PEER_LOCALMSPID\" on \"$CHANNEL_NAME\" is updated successfully ===================== "
	sleep 5
	echo
}

## Sometimes Join takes time hence RETRY atleast for 5 times
joinWithRetry () {
	peer channel join -b $2.block >&fabric-v1.log
	res=$?
	cat fabric-v1.log
	if [ $res -ne 0 -a $COUNTER -lt $MAX_RETRY ]; then
		COUNTER=` expr $COUNTER + 1`
		echo "PEER$1 failed to join the channel, Retry after 2 seconds"
		sleep 2
		joinWithRetry $1 $2
	else
		COUNTER=0
	fi
        verifyResult $res "After $MAX_RETRY attempts, PEER$ch has failed to Join the channel $2"
}

joinChannel () {
    PEER=$1
    CHANNEL_NAME=$2
    echo "===================== Joining \"$CHANNEL_NAME\" on Peer$PEER  ===================== "
    setGlobals $PEER
    joinWithRetry $PEER $CHANNEL_NAME
    echo "===================== PEER$PEER joined on the channel \"$CHANNEL_NAME\" ===================== "
    sleep 2
    echo
}

installChaincode () {
	PEER=$1
	CHAINCODE_NAME=$2
	CHAINCODE_VERSION=$3

	setGlobals $PEER

	peer chaincode install -n $CHAINCODE_NAME -v 1.0 -p github.com/hyperledger/fabric/examples/$CHAINCODE_NAME >&fabric-v1.log
	res=$?
	cat fabric-v1.log
        verifyResult $res "$CHAINCODE_NAME Chaincode installation on remote peer PEER$PEER has Failed"
	echo "===================== $CHAINCODE_NAME Chaincode is installed on remote peer PEER$PEER ===================== "
	echo
}

instantiateChaincode () {
	PEER=$1
	CHANNEL_NAME=$2
	CHAINCODE_NAME=$3
	setGlobals $PEER
        if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		peer chaincode instantiate -o orderer.example.com:7050 -C $CHANNEL_NAME -n $CHAINCODE_NAME -v 1.0 -c '{"Args":[]}' -P "OR('Org1MSP.member')" >&fabric-v1.log
	else
		peer chaincode instantiate -o orderer.example.com:7050 --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n $CHAINCODE_NAME -v 1.0 -c '{"Args":[]}' -P "OR('Org1MSP.member')" >&fabric-v1.log
	fi
	res=$?
	cat fabric-v1.log
	verifyResult $res "Chaincode instantiation on PEER$PEER on channel '$CHANNEL_NAME' failed"
	echo "===================== Chaincode Instantiation on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
	echo
}

chaincodeQuery () {
  PEER=$1
  CHANNEL_NAME=$2
  CHAINCODE_NAME=$3
  KEY=$4
  QUERY="{\"Args\":[\"query\",\"$KEY\"]}"
  echo "===================== Querying on PEER$PEER on channel '$CHANNEL_NAME'... ===================== "
  setGlobals $PEER
  local rc=1
  local starttime=$(date +%s)

  # continue to poll
  # we either get a successful response, or reach TIMEOUT
  while test "$(($(date +%s)-starttime))" -lt "$TIMEOUT" -a $rc -ne 0
  do
     sleep 3
     echo "Attempting to Query PEER$PEER ...$(($(date +%s)-starttime)) secs"
     peer chaincode query -C $CHANNEL_NAME -n $CHAINCODE_NAME -c $QUERY >&fabric-v1.log
     test $? -eq 0 && VALUE=$(cat fabric-v1.log | awk '/Query Result/ {print $NF}')  && let rc=0
     test $? -eq 1 && VALUE=$(cat fabric-v1.log | awk '/Error/ {print}')  && let rc=0
  done
  echo
  cat fabric-v1.log
  if test $rc -eq 0 ; then
	echo "===================== Query on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
  else
	echo "!!!!!!!!!!!!!!! Query result on PEER$PEER is INVALID !!!!!!!!!!!!!!!!"
        echo "================== ERROR !!! FAILED to execute End-2-End Scenario =================="
	echo
  fi
}

chaincodeInvoke () {
    PEER=$1
    CHANNEL_NAME=$2
    CHAINCODE_NAME=$3
    FUNCTION=$4

    ARGS=""
    for arg in ${@:5}
    do
      arg=`echo $arg | sed 's/"/\\\"/g'`
      ARGS+="\"$arg\","
    done

    ARGS=${ARGS:0:${#ARGS}-1}

    INVOKE="{\"Args\":[\"$FUNCTION\",$ARGS]}"

    echo "===================== Invoking on PEER$PEER on channel '$CHANNEL_NAME'... ===================== "
    setGlobals $PEER
  if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		peer chaincode invoke -o orderer.example.com:7050 -C $CHANNEL_NAME -n $CHAINCODE_NAME -c $INVOKE >&fabric-v1.log
	else
		peer chaincode invoke -o orderer.example.com:7050  --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n $CHAINCODE_NAME -c $INVOKE >&fabric-v1.log
	fi
	res=$?
	cat fabric-v1.log
	verifyResult $res "Invoke execution on PEER$PEER failed "
	echo "===================== Invoke transaction on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
	echo
}

demo() {
    echo "ISSUING AN ASSET"
    printf "\nInvoke to issue an asset on the PRIVATE CHANNEL (peer1)\n\n"
    read -n 1 -s -p "Press any key to start the interactive demo"
    chaincodeInvoke 1 private private-cc issueAsset '{"userID":"john","accountID":"A846HD","assetID":"IT123456890","assetTitle":"BigCompany-asset1","assetIssuedQuantity":100,"assetMyQuantity":100,"shareholders":["john"],"issuer":"john","status":"ISSUED"}'

    printf "\n\nInvoke to approve an asset on the PRIVATE CHANNEL (peer0)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeInvoke 0 private private-cc approveAsset john

    printf "\n\nQuery to retrieve information about the asset on the PRIVATE CHANNEL (peer1)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeQuery 1 private private-cc john

    printf "\n\nOther peers not in the PRIVATE CHANNEL cannot see the information stored if they try to query it (peer2)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeQuery 2 private private-cc john

    printf "\n\nInvoke to create an asset on the SHARING CHANNEL (peer0)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeInvoke 0 sharing sharing-cc createAsset '{"assetID":"IT123456890","assetTitle":"BigCompany-asset1","assetAvailableQuantity":100}'

    echo "TRADING AN ASSET"
    printf "\nInvoke to transfer from John (peer1) to Jane (peer2) on the TRADING CHANNEL (peer1)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeInvoke 1 trading trading-cc transfer '{"transactionID":"transaction1","sellerAccount":"john","receiverAccount":"jane","amount":20,"assetID":"IT123456890","assetTitle":"BigCompany-asset1","timestamp":1491387927548}'

    printf "\n\nQuery to retrieve the transaction on the TRADING CHANNEL (peer2)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeQuery 2 trading trading-cc transaction1

    printf "\n\nOther peers not in the TRADING CHANNEL cannot see the information stored if they try to query it (peer3)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeQuery 3 trading trading-cc transaction1

    printf "\n\nInvoke to update the balance of an asset on the PRIVATE CHANNEL (peer0)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeInvoke 0 private private-cc updateBalance john jane 20

    printf "\n\nInvoke to update available quantity of asset on the SHARING CHANNEL (peer0)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeInvoke 0 sharing sharing-cc updateAsset IT123456890 20

    printf "\n\nQuery to retrieve all the assets on the SHARING CHANNEL (peer3)\n\n"
    read -n 1 -s -p "Press any key to continue"
    chaincodeInvoke 3 sharing sharing-cc getAllAssets available

    printf "\n\nThat's it! I hope you enjoyed this journey through the magical universe of Fabric channels :)\n\n"
}

case $1 in
"init")
     # Create channels, first argument is the channel name
    createChannel private
    createChannel trading
    createChannel sharing

    # Join all the peers to the channels, first argument is the peer, second argument is the channel name
    joinChannel 0 private
    joinChannel 1 private

    joinChannel 0 trading
    joinChannel 1 trading
    joinChannel 2 trading

    joinChannel 0 sharing
    joinChannel 1 sharing
    joinChannel 2 sharing
    joinChannel 3 sharing

    # Update anchor peers for all the channels
    updateAnchorPeers 0 private
    updateAnchorPeers 0 trading
    updateAnchorPeers 0 sharing

    # Install the chaincode on the peers, first argument is the peer, second argument is the chaincode name
    installChaincode 0 private-cc
    installChaincode 1 private-cc

    installChaincode 0 trading-cc
    installChaincode 1 trading-cc
    installChaincode 2 trading-cc

    installChaincode 0 sharing-cc
    installChaincode 1 sharing-cc
    installChaincode 2 sharing-cc
    installChaincode 3 sharing-cc

    # Instantiate chaincode, first argument is the peer, second argument is both the chaincode and channel name
    instantiateChaincode 0 private private-cc
    instantiateChaincode 0 trading trading-cc
    instantiateChaincode 0 sharing sharing-cc

    echo "===================== Network setup is successful ===================== "
    ;;
"demo")
    demo
    ;;
"setPeer")
    if [ -z $2 ]; then
        echo "Parameter missing"
        echo "$HELP"
        exit 1
    fi
    setGlobals $2
    ;;
"listFunctions")
    listFunctions
    ;;
"createChannel")
    if [ -z $2 ]; then
        echo "Parameter missing"
        echo "$HELP"
        exit 1
    fi
    createChannel $2
    ;;
"joinChannel")
    if [ -z $2 ] || [ -z $3 ]; then
        echo "Parameter missing"
        echo "$HELP"
        exit 1
    fi
    joinChannel $2 $3
    ;;
"installChaincode")
    if [ -z $2 ] || [ -z $3 ]; then
        echo "Parameter missing"
        echo "$HELP"
        exit 1
    fi
    installChaincode $2 $3
    ;;
"instantiateChaincode")
    if [ -z $2 ] || [ -z $3 ] || [ -z $4 ]; then
        echo "Parameter missing"
        echo "$HELP"
        exit 1
    fi
    instantiateChaincode $2 $3 $4
    ;;
"query")
    if [ -z $2 ] || [ -z $3 ] || [ -z $4 ] || [ -z $5 ]; then
        echo "Parameter missing"
        echo "$HELP"
        exit 1
    fi
    chaincodeQuery $2 $3 $4 $5
    ;;
"invoke")
    if [ -z $2 ] || [ -z $3 ] || [ -z $4 ] || [ -z $5 ]; then
        echo "Parameter missing"
        echo "$HELP"
        exit 1
    fi
    chaincodeInvoke $2 $3 $4 ${@:5}
    ;;
*)
    echo "$HELP"
    ;;
esac
