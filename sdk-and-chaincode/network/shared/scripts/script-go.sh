#!/bin/sh

echo
echo " ____    _____      _      ____    _____ "
echo "/ ___|  |_   _|    / \    |  _ \  |_   _|"
echo "\___ \    | |     / _ \   | |_) |   | |  "
echo " ___) |   | |    / ___ \  |  _ <    | |  "
echo "|____/    |_|   /_/   \_\ |_| \_\   |_|  "
echo
echo "Build your first network (BYFN) end-to-end test"
echo
CHANNEL_NAME="$1"
: ${CHANNEL_NAME:="mychannel"}
: ${TIMEOUT:="60"}
COUNTER=1
MAX_RETRY=5

# !
# Additions for fabric-tool. All peer calls are now wrapped in the execute function.
# Hardcoded addresses are replaced by environment variables.
# Other changes are in the setGlobals function and joinWithRetry.
sleep 5
execute() {
    docker exec cli-$CORE_PEER_ADDRESS sh -c "$1"
}

echo "Channel name : "$CHANNEL_NAME

# verify the result of the end-to-end test
verifyResult () {
	if [ $1 -ne 0 ] ; then
		echo "!!!!!!!!!!!!!!! "$2" !!!!!!!!!!!!!!!!"
    echo "========= ERROR !!! FAILED to execute End-2-End Scenario ==========="
		echo
   		exit 1
	fi
}

setGlobals () {
	if [ $1 -eq 0 -o $1 -eq 1 ] ; then
		CORE_PEER_LOCALMSPID=$ORG1_MSP
		if [ $1 -eq 0 ]; then
			CORE_PEER_ADDRESS=$PEER0
		else
			CORE_PEER_ADDRESS=$PEER1
		fi
	else
		CORE_PEER_LOCALMSPID=$ORG2_MSP
		if [ $1 -eq 2 ]; then
			CORE_PEER_ADDRESS=$PEER2
		else
			CORE_PEER_ADDRESS=$PEER3
		fi
	fi

	env |grep CORE
}

createChannel() {
	setGlobals 0

  if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
        execute "peer channel create -c $CHANNEL_NAME -o $ORDERER_ADDRESS -f $CHANNEL_TX" >&log.txt
	else
        execute "peer channel create -c $CHANNEL_NAME -o $ORDERER_ADDRESS -f $CHANNEL_TX --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA" >&log.txt
	fi
	res=$?
	cat log.txt
	verifyResult $res "Channel creation failed"
	echo "===================== Channel \"$CHANNEL_NAME\" is created successfully ===================== "
	echo
}

updateAnchorPeers() {
  PEER=$1
  setGlobals $PEER

  if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		execute "peer channel update -o $ORDERER_ADDRESS -c $CHANNEL_NAME -f ./artifacts/${CORE_PEER_LOCALMSPID}anchors.tx" >&log.txt
	else
		execute "peer channel update -o $ORDERER_ADDRESS -c $CHANNEL_NAME -f ./artifacts/${CORE_PEER_LOCALMSPID}anchors.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA" >&log.txt
	fi
	res=$?
	cat log.txt
	verifyResult $res "Anchor peer update failed"
	echo "===================== Anchor peers for org \"$CORE_PEER_LOCALMSPID\" on \"$CHANNEL_NAME\" is updated successfully ===================== "
	echo
}

## Sometimes Join takes time hence RETRY atleast for 5 times
joinWithRetry () {
	# ! code added because we don't execute the commands in the same environment
	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
        execute "peer channel fetch config -c $CHANNEL_NAME -o $ORDERER_ADDRESS" >&log.txt
	else
        execute "peer channel fetch config -c $CHANNEL_NAME -o $ORDERER_ADDRESS --tls --cafile $ORDERER_CA" >&log.txt
	fi

	execute "peer channel join -b ${CHANNEL_NAME}_config.block" >&log.txt
	res=$?
	cat log.txt
	if [ $res -ne 0 -a $COUNTER -lt $MAX_RETRY ]; then
		COUNTER=` expr $COUNTER + 1`
		echo "PEER$1 failed to join the channel, Retry after 2 seconds"
		sleep 2
		joinWithRetry $1
	else
		COUNTER=1
	fi
  verifyResult $res "After $MAX_RETRY attempts, PEER$ch has failed to Join the Channel"
}

joinChannel () {
	for ch in 0 1 2 3; do
		setGlobals $ch
		joinWithRetry $ch
		echo "===================== PEER$ch joined on the channel \"$CHANNEL_NAME\" ===================== "
		sleep 2
		echo
	done
}

installChaincode () {
	PEER=$1
	setGlobals $PEER
	execute "peer chaincode install -n mycc -v 1.0 -p github.com/hyperledger/fabric/examples/chaincode/go/chaincode_example02" >&log.txt
	res=$?
	cat log.txt
        verifyResult $res "Chaincode installation on remote peer PEER$PEER has Failed"
	echo "===================== Chaincode is installed on remote peer PEER$PEER ===================== "
	echo
}

instantiateChaincode () {
	PEER=$1
	setGlobals $PEER
	# while 'peer chaincode' command can get the orderer endpoint from the peer (if join was successful),
	# lets supply it directly as we know it using the "-o" option
	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		execute "peer chaincode instantiate -o $ORDERER_ADDRESS -C $CHANNEL_NAME -n mycc -v 1.0 -c '{\"Args\":[\"init\",\"a\",\"100\",\"b\",\"200\"]}' -P \"OR	('$ORG1_MSP.member','$ORG2_MSP.member')\"" >&log.txt
	else
		execute "peer chaincode instantiate -o $ORDERER_ADDRESS --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n mycc -v 1.0 -c '{\"Args\":[\"init\",\"a\",\"100\",\"b\",\"200\"]}' -P \"OR	('$ORG1_MSP.member','$ORG2_MSP.member')\"" >&log.txt
	fi
	res=$?
	cat log.txt
	verifyResult $res "Chaincode instantiation on PEER$PEER on channel '$CHANNEL_NAME' failed"
	echo "===================== Chaincode Instantiation on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
	echo
}

chaincodeQuery () {
  PEER=$1
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
     execute "peer chaincode query -C $CHANNEL_NAME -n mycc -c '{\"Args\":[\"query\",\"a\"]}'" >&log.txt
     test $? -eq 0 && VALUE=$(cat log.txt | awk '/Query Result/ {print $NF}')
     test "$VALUE" = "$2" && let rc=0
  done
  echo
  cat log.txt
  if test $rc -eq 0 ; then
	echo "===================== Query on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
  else
	echo "!!!!!!!!!!!!!!! Query result on PEER$PEER is INVALID !!!!!!!!!!!!!!!!"
        echo "================== ERROR !!! FAILED to execute End-2-End Scenario =================="
	echo
	exit 1
  fi
}

chaincodeInvoke () {
	PEER=$1
	setGlobals $PEER
	# while 'peer chaincode' command can get the orderer endpoint from the peer (if join was successful),
	# lets supply it directly as we know it using the "-o" option
	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		execute "peer chaincode invoke -o $ORDERER_ADDRESS -C $CHANNEL_NAME -n mycc -c '{\"Args\":[\"invoke\",\"a\",\"b\",\"10\"]}'" >&log.txt
	else
		execute "peer chaincode invoke -o $ORDERER_ADDRESS --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA -C $CHANNEL_NAME -n mycc -c '{\"Args\":[\"invoke\",\"a\",\"b\",\"10\"]}'" >&log.txt
	fi
	res=$?
	cat log.txt
	verifyResult $res "Invoke execution on PEER$PEER failed "
	echo "===================== Invoke transaction on PEER$PEER on channel '$CHANNEL_NAME' is successful ===================== "
	echo
}

## Create channel
echo "Creating channel..."
createChannel

## Join all the peers to the channel
echo "Having all peers join the channel..."
joinChannel

## Set the anchor peers for each org in the channel
echo "Updating anchor peers for org1..."
#updateAnchorPeers 0
echo "Updating anchor peers for org2..."
#updateAnchorPeers 2

## Install chaincode on Peer0/Org1 and Peer2/Org2
echo "Installing chaincode on org1/peer0..."
installChaincode 0
echo "Install chaincode on org2/peer2..."
installChaincode 2

#Instantiate chaincode on Peer2/Org2
echo "Instantiating chaincode on org2/peer2..."
instantiateChaincode 2

#Query on chaincode on Peer0/Org1
echo "Querying chaincode on org1/peer0..."
chaincodeQuery 0 100

#Invoke on chaincode on Peer0/Org1
echo "Sending invoke transaction on org1/peer0..."
chaincodeInvoke 0

## Install chaincode on Peer3/Org2
echo "Installing chaincode on org2/peer3..."
installChaincode 3

#Query on chaincode on Peer3/Org2, check if the result is 90
echo "Querying chaincode on org2/peer3..."
chaincodeQuery 3 90

echo
echo "========= All GOOD, BYFN execution completed =========== "
echo

echo
echo " _____   _   _   ____   "
echo "| ____| | \ | | |  _ \  "
echo "|  _|   |  \| | | | | | "
echo "| |___  | |\  | | |_| | "
echo "|_____| |_| \_| |____/  "
echo

exit 0