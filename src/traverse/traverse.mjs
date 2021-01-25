/* eslint-disable import/no-cycle, no-use-before-define, no-continue, no-shadow, no-param-reassign */

import logger from '../utils/logger.mjs';
import NodePath from './NodePath.mjs';
import { getVisitableKeys } from '../types/solidity-types.mjs';

// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...
export function traverse(path, visitor, state = {}) {
  logger.debug(
    'pathLocation:',
    `${path.getLocation()} = ${path.node.nodeType} ${path.node.name || ''}`,
  );

  if (state && state.stopTraversal) return;
  if (state && state.skipSubNodes) return;

  const { node } = path;
  const keys = getVisitableKeys(node.nodeType);
  if (!keys) return;

  const methods = visitor[node.nodeType];

  // If there is an `enter` method for this node type we'll call it with the
  // `node` and its `parent`.
  if (methods && methods.enter) {
    // logger.debug('\n\n\n\n************************************************');
    // logger.debug(`${node.nodeType} before enter`);
    // logger.debug('node._newASTPointer:', node._newASTPointer);
    // if (parent) logger.debug('parent._newASTPointer:', parent._newASTPointer);
    // logger.debug('state:', state);
    methods.enter(path, state);

    // logger.debug(`\n\n\n\n${node.nodeType} after enter`);
    // logger.debug('node._newASTPointer:', node._newASTPointer);
    // if (parent) logger.debug('parent._newASTPointer:', parent._newASTPointer);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');
  }

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const [index, subNode] of subNodes.entries()) {
        if (!subNode) continue;
        const subNodePath = new NodePath({
          parent: node,
          key,
          container: subNodes,
          index,
          node: subNode,
          parentPath: path,
        });
        subNodePath.traverse(visitor, state);
      }
    } else if (node[key]) {
      const subNode = node[key];
      const subNodePath = new NodePath({
        parent: node,
        key,
        container: subNode,
        node: subNode,
        parentPath: path,
      });
      subNodePath.traverse(visitor, state);
    }
  }

  if (state && state.skipSubNodes) state.skipSubNodes = false;

  // If there is an `exit` method for this node type we'll call it with the
  // `node` and its `parent`.
  if (methods && methods.exit) {
    // logger.debug('\n\n\n\n*************************************************');
    // logger.debug(`${node.nodeType} before exit`);
    // logger.debug('node._newASTPointer:', node._newASTPointer);
    // if (parent) logger.debug('parent._newASTPointer:', parent._newASTPointer);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');

    methods.exit(path, state);

    // logger.debug(`\n\n\n\n${node.nodeType} after exit`);
    // logger.debug('node._newASTPointer:', node._newASTPointer);
    // if (parent) logger.debug('parent._newASTPointer:', parent._newASTPointer);
    // logger.debug('state:', state);
    // logger.debug('*************************************************');
  }
}

/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs.
 * @param {function} enter - a visitor function.
 */
export function traverseNodesFast(node, enter, state = {}) {
  if (!node) return;
  if (state && state.stopTraversal) return;
  if (state && state.skipSubNodes) return;

  const keys = getVisitableKeys(node.nodeType);
  if (!keys) return;

  enter(node, state);

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const subNode of subNodes) {
        traverseNodesFast(subNode, enter, state);
      }
    } else if (node[key]) {
      const subNode = node[key];
      traverseNodesFast(subNode, enter, state);
    }
  }

  if (state && state.skipSubNodes) state.skipSubNodes = false;
}

/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs.
 * @param {function} enter - a visitor function.
 */
export function traversePathsFast(path, enter, state = {}) {
  if (!path) return;
  if (state && state.stopTraversal) return;
  if (state && state.skipSubNodes) return;

  const keys = getVisitableKeys(path.node.nodeType);
  if (!keys) return;

  enter(path, state);

  const { node } = path;

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const [index, subNode] of subNodes.entries()) {
        if (!subNode) continue;
        const subNodePath = new NodePath({
          parent: node,
          key,
          container: subNodes,
          index,
          node: subNode,
          parentPath: path,
        });
        traversePathsFast(subNodePath, enter, state);
      }
    } else if (node[key]) {
      const subNode = node[key];
      const subNodePath = new NodePath({
        parent: node,
        key,
        container: subNode,
        node: subNode,
        parentPath: path,
      });
      traversePathsFast(subNodePath, enter, state);
    }
  }

  if (state && state.skipSubNodes) state.skipSubNodes = false;
}
