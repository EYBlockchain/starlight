/* eslint-disable no-param-reassign, no-unused-vars */

import logger from '../../../utils/logger.js';
import backtrace from '../../../error/backtrace.js';
import { SyntaxUsageError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';

/**
 * @desc:
 * Visitor checks for errors in decorator usage and marks mappings with isKnown /
 * isUnknown
 */

export default {
  IndexAccess: {
    enter(path: NodePath) {
      const { node } = path;
      // node.isUnknown gets added during the 'parsing' stage
      // @Node new properties
      if (node.isUnknown) node.baseExpression.isUnknown = true;
      if (node.isKnown) node.baseExpression.isKnown = true;
      if (node.reinitialisable) node.baseExpression.reinitialisable = true;
    },
  },

  MemberAccess: {
    enter(path: NodePath) {
      const { node } = path;
      // node.isUnknown gets added during the 'parsing' stage
      // @Node new properties
      if (node.expression?.isUnknown) node.isUnknown = true;
      if (node.expression?.isKnown) node.isKnown = true;
      if (node.expression?.reinitialisable) node.reinitialisable = true;
    },
  },

  Identifier: {
    exit(path: NodePath) {
      const { node, scope } = path;
      if (path.isMsg()) return; // the node represents the special 'msg' type in solidity
      if (path.isThis()) return; // the node represents the special 'this' type in solidity
      if (path.isExportedSymbol()) return; // the node represents an external contract name
      if (path.isRequireStatement()) return;
      if (path.isRevertStatement()) return;
      if(path.isEventDefinition()) return;
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
