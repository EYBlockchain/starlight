module.exports = {
  log_level: 'info',
  zokrates: {
    url: process.env.ZOKRATES_URL || 'http://zokrates:80',
  },
  merkleTree: {
    url: process.env.TIMBER_URL || 'http://timber:80',
  },
  // merkle-tree stuff:
  ZERO: '0',
  HASH_TYPE: 'mimc',
  CURVE: 'ALT_BN_254',
  LEAF_HASHLENGTH: 32, // expected length of leaves' values in bytes
  NODE_HASHLENGTH: 32, // expected length of nodes' values up the merkle tree, in bytes
  POLLING_FREQUENCY: 6000, // milliseconds
  FILTER_GENESIS_BLOCK_NUMBER: 0, // blockNumber

  BN128_GROUP_ORDER: BigInt(
    '21888242871839275222246405745257275088548364400416034343698204186575808495617',
  ),
  BN128_PRIME_FIELD: BigInt(
    '21888242871839275222246405745257275088696311157297823662689037894645226208583',
  ),
  // the various parameters needed to describe the Babyjubjub curve
  // BABYJUBJUB
  // Montgomery EC form is y^2 = x^3 + Ax^2 + Bx
  // Montgomery EC form of BabyJubJub is y^2 = x^3 + 168698x^2 + x
  // A = 168698 and B = 1
  BABYJUBJUB: {
    JUBJUBA: BigInt(168700),
    JUBJUBD: BigInt(168696),
    INFINITY: [BigInt(0), BigInt(1)],
    GENERATOR: [
      BigInt(
        '16540640123574156134436876038791482806971768689494387082833631921987005038935',
      ),
      BigInt(
        '20819045374670962167435360035096875258406992893633759881276124905556507972311',
      ),
    ],
    JUBJUBE: BigInt(
      '21888242871839275222246405745257275088614511777268538073601725287587578984328',
    ),
    JUBJUBC: BigInt(8),
    MONTA: BigInt(168698),
    MONTB: BigInt(1),
  },

  tolerances: {
    LAG_BEHIND_CURRENT_BLOCK: 5, // add warnings for use of tree data which lags further behind the current block (e.g. due to anonymity concerns)
  },
  BULK_WRITE_BUFFER_SIZE: 1000, // number of documents to add to a buffer before bulk-writing them to the db
  contractOrigin: process.env.CONTRACT_LOCATION,
  // contracts to filter:
  contracts: {
    // contract name:
    AssignShield: {
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
  MONGO_URL: 'mongodb://admin:admin@zapp-mongo:27017',
  COMMITMENTS_DB: process.env.MONGO_NAME,
  COMMITMENTS_COLLECTION: 'commitments',
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
    // url: `${process.env.BLOCKCHAIN_HOST}:${process.env.BLOCKCHAIN_PORT}`,
    url: process.env.RPC_URL,
    rpcUrl: process.env.RPC_URL,
    defaultAccountMnemonic: process.env.DEFAULT_ACCOUNT_MNEMONIC,
    key: process.env.KEY,

    options: {
      // defaultAccount: '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      defaultAccount: process.env.DEFAULT_ACCOUNT,
      defaultGas: 5221975,
      defaultGasPrice: 20000000000,
      // defaultBlock: '0', // e.g. the genesis block our blockchain
      // defaultGas: 90000000,
      // defaultGasPrice: 20000000000,
      // transactionBlockTimeout: 50,
      // transactionConfirmationBlocks: 15,
      // transactionPollingTimeout: 480,
      // transactionSigner: new CustomTransactionSigner()
    },
  },
};
