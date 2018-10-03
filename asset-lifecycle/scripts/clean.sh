#!/bin/bash

source $(pwd)/.env

docker rm -f -v $(docker ps -a | grep $FABRIC_TAG | awk '{print $1}') 2>/dev/null
docker rm -f -v $(docker ps -a | grep 'dev-peer' | awk '{print $1}') 2>/dev/null
docker rm -f -v $(docker ps -a | grep 'orderer' | awk '{print $1}') 2>/dev/null
docker rmi $(docker images -qf "dangling=true") 2>/dev/null
docker rmi $(docker images | grep "dev-" | awk "{print $1}") 2>/dev/null
docker rmi $(docker images | grep "^<none>" | awk "{print $3}") 2>/dev/null
exit 0
