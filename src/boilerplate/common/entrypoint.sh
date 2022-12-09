#! /bin/bash
while getopts "n:" arg; do
  case $arg in
    n)
      network=$OPTARG
      echo networkvalue $OPTARG 
      ;;
  esac
done
if($network == 'ganache')
then
while ! nc -z ganache ${BLOCKCHAIN_PORT}; do sleep 5; done
npx truffle compile --all && npx truffle migrate --network=development_ganache --reset
else
npx truffle compile --all && npx truffle migrate --network=matic --reset
fi