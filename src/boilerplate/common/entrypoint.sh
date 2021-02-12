#! /bin/bash
while ! nc -z ganache ${BLOCKCHAIN_PORT}; do sleep 5; done
npx truffle migrate --network=development_ganache --reset
