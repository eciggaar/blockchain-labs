#!/bin/bash

echo "Building PRIVATE chaincode.."
docker-compose run utils bash -c 'cp -rf chaincode/private/ /usr/src/app/src/ && cd src/private && GOPATH=$(pwd)/../.. go build'

echo "Building TRADING chaincode.."
docker-compose run utils bash -c 'cp -rf chaincode/trading/ /usr/src/app/src/ && cd src/trading && GOPATH=$(pwd)/../.. go build'

echo "Building SHARING chaincode.."
docker-compose run utils bash -c 'cp -rf chaincode/sharing/ /usr/src/app/src/ && cd src/sharing && GOPATH=$(pwd)/../.. go build'