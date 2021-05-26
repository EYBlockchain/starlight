/* eslint-disable no-param-reassign, no-unused-vars */

import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs';
import { SyntaxUsageError } from '../../../error/errors.mjs';

/**
 * @desc:
 * Visitor looks for secret/public identifiers and marks functions, /
 * expressions, and variables as interactsWithSecret and/or interactsWithPublic
 */

// below visitors will only work with a small subtree - passing a whole AST is not advised!
// useful for subtrees like ExpressionStatements
const markSubtreeInteractsWithSecret = (thisPath, thisState) => {
  const { node, scope } = thisPath;
  if (node.nodeType !== 'Identifier') return;
  thisPath.interactsWithSecret = true;
  node.interactsWithSecret = true;
  const indicator = scope.getReferencedIndicator(node, true);
  if (indicator) indicator.updateInteractsWithSecret();
};

const markSubtreeInteractsWithPublic = (thisPath, thisState) => {
  const { node, scope } = thisPath;
  if (node.nodeType !== 'Identifier') return;
  thisPath.interactsWithPublic = true;
  node.interactsWithPublic = true;
  const indicator = scope.getReferencedIndicator(node, true);
  if (indicator) indicator.updateInteractsWithPublic();
};

export default {
  FunctionDefinition: {
    enter(path, state) {},

    exit(path, state) {
      for (const [index, ind] of Object.entries(path.scope.indicators)) {
        console.log('variable:', ind.name, 'in scope:', path.node.name);
        if (!ind.name) console.log(index);
        console.dir(ind, { depth: 0 });
        // if (ind.modifyingPaths) {
        //   console.log('variable:', ind.name, 'in scope:', path.node.name);
        //   console.log('interactsWithSecret:', ind.interactsWithSecret);
        //   console.log('interactsWithPublic:', ind.interactsWithPublic);
        //   ind.modifyingPaths.forEach(modPath => {
        //     console.log(modPath.node);
        //   });
        // }
      }
    },
  },

  FunctionCall: {
    enter(path, state) {},

    exit(path, state) {
      const { node, scope } = path;
      if (path.isExternalFunctionCall()) {
        path.markContainsPublic();
        // below ensures that the return value and args are marked as interactsWithPublic
        path.parentPath.traversePathsFast(markSubtreeInteractsWithPublic);
      }
    },
  },

  Identifier: {
    enter(path, state) {},

    exit(path, state) {
      const { node, scope } = path;
      if (!scope.getReferencedBinding(node)) return;
      const expressionPath = path.getAncestorOfType('ExpressionStatement');
      if (scope.getReferencedBinding(node).isSecret) {
        path.markContainsSecret();
        if (expressionPath)
          expressionPath.traversePathsFast(markSubtreeInteractsWithSecret);
      } else {
        path.markContainsPublic();
        if (expressionPath)
          expressionPath.traversePathsFast(markSubtreeInteractsWithPublic);
      }
    },
  },
};
