/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.mjs';

/**
 * @desc:
 * Throws an error if secret states are passed to an external function call.
*/

export default {
  FunctionCall: {
    enter(path, state) {
      const { node, parent, scope } = path;

      // TODO: `require` statements are 'FunctionCall' nodes, and they should be able to have secret states as arguments
      // TODO: FunctionCalls to functions within the same contract ought to be allowed (because all of the functions' logic can be transpiled to within a circuit)
      // TODO: FunctionCalls to base contracts (i.e. this contract `is` baseContract) ought to be allowed (because in such cases, the base contract effectively is part of the contract)
      // `address(...)` is considered a FunctionCall.
      // Initialisation of a contract instance is considered a FunctionCall.

      const args = node.arguments;
      args.forEach(arg => {
        if (arg.name === 'this') return; // you won't find a binding for such a special reference
        const binding = arg.referencedDeclaration ? scope.getReferencedBinding(arg) : {}; // TODO: what does getReferencedBinding return if it's passed something without a referencedDeclaration property? It should return null.
        if (binding?.isSecret)
          throw new Error(
            `Cannot pass a secret state (${binding.name}) to an external function call.`,
          );
      });
    },

    exit(path, state) {},
  },
};
