#!/bin/sh

source $(pwd)/.env

hash docker || (echo "Please install docker first"; exit 1;)
hash docker-compose || (echo "Please install docker-compose first"; exit 1;)

dockerFabricPull() {
  for IMAGES in peer orderer ccenv tools; do
      echo "==> FABRIC IMAGE: $IMAGES"
      echo
      docker pull hyperledger/fabric-$IMAGES:$FABRIC_TAG
      docker tag hyperledger/fabric-$IMAGES:$FABRIC_TAG hyperledger/fabric-$IMAGES
  done
}

dockerThirdPartyImagesPull() {
  for IMAGES in couchdb kafka zookeeper; do
      echo "==> THIRDPARTY DOCKER IMAGE: $IMAGES"
      echo
      docker pull hyperledger/fabric-$IMAGES:$THIRDPARTY_TAG
      docker tag hyperledger/fabric-$IMAGES:$THIRDPARTY_TAG hyperledger/fabric-$IMAGES
  done
}

dockerCaPull() {
      echo "==> FABRIC CA IMAGE"
      echo
      docker pull hyperledger/fabric-ca:$CA_TAG
      docker tag hyperledger/fabric-ca:$CA_TAG hyperledger/fabric-ca
}

echo "Pulling Fabric images..."
dockerFabricPull

echo "Pulling third party images"
dockerThirdPartyImagesPull

echo "Pulling CA image"
dockerCaPull

echo "Creating docker network"
docker network create $NETWORK_NAME 2>/dev/null 

echo "

Done! Start with:
docker-compose up -d

You can clean your environment anytime with:
./script/clean.sh

Enjoy :)"