#! /bin/bash
if [ -z "${GETH_DEPLOYMENT}" ]; then
  while ! nc -z ganache ${BLOCKCHAIN_PORT}; do sleep 5; done
fi
npx truffle compile --all && npx truffle migrate --network=${NETWORK} --reset
