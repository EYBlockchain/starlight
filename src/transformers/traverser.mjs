/* eslint-disable no-use-before-define, no-continue, no-shadow */

import logger from '../utils/logger.mjs';
// import * as solidityTypes from '../types/solidity-types.mjs';
import { getVisitableKeys } from '../types/solidity-types.mjs';

/**
 * Edited from the Super Tiny compiler (updating it to traverse a Solidity ast):
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...
function traverse(node, parent, visitor, state) {
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

    methods.enter(node, parent, state);

    // logger.debug(`\n\n\n\n${node.nodeType} after enter`);
    // logger.debug('node._context:', node._context);
    // if (parent) logger.debug('parent._context:', parent._context);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');
  }

  for (const key of keys) {
    const subNode = node[key];

    if (Array.isArray(subNode)) {
      for (let i = 0; i < subNode.length; i++) {
        const child = subNode[i];
        if (!child) continue;

        // ancestors.push({
        //   node,
        //   key,
        //   index: i,
        // });

        traverse(child, node, visitor, state);

        // ancestors.pop();
      }
    } else if (subNode) {
      // ancestors.push({
      //   node,
      //   key,
      // });

      traverse(subNode, node, visitor, state);

      // ancestors.pop();
    }
  }

  // If there is an `exit` method for this node type we'll call it with the
  // `node` and its `parent`.
  if (methods && methods.exit) {
    // logger.debug('\n\n\n\n*************************************************');
    // logger.debug(`${node.nodeType} before exit`);
    // logger.debug('node._context:', node._context);
    // if (parent) logger.debug('parent._context:', parent._context);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');

    methods.exit(node, parent, state);

    // logger.debug(`\n\n\n\n${node.nodeType} after exit`);
    // logger.debug('node._context:', node._context);
    // if (parent) logger.debug('parent._context:', parent._context);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');
  }
}

export default traverse;
