module.exports = {
  globals: ['uint256', 'mapping'],
  functions: ['function', 'constructor'],
  sprinkles: ['secret', 'owned'],
  log_level: 'debug',
  account: '0x0',
  web3: {
    defaultGas: 10000000,
    defaultGasPrice: 20000000000,
  },
  zokrates: {
    url: 'http://zokrates:80',
  },
};
