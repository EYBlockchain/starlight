/* eslint-disable no-param-reassign, no-unused-vars */

import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs';
import { SyntaxUsageError } from '../../../error/errors.mjs';

/**
 * @desc:
 * Visitor checks for errors in decorator usage and marks mappings with isKnown /
 * isUnknown
 */

export default {
  IndexAccess: {
    enter(path, state) {
      const { node, parent } = path;
      // node.isUnknown gets added during the 'parsing' stage
      // @Node new properties
      if (node.isUnknown) node.baseExpression.isUnknown = true;
      if (node.isKnown) node.baseExpression.isKnown = true;
      if (node.reinitialisable) node.baseExpression.reinitialisable = true;
    },

    exit(node, parent) {},
  },

  Identifier: {
    enter(path, state) {},

    exit(path, state) {
      const { node, scope, parent } = path;
      if (path.isMsg()) return; // the node represents the special 'msg' type in solidity
      if (path.isThis()) return; // the node represents the special 'this' type in solidity
      if (path.isExportedSymbol()) return; // the node represents an external contract name
      if (path.isRequireStatement()) return;

      const varDec = scope.getReferencedBinding(node);

      if (!varDec.stateVariable) return;

      // node is decorated
      if (!varDec.isSecret && node.isUnknown) {
        throw new SyntaxUsageError(
          `Identifier '${node.name}' is decorated as 'unknown' but is not decorated as 'secret'. Only secret states can be decorated as 'unknown'.`,
          node,
        );
      }

      // node is decorated
      if (!varDec.isSecret && node.reinitialisable) {
        throw new SyntaxUsageError(
          `Identifier '${node.name}' is decorated as 'reinitialisable' but is not decorated as 'secret'. Only secret states can be decorated as 'reinitialisable'.`,
          node,
        );
      }

      if (!varDec.isSecret && node.isKnown) {
        backtrace.getSourceCode(varDec.node.src);
        backtrace.getSourceCode(node.src);
        logger.warn(
          `PEDANTIC: Superfluous 'known' decorator. A conventional smart contract state variable (${node.name}) is 'known' by its very nature.`,
        );
      }

      if (
        (varDec.isKnown && node.isUnknown) ||
        (varDec.isUnknown && node.isKnown)
      )
        throw new SyntaxUsageError(
          `Variable ${node.name} is marked as both unknown and known. Try removing 'known' from decremented states`,
          node,
        );

      if (varDec.isUnknown && node.reinitialisable)
        throw new SyntaxUsageError(
          `Variable ${node.name} is marked as both unknown and reinitialisable. You must know a state's value to be able to initialise it!`,
          node,
        );

      // @Binding new properties
      if (node.isKnown) varDec.isKnown = node.isKnown;
      if (node.isUnknown) varDec.isUnknown = node.isUnknown;
    },
  },
};
