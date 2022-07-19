/* eslint-disable no-param-reassign, no-shadow, import/no-cycle */

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

import {
  circuittraverse,
  circuittraverseNodesFast,
  circuittraversePathsFast
} from './traverse.js';
import logger from '../utils/logger.js';
import backtrace from '../error/backtrace.js';
import { pathCache } from './cache.js';
import { Scope } from './Scope.js';
import { Binding } from './Binding.js';


/**
A NodePath is required as a way of 'connecting' a node to its parent (and its parent, and so on...). We can't assign a `.parent` to a `node` (to create `node.parent`), because we'd end up with a cyclic reference; the parent already contains the node, so the node can't then contain the parent!
The solution: wrap both the node and the parent in a class.
*/
export default class CircuitNodePath {
  /**
  @param {Object} node - the node of a tree
  @param {Object} parent - the parent of the node (itself a node)
  @param {NodePath} parentPath - OPTIONAL - since a parentPath won't exist for the top-most node of the tree.
  */
  node: any;
  nodeType: string;
  parent: any;
  parentPath: CircuitNodePath;

  constructor({ node, parent, parentPath }) {
    if (pathCache.has(node)) return pathCache.get(node);

    CircuitNodePath.validateConstructorArgs({
      node,
      parent,
      // parentPath,
    });

    this.node = node;
    this.parent = parent;
    this.parentPath = parentPath || null;

    this.nodeType = this.node.nodeType;

    pathCache.set(node, this);
  }

  static validateConstructorArgs({
    node,
    parent,
    // parentPath,
  }) {
    if (!parent) throw new Error(`Can't create a path without a parent`);
    if (!node) throw new Error(`Can't create a path without a node`);
  }

  circuittraverse(visitor: any, state: any): void {
    circuittraverse(this, visitor, state);
  }

  circuitraversePathsFast(enter: Function, state: any): void {
    circuittraversePathsFast(this, enter, state);
  }

  circuittraverseNodesFast(enter: Function, state: any): void {
    circuittraverseNodesFast(this.node, enter, state);
  }

  static getPath(node: any) {
    if (pathCache.has(node)) return pathCache.get(node);
    throw new Error('Node not found in pathCache');
  }


  // ANCESTRY:

  /**
   * Starting at current `path` and going up the tree, return the first
   * `path` that causes the provided `callback` to return a truthy value,
   * or `null` if the `callback` never returns a truthy value.
   * @return {NodePath || null}
   */
  findAncestor(callback: any): CircuitNodePath | null {
    let path: CircuitNodePath = this;
    do {
      if (callback(path)) return path;
    } while ((path = path.parentPath));
    return null;
  }

  /**
   * Same as findAncestor, but starting at this path's parent.
   * @return {NodePath || null}
   */
  findAncestorFromParent(callback: any): CircuitNodePath | null {
    let path: CircuitNodePath = this;
    while ((path = path.parentPath)) {
      if (callback(path)) return path;
    }
    return null;
  }

  /**
   * Starting at current `path` and going up the tree, execute a callback at
   * each ancestor node.
   * The callback must return something falsey if it can't find what it's
   * looking for. Otherwise, (if it finds what it's looking for) it can return
   * whatever it wants.
   * @returns { ? || falsey} - depends on the callback
   */
  queryAncestors(callback: any): any {
    const path = this || null;
    if (!path) return null; // No more paths to look at. So not found anywhere.
    return (
      callback(path) || (path.parentPath?.queryAncestors(callback) ?? null)
    );
  }

  /**
   * Build an array of node paths containing the entire ancestry of the current node path.
   *
   * NOTE: The current node path is included in this.
   * @returns {Array[NodePath]}
   */
  getAncestry(): CircuitNodePath[] {
    let path: CircuitNodePath = this;
    const paths = [];
    do {
      paths.push(path);
    } while ((path = path.parentPath));
    return paths;
  }

  /**
   * A helper to find if `this` path is an ancestor of @param {NodePath} maybeDescendant
   * @returns {Boolean}
   */
  isAncestor(maybeDescendant: CircuitNodePath): boolean {
    return maybeDescendant.isDescendant(this);
  }

  /**
   * A helper to find if `this` path is a descendant of @param {NodePath} maybeAncestor
   * @returns {Boolean}
   */
  isDescendant(maybeAncestor: CircuitNodePath): boolean {
    return !!this.findAncestorFromParent((path: CircuitNodePath) => path === maybeAncestor);
  }

  // SIBLINGS

  // getSiblingNode(index: any) {
  //   if (!this.inList) return null;
  //   return this.container[index];
  // }
  //
  // /* includes self */
  // getSiblingNodes() {
  //   if (!this.inList) return null;
  //   return this.container;
  // }
  //
  // getFirstSiblingNode() {
  //   if (!this.inList) return null;
  //   return this.container[0];
  // }
  //
  // getLastSiblingNode() {
  //   if (!this.inList) return null;
  //   return this.container[this.container.length - 1];
  // }
  //
  // getPrevSiblingNode() {
  //   return this.getSiblingNode(this.key as number - 1);
  // }
  //
  // getNextSiblingNode() {
  //   return this.getSiblingNode(this.key as number + 1);
  // }
  //
  // getAllNextSiblingNodes() {
  //   if (!this.inList) return null;
  //   let { index } = this;
  //   let sibling = this.getSiblingNode(++index);
  //   const siblings = [];
  //   while (sibling) {
  //     siblings.push(sibling);
  //     sibling = this.getSiblingNode(++index);
  //   }
  //   return siblings;
  // }
  //
  // getAllPrevSiblingNodes() {
  //   if (!this.inList) return null;
  //   let { index } = this;
  //   let sibling = this.getSiblingNode(--index);
  //   const siblings = [];
  //   while (sibling) {
  //     siblings.push(sibling);
  //     sibling = this.getSiblingNode(--index);
  //   }
  //   return siblings;
  // }
  //

  // SEARCHES for specific nodeTypes:

  /**
   * @param {string} nodeType - a valid Solidity nodeType.
   * Get the first @return {NodePath || null} matching the given nodeType, in which `this` is contained (including `this` in the search).
   */
  getAncestorOfType(nodeType: string): CircuitNodePath | null {
    return this.findAncestor((path: CircuitNodePath) => path.node.nodeType === nodeType);
  }



  /**
   * Callable from any nodeType below (or equal to) a 'ContractDefinition' node.
   * @returns {NodePath || null} the parameters of the function.
   */
  getContractDefinition(node: any = this.node): CircuitNodePath | null {
    const path = CircuitNodePath.getPath(node);
    return path.getAncestorOfType('ContractDefinition') || null;
  }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {NodePath || null} the parameters of the function.
   */
  getFunctionDefinition(node: any = this.node): CircuitNodePath | null {
    const path = CircuitNodePath.getPath(node);
    return path.getAncestorOfType('FunctionDefinition') || null;
  }

  /**
   * Callable from a ContractDefinition node only
   * @returns {Array[String] || null} the parameters of the function.
   */
  // getFunctionNames(contractDefinitionNode = this.node): string[] | null {
  //   if (contractDefinitionNode.nodeType !== 'ContractDefinition') return null;
  //   const entryVisitor = (node: any, state: any) => {
  //     if (node.nodeType !== 'FunctionDefinition') return;
  //     state.functionNames.push(node.name);
  //     state.skipSubNodes = true;
  //   };
  //   const state = { functionNames: [], skipSubNodes: false };
  //   CircuittraverseNodesFast(contractDefinitionNode, entryVisitor, state);
  //   return state.functionNames;
  // }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {Array[Node] || null} the parameters of the function.
   */
  getFunctionParameters(): any[] | null {
    const functionDefinition = this.getAncestorOfType('FunctionDefinition');
    return functionDefinition?.node?.parameters?.parameters ?? null;
  }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {Array[Node] || null} the parameters of the function.
   */
  getFunctionReturnParameters(): any[] | null {
    const functionDefinition = this.getAncestorOfType('FunctionDefinition');
    return functionDefinition?.node?.returnParameters?.parameters ?? null;
  }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {Array[Node] || null} the statements of the function.
   */
  getFunctionBodyStatements(): any[] | null {
    const functionDefinition = this.getAncestorOfType('FunctionDefinition');
    return functionDefinition?.node?.body?.statements ?? null;
  }

  /**
   * Returns whether `this` is of a particular nodeType
   * @param {String} nodeType
   * @returns {Boolean}
   */
  isNodeType(nodeType: string): boolean {
    return this.node.nodeType === nodeType;
  }



  /**
   * A helper to find if `this` path is in a rightHandSide container or another container which requires the value of`this` to be accessed
   * @returns {NodePath || String || Boolean}
   */
  getRhsAncestor(onlyReturnContainerName:boolean = false): CircuitNodePath | string | boolean {
    // NB ordering matters. An identifier can exist in an arguments container which itself is in an initialValue container. We want the parent.
    const rhsContainers = [
      'rightHandSide',
      'initialValue', // as arg
      'trueExpression', // a conditional requires value accessing
      'falseExpression',
      'indexExpression', // as arg
      'subExpression',
      'rightExpression',
      'arguments', // a value used as an arg needs to be accessed
    ];
    for (const container of rhsContainers) {
      const ancestor = this.getAncestorOfType(container);
      if (ancestor && !onlyReturnContainerName) return ancestor;
      if (ancestor && onlyReturnContainerName) return container;
    }
    return false;
  }

  /**
   * A helper to find if `this` path is in a leftHandSide container or another container which requires the value of`this` to be modified
   * @returns {NodePath || String || Boolean}
   */
  getLhsAncestor(onlyReturnContainerName:boolean = false): CircuitNodePath | string | boolean {
    // NB ordering matters. An identifier can exist in an arguments container which itself is in an initialValue container. We want the parent.
    const lhsContainers = [
      'leftHandSide',
      'declarations',
      'subExpression',
      'leftExpression',
    ];
    for (const container of lhsContainers) {
      const ancestor = this.getAncestorOfType(container);
      if (ancestor && !onlyReturnContainerName) return ancestor;
      if (ancestor && onlyReturnContainerName) return container;
    }
    return false;
  }

  /**
   * A getter to return the node corresponding to the LHS of a path in a RHS container
   * @returns {Object || null || Boolean}
   */
  getCorrespondingLhsNode(): any {
    const rhsContainer = this.getRhsAncestor(true);
    let parent : CircuitNodePath;

    switch (rhsContainer) {
      case 'rightHandSide':
        parent = this.getAncestorOfType('Assignment');
        return parent.node.leftHandSide;
      case 'initialValue':
        parent = this.getAncestorOfType('VariableDeclarationStatement');
        return parent.node.declarations[0];
      case 'subExpression':
        // a++ - assigning itself
        return this.node;
      case 'rightExpression':
        // TODO there may be nested binops, so this may not be the 'true' parent lhs
        parent = this.getAncestorOfType('BinaryOperation');
        return parent.node.leftExpression;
      case 'arguments': // a value used as an arg needs to be accessed
        parent = this.getAncestorOfType('FunctionCall');
        return parent.node.declarations?.[0] || false;
      case 'trueExpression': // no assigment => no LHS
      case 'falseExpression':
      case 'indexExpression':
        return false; // no assignment occurs
      default:
        return null; // this is not a RHS container
    }
  }

  /**
   * A getter to return the node corresponding to the RHS of a path in a LHS container
   * @returns {Object || null || Boolean}
   */
  getCorrespondingRhsNode(): any {
    const lhsContainer = this.getLhsAncestor(true);
    let parent: CircuitNodePath;
    switch (lhsContainer) {
      case 'leftHandSide':
        parent = this.getAncestorOfType('Assignment');
        return parent.node.rightHandSide;
      case 'declarations':
        parent = this.getAncestorOfType('VariableDeclarationStatement');
        return parent.node.initialValue;
      case 'subExpression':
        // a++ - assigning itself
        return this.node;
      case 'leftExpression':
        // TODO there may be nested binops, so this may not be the 'true' parent lhs
        parent = this.getAncestorOfType('BinaryOperation');
        return parent.node.rightExpression;
      default:
        return null; // this is not a RHS container
    }
  }

  /**
   * Is this path.node a 'Statement' type?
   * @returns {Boolean}
   */
  isStatement(): boolean {
    const statementNodeTypes = [
      'ExpressionStatement',
      'VariableDeclarationStatement',
      'ImportStatementList',
      'ImportStatement',
    ];
    return statementNodeTypes.includes(this.nodeType);
  }

  /**
   * Is this path.node a 'Statement' type which is _within_ a function's body?
   * @returns {Boolean}
   */
  isFunctionBodyStatement(): boolean {
    return this.nodeType === 'statements';
  }

  /**
   * Is this path.node a descendant of a statement which is _within_ a function's body?
   * @returns {Boolean}
   */
  isInFunctionBodyStatement(): boolean {
    return !!this.queryAncestors((path: CircuitNodePath) => path.isFunctionBodyStatement());
  }

  isFunctionParameterDeclaration(): boolean {
    const functionParameters = this.getFunctionParameters();
    return functionParameters?.some(node => node === this.node);
  }

  isFunctionParameter(node: any = this.node): boolean  {
  return this.nodeType === 'Parameters';
  }

  isFunctionReturnParameterDeclaration(): boolean {
    return (
      this.parent.nodeType === 'ParameterList' &&
      this.parent.containerName === 'returnParameters'
    );
  }

  // isFunctionReturnParameter(node: any = this.node): boolean {
  //
  //   const referencedBinding = this.getScope().getReferencedBinding(node);
  //   return (
  //     referencedBinding?.path.isFunctionReturnParameterDeclaration() ?? false
  //   );
  // }

  // TODO: this will capture `memory` delcarations as well. In future we might want to split out identification of memory (heap) variables from stack variables.
  // NOTE: this does not consider function parameters to be local stack variables.
  isLocalStackVariableDeclaration(): boolean {
    return (
      this.isInFunctionBodyStatement() &&
      ['VariableDeclaration', 'VariableDeclarationStatement'].includes(
        this.nodeType,
      )
    );
  }
}
