require('@nomicfoundation/hardhat-toolbox')
require('hardhat-contract-sizer')

const rpcUrl = process.env.RPC_URL;
const accountKey = process.env.KEY;
module.exports = {
    defaultNetwork: 'localhost',
  networks: {
    hardhat: {
      gasPrice: 10000000000
    },
    localhost: {
        url: rpcUrl,
        timeout: 20000000
        },
    amoy: {
      url: rpcUrl,
      accounts: [accountKey,],
      chainId: 80002,
      gas: 8500000,
      gasPrice: 30000000000, // 30 Gwei
      timeout: 200000,
    },
    cardona: {
      url: rpcUrl,
      accounts:[accountKey,],
      chainId: 2442,
      gas: 15000000,
      gasPrice: 5,
      timeout: 200000,
    },
    zkEVM: {
      url: rpcUrl,
      accounts:[accountKey,],
      chainId: 1101,
      gas: 15000000,
      gasPrice: 5,
      timeout: 200000,
    },
    "base-mainnet": {
      url: rpcUrl,
      accounts:[accountKey,],
      chainId: 8453,
      gas: 15000000,
      gasPrice: 5000000,
      timeout: 200000,
    },
    sepolia: {
      url: rpcUrl,
      accounts: [accountKey,],
      chainId: 11155111,
      gas:8500000,
      timeout: 20000000
    },
    goerli: {
      url: rpcUrl,
      accounts: [accountKey,],
      chainId: 5,
      gas: 8500000,
      timeout: 20000000,
    }
  },
  mocha: {
    // timeout: 240000,
    // bail: true
  },
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1
      }
    }
  },
  paths: {
    sources: './contracts',
    cache: './cache'
  },
}