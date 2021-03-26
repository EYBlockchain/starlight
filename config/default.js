module.exports = {
  // TODO: do we need this?
  types: ['uint256', 'mapping', 'address'],
  functionTypes: ['function', 'constructor', 'receive', 'fallback'],
  decorators: ['secret', 'known', 'unknown'],
  stateVisibility: ['public', 'private', 'internal'],
  stateMutability: ['', 'constant', 'immutable'],
  dataLocation: ['', 'calldata', 'memory', 'storage'],
  functionVisibility: ['public', 'private', 'internal', 'external'],
  functionModifiers: ['pure', 'view', 'payable', 'nonpayable'],
  functionOverrides: ['virtual', 'override'],
  log_level: 'info',
};
