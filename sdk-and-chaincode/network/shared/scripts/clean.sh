#!/bin/sh
docker rm -f `docker ps -aq`
docker rmi $(docker images | grep '<none>' | awk '{print $3}')
docker rmi $(docker images | grep 'dev-' | awk '{print $3}')

exit 0