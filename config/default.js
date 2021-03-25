module.exports = {
  globals: ['uint256', 'mapping', 'address'], // to deprecate
  types: ['uint256', 'mapping', 'address'],
  functionTypes: ['function', 'constructor', 'receive', 'fallback'],
  decorators: ['secret', 'known', 'unknown'],
  stateVisibility: ['public', 'private', 'internal'],
  stateMutability: ['', 'constant', 'immutable'],
  dataLocation: ['', 'calldata', 'memory', 'storage'],
  functionVisibility: ['public', 'private', 'internal', 'external'],
  functionModifiers: ['pure', 'view', 'payable', 'nonpayable'],
  functionOverrides: ['virtual', 'override'],
  log_level: 'verbose',
};
