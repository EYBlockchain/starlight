/* eslint-disable import/no-cycle, no-use-before-define, no-continue, no-shadow, no-param-reassign */

/**
This file contains portions of code from Babel (https://github.com/babel/babel). All such code has been modified for use in this repository. See below for Babel's MIT license and copyright notice:

MIT License

Copyright (c) 2014-present Sebastian McKenzie and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * Traversers inspired by the Traverser in:
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

import logger from '../utils/logger.js';
import NodePath from './NodePath.js';
import CircuitNodePath from './CircuitNodePath.js';
import { getVisitableKeys } from '../types/solidity-types.js';
import { getCircuitVisitableKeys } from '../types/zokrates-types.js';

// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...
export function traverse(path: NodePath, visitor: any, state?: any) {
  logger.debug(
    'pathLocation:',
    `${path.getLocation()} = ${path.node.nodeType} ${path.node.name || ''}`,
  );

  if (state?.stopTraversal || state?.skipSubNodes) return;

  const { node } = path;
  const keys = getVisitableKeys(node.nodeType);
  if (!keys) return;

  const methods = visitor[node.nodeType];
  if (methods?.enter) {
    methods.enter(path, state);
    if (state?.stopTraversal) return;
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
        index: null,
        node: subNode,
        parentPath: path,
      });
      subNodePath.traverse(visitor, state);
    }
  }

  if (methods?.exit && !state?.skipSubNodes) methods.exit(path, state);
  if (state?.skipSubNodes) state.skipSubNodes = false;
}

// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...
export function circuittraverse(path: CircuitNodePath, visitor: any, state?: any) {
  logger.debug(
    'pathLocation:',
    ` ${path.node.nodeType} ${path.node.name || ''}`,
  );

  if (state?.stopTraversal || state?.skipSubNodes) return;

  const { node } = path;
  const keys = getCircuitVisitableKeys(node.nodeType);
  if (!keys) return;

  const methods = visitor[node.nodeType];
  if (methods?.enter) {
    methods.enter(path, state);
    if (state?.stopTraversal) return;
  }

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const [index, subNode] of subNodes.entries()) {
        if (!subNode) continue;
        const subNodePath = new CircuitNodePath({
          parent: node,
          node: subNode,
          parentPath: path,
        });
        subNodePath.circuittraverse(visitor, state);
      }
    } else if (node[key]) {
      const subNode = node[key];
      const subNodePath = new CircuitNodePath({
        parent: node,
        node: subNode,
        parentPath: path,
      });
      subNodePath.circuittraverse(visitor, state);
    }
  }

  if (methods?.exit && !state?.skipSubNodes) methods.exit(path, state);
  if (state?.skipSubNodes) state.skipSubNodes = false;
}


/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs.
 * @param {function} enter - a visitor function.
 */
export function traverseNodesFast(node: any, enter: any, state?: any): void {
  if (!node) return;
  if (state?.stopTraversal || state?.skipSubNodes) return;

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

  if (state?.skipSubNodes) state.skipSubNodes = false;
}

/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs.
 * @param {function} enter - a visitor function.
 */
export function circuittraverseNodesFast(node: any, enter: any, state?: any): void {
  if (!node) return;
  if (state?.stopTraversal || state?.skipSubNodes) return;

  const keys = getCircuitVisitableKeys(node.nodeType);
  if (!keys) return;

  enter(node, state);

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const subNode of subNodes) {
        circuittraverseNodesFast(subNode, enter, state);
      }
    } else if (node[key]) {
      const subNode = node[key];
      circuittraverseNodesFast(subNode, enter, state);
    }
  }

  if (state?.skipSubNodes) state.skipSubNodes = false;
}

/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs. Allows seperate enter() methods per node type.
 * @param {function} enter - a visitor function.
 */
export function traverseNodesFastVisitor(node: any, visitor: any, state?: any) {
  if (!node) return;
  if (state?.stopTraversal || state?.skipSubNodes) return;

  const keys = getVisitableKeys(node.nodeType);
  if (!keys) return;

  const methods = visitor[node.nodeType];
  if (methods?.enter) {
    methods.enter(node, state);
    if (state?.stopTraversal) return;
  }

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const subNode of subNodes) {
        traverseNodesFastVisitor(subNode, visitor, state);
      }
    } else if (node[key]) {
      const subNode = node[key];
      traverseNodesFastVisitor(subNode, visitor, state);
    }
  }

  if (state?.skipSubNodes) state.skipSubNodes = false;
}

export function circuittraverseNodesFastVisitor(node: any, visitor: any, state?: any) {
  if (!node) return;
  if (state?.stopTraversal || state?.skipSubNodes) return;

  const keys = getCircuitVisitableKeys(node.nodeType);
  if (!keys) return;

  const methods = visitor[node.nodeType];
  if (methods?.enter) {
    methods.enter(node, state);
    if (state?.stopTraversal) return;
  }

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const subNode of subNodes) {
        circuittraverseNodesFastVisitor(subNode, visitor, state);
      }
    } else if (node[key]) {
      const subNode = node[key];
      circuittraverseNodesFastVisitor(subNode, visitor, state);
    }
  }

  if (state?.skipSubNodes) state.skipSubNodes = false;
}

/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs.
 * @param {function} enter - a visitor function.
 */
export function traversePathsFast(path: NodePath, enter: any, state?: any) {
  if (!path) return;
  if (state?.stopTraversal || state?.skipSubNodes) return;

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
        index: null,
        node: subNode,
        parentPath: path,
      });
      traversePathsFast(subNodePath, enter, state);
    }
  }

  if (state?.skipSubNodes) state.skipSubNodes = false;
}
export function circuittraversePathsFast(path: CircuitNodePath, enter: any, state?: any) {
  if (!path) return;
  if (state?.stopTraversal || state?.skipSubNodes) return;

  const keys = getCircuitVisitableKeys(path.node.nodeType);
  if (!keys) return;

  enter(path, state);

  const { node } = path;

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const [index, subNode] of subNodes.entries()) {
        if (!subNode) continue;
        const subCircuitNodePath = new CircuitNodePath({
          parent: node,
          node: subNode,
          parentPath: path,
        });
        circuittraversePathsFast(subCircuitNodePath, enter, state);
      }
    } else if (node[key]) {
      const subNode = node[key];
      const subCircuitNodePath = new CircuitNodePath({
        parent: node,
        node: subNode,
        parentPath: path,
      });
      circuittraversePathsFast(subCircuitNodePath, enter, state);
    }
  }

  if (state?.skipSubNodes) state.skipSubNodes = false;
}
