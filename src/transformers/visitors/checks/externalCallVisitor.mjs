/* eslint-disable no-param-reassign, no-shadow, no-continue */

import logger from '../../../utils/logger.mjs';
import { ZKPError, TODOError } from '../../../error/errors.mjs';

/**
 * @desc:
 * Throws an error if secret states are passed to an external function call.
*/

export default {
  FunctionCall: {
    enter(path) {
      const { node, scope } = path;

      // TODO: `require` statements are 'FunctionCall' nodes, and they should be able to have secret states as arguments
      // TODO: FunctionCalls to functions within the same contract ought to be allowed (because all of the functions' logic can be transpiled to within a circuit)
      // TODO: FunctionCalls to base contracts (i.e. this contract `is` baseContract) ought to be allowed (because in such cases, the base contract effectively is part of the contract)
      // `address(...)` is considered a FunctionCall.
      // Initialisation of a contract instance is considered a FunctionCall.

      const args = node.arguments;
      for (const arg of args) {
        if (arg.nodeType !== 'Identifier') continue;
        const binding = scope.getReferencedBinding(arg);
        if (!binding?.isSecret) continue;
        if (node.kind === 'typeConversion')
          throw new TODOError(
            `Type conversions of secret states. We plan to suppport conversions which can be replicated in a zero-knowledge circuit in the near future.`,
            node,
          );
        if (node.kind === 'functionCall' && node.expression.name === 'require')
          throw new TODOError(
            `Require statements involving secret states. We plan to suppport these (by replicating them with Zokrates assert statements) in the near future.`,
            node,
          );

        if (
          node.kind === 'functionCall' &&
          node.expression.typeDescriptions.typeIdentifier.includes(`_external_`)
        )
          throw new ZKPError(
            `We cannot support external function calls with secret arguments - they can't be hidden due to the nature of the blockchain`,
            node,
          );
      }
    },
  },
};
