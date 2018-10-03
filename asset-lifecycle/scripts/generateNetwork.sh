#!/bin/sh

source $(pwd)/.env

export FABRIC_CFG_PATH=$(pwd)/network/config

if [ ! -d "./network/channel-artifacts" ]; then
  mkdir ./network/channel-artifacts
fi

echo "Download fabric-binary and extract them in ./bin directory"
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/master/scripts/bootstrap.sh | bash -s $FABRIC_TAG -d -s

echo "Generate certificates using cryptogen tool"
./bin/cryptogen generate --config=./network/config/crypto-config.yaml
mv crypto-config ./network/config/

echo "Generating Orderer Genesis block"
./bin/configtxgen -profile SingleOrgOrdererGenesis -outputBlock ./network/channel-artifacts/genesis.block

echo "Generating private configuration transaction"
./bin/configtxgen -profile SingleOrgChannel -outputCreateChannelTx ./network/channel-artifacts/private.tx -channelID private

echo "Generating trading configuration transaction"
./bin/configtxgen -profile SingleOrgChannel -outputCreateChannelTx ./network/channel-artifacts/trading.tx -channelID trading

echo "Generating sharing configuration transaction"
./bin/configtxgen -profile SingleOrgChannel -outputCreateChannelTx ./network/channel-artifacts/sharing.tx -channelID sharing

echo "Generating anchor peer update for Org1 on the channel: private"
./bin/configtxgen -profile SingleOrgChannel -outputAnchorPeersUpdate ./network/channel-artifacts/Org1MSPanchors-private.tx -channelID private -asOrg Org1MSP

echo "Generating anchor peer update for Org1 on the channel: trading"
./bin/configtxgen -profile SingleOrgChannel -outputAnchorPeersUpdate ./network/channel-artifacts/Org1MSPanchors-trading.tx -channelID trading -asOrg Org1MSP

echo "Generating anchor peer update for Org1 on the channel: sharing"
./bin/configtxgen -profile SingleOrgChannel -outputAnchorPeersUpdate ./network/channel-artifacts/Org1MSPanchors-sharing.tx -channelID sharing -asOrg Org1MSP

# remove the binaries
rm -rf ./bin
