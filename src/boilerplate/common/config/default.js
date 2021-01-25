module.exports = {
  log_level: 'debug',
  zokrates: {
    url: 'http://zokrates:80',
  },
  merkleTree: {
    url: 'http://timber:80',
  },
  // merkle-tree stuff:
  ZERO: '0',
  HASH_TYPE: 'mimc',
  CURVE: 'ALT_BN_254',
  LEAF_HASHLENGTH: 32, // expected length of leaves' values in bytes
  NODE_HASHLENGTH: 32, // expected length of nodes' values up the merkle tree, in bytes
  POLLING_FREQUENCY: 6000, // milliseconds
  FILTER_GENESIS_BLOCK_NUMBER: 0, // blockNumber

  tolerances: {
    LAG_BEHIND_CURRENT_BLOCK: 5, // add warnings for use of tree data which lags further behind the current block (e.g. due to anonymity concerns)
  },
  BULK_WRITE_BUFFER_SIZE: 1000, // number of documents to add to a buffer before bulk-writing them to the db
  contractOrigin: process.env.CONTRACT_LOCATION,
  // contracts to filter:
  contracts: {
    // contract name:
    CONTRACT_NAME: {
      treeHeight: 32,
      events: {
        // filter for the following event names:
        NewLeaf: {
          // filter for these event parameters:
          parameters: ['leafIndex', 'leafValue'],
        },
        NewLeaves: {
          // filter for these event parameters:
          parameters: ['minLeafIndex', 'leafValues'],
        },
      },
    },
  },
  // mongodb:
  // TODO: The latest Timber image has been edited... not sure how to create a 'user' for Timber anymore...
  mongo: {
    host: 'timber-mongo',
    port: '27017',
    databaseName: 'merkle_tree',
    admin: 'admin',
    adminPassword: 'admin',
  },
  isLoggerEnabled: true,
  // web3:
  deployer: {
    host: process.env.BLOCKCHAIN_HOST,
    port: process.env.BLOCKCHAIN_PORT,
  },
  // web3:
  web3: {
    host: process.env.BLOCKCHAIN_HOST,
    port: process.env.BLOCKCHAIN_PORT,
    url: `${process.env.BLOCKCHAIN_HOST}:${process.env.BLOCKCHAIN_PORT}`,

    options: {
      defaultAccount: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      defaultBlock: '0', // e.g. the genesis block our blockchain
      defaultGas: 90000000,
      defaultGasPrice: 20000000000,
      transactionBlockTimeout: 50,
      transactionConfirmationBlocks: 15,
      transactionPollingTimeout: 480,
      // transactionSigner: new CustomTransactionSigner()
    },
  },
};
