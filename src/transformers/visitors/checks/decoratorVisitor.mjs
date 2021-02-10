/* eslint-disable no-param-reassign */

import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs';

export default {
  IndexAccess: {
    enter(path, state) {
      const { node, parent } = path;
      // node.isUnknown gets added during the 'parsing' stage
      if (node.isUnknown) node.baseExpression.isUnknown = true;
      if (node.isKnown) node.baseExpression.isKnown = true;
    },

    exit(node, parent) {},
  },

  Identifier: {
    enter(path, state) {},

    exit(path, state) {
      const { node, scope, parent } = path;
      if (path.isMsg()) return; // the node represents the special 'msg' type in solidity
      const varDec = scope.getReferencedBinding(node);

      if (varDec.secretVariable && path.getAncestorContainedWithin('leftHandSide')) {
        // we have a parameter (at least, for now a secret non state var is a param)
        // TODO: why?
        throw new Error(`Cannot reassign secret function parameter ${node.name}.`);
      }

      if (!varDec.stateVariable) return;

      // node is decorated
      if (!varDec.isSecret && node.isUnknown) {
        backtrace.getSourceCode(varDec.node.src);
        backtrace.getSourceCode(node.src);
        throw new SyntaxError(
          `Identifier '${node.name}' is decorated as 'unknown' but is not decorated as 'secret'. Only secret states can be decorated as 'unknown'.`,
        );
      }

      if (!varDec.isSecret && node.isKnown) {
        backtrace.getSourceCode(varDec.node.src);
        backtrace.getSourceCode(node.src);
        logger.warn(
          `PEDANTIC: Superfluous 'known' decorator. A conventional smart contract state variable (${node.name}) is 'known' by its very nature.`,
        );
      }

      // Collect all paths which reference this variable throughout the contract.
      let refPaths;
      if (varDec.mappingKey) {
        refPaths = [];
        Object.keys(varDec.mappingKey).forEach(key => {
          varDec.mappingKey[key].referencingPaths.forEach(referencingPath => {
            refPaths.push(referencingPath);
          });
        });
      } else {
        refPaths = varDec.referencingPaths;
      }

      // TODO: doesn't this result in lots of duplicate checks, every time an Indicator is encountered? Shouldn't this loop happen at the 'binding' level, rather than at the 'per node' level?
      refPaths.forEach(p => {
        if ((p.node.isKnown && node.isUnknown) || (p.node.isUnknown && node.isKnown))
          throw new Error(`Identifier ${node.name} is marked as unknown and known.`);
      });

      if (node.isKnown) varDec.isKnown = node.isKnown;
      if (node.isUnknown) varDec.isUnknown = node.isUnknown;
    },
  },
};
