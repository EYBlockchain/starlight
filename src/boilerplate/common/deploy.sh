#! /bin/bash
set -e
npx hardhat compile --show-stack-traces && npx hardhat run migrations/deploy.js 

