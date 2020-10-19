/* eslint-disable no-use-before-define, no-continue, no-shadow, no-param-reassign */

import logger from '../utils/logger.mjs';
// import * as solidityTypes from '../types/solidity-types.mjs';
import { getVisitableKeys, setParentPath } from '../types/solidity-types.mjs';

/**
 * Edited from the Super Tiny compiler (updating it to traverse a Solidity ast):
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...
export default function traverse(node, parent, visitor, state, scope) {
  if (state && state.stopTraversal) return;
  if (state && state.skipSubNodes) return;

  const keys = getVisitableKeys(node.nodeType);
  if (!keys) return;

  const methods = visitor[node.nodeType];

  // If there is an `enter` method for this node type we'll call it with the
  // `node` and its `parent`.
  if (methods && methods.enter) {
    // logger.debug('\n\n\n\n************************************************');
    // logger.debug(`${node.nodeType} before enter`);
    // logger.debug('node._context:', node._context);
    // if (parent) logger.debug('parent._context:', parent._context);
    // logger.debug('state:', state);

    methods.enter(node, parent, state, scope);

    // parentPath example placement:
    // setParentPath(node, parent);
    // logger.debug('path', node.parentPath);

    // logger.debug(`\n\n\n\n${node.nodeType} after enter`);
    // logger.debug('node._context:', node._context);
    // if (parent) logger.debug('parent._context:', parent._context);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');
  }

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const subNode of subNodes) {
        if (!subNode) continue;

        // ancestors.push({
        //   node,
        //   key,
        //   index: i,
        // });

        traverse(subNode, node, visitor, state, scope);

        // ancestors.pop();
      }
    } else if (node[key]) {
      const subNode = node[key];
      // ancestors.push({
      //   node,
      //   key,
      // });

      traverse(subNode, node, visitor, state, scope);

      // ancestors.pop();
    }
  }

  if (state && state.skipSubNodes) state.skipSubNodes = false;

  // If there is an `exit` method for this node type we'll call it with the
  // `node` and its `parent`.
  if (methods && methods.exit) {
    // logger.debug('\n\n\n\n*************************************************');
    // logger.debug(`${node.nodeType} before exit`);
    // logger.debug('node._context:', node._context);
    // if (parent) logger.debug('parent._context:', parent._context);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');

    methods.exit(node, parent, state, scope);

    // logger.debug(`\n\n\n\n${node.nodeType} after exit`);
    // logger.debug('node._context:', node._context);
    // if (parent) logger.debug('parent._context:', parent._context);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');
  }
}
