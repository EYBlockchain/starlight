//eslint-disable no-param-reassign, no-shadow, import/no-cycle */

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
  traverse,
  traverseNodesFast,
  traversePathsFast
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
export default class NodePath {
  /**
  @param {Object} node - the node of a tree
  @param {Object} parent - the parent of the node (itself a node)
  @param {Object || Array} container - contains the node - see details immediately below.
  @param {string || number} key - where container[key] = node, always.
  @param {string} listKey - OPTIONAL - only required if `container` is an array.
  @param {NodePath} parentPath - OPTIONAL - since a parentPath won't exist for the top-most node of the tree.
  */
  node: any;
  nodeType: string;
  parent: any;
  container: any;
  containerName: string | number;
  key: string | number;
  index?: number;
  parentPath: NodePath;
  inList: boolean;
  scope: Scope;
  isSecret?: boolean;
  isSharedSecret?:boolean;
  isPublic?: boolean;
  containsSecret?: boolean;
  containsPublic?: boolean;
  isIncremented?: boolean;
  incrementedDeclaration?: any;
  isDecremented?: boolean;
  isBurnStatement?: boolean;
  /**
   * `container` naming conventions explained:
   * (note: these naming conventions DIFFER from those of babel)
   *     1) If the node is _not_ contained within a 'list' (an array):
   *        parent: {
   *            key: { <-- container = node
   *                // contents of the node
   *            }
   *        }
   *        // the node is at parent[key] = container
   *
   *     2) If the node _is_ contained within a list:
   *        parent: {
   *            key: [  <-- container
   *                { <-- index of array             <--| this is the node
   *                    // contents of the node      <--| at some 'key' (index)
   *                }                                <--| of this container
   *            ]
   *        }
   *        // the node is at parent[key][index] = container[index]
   *        // Notice how in both cases parent[key] = container.
   */
  constructor({ node, parent, key, container, index, parentPath }) {
    if (pathCache.has(node)) return pathCache.get(node);

    NodePath.validateConstructorArgs({
      node,
      parent,
      container,
      key,
      index,
      // parentPath,
    });

    this.node = node;
    this.parent = parent;
    this.key = key;
    this.container = container;
    this.parentPath = parentPath || null;

    this.inList = Array.isArray(container);
    this.index = this.inList ? index : null;

    this.containerName = this.key; // synonym
    this.nodeType = this.node.nodeType;

    this.setScope();

    pathCache.set(node, this);
  }

  static validateConstructorArgs({
    node,
    parent,
    key,
    container,
    index,
    // parentPath,
  }) {
    if (!parent) throw new Error(`Can't create a path without a parent`);
    if (!node) throw new Error(`Can't create a path without a node`);
    if (!container) throw new Error(`Can't create a path without a container`);
    if (!key && key !== 0) throw new Error(`Can't create a path without a key`);
    if (parent[key] !== container) throw new Error(`container !== parent[key]`);
    if (Array.isArray(container)) {
      if (!index && index !== 0)
        throw new Error(`index must exist for a container of type array`);
      if (container[index] !== node)
        throw new Error(
          `parent[key][index] !== node for a container of type 'array'`,
        );
    } else {
      if (index || index === 0) {
        logger.warn(`index shouldn't exist for a non-array container`);
      }
      if (node !== container)
        throw new Error(`container !== node for a non-array container`);
    }
  }

  traverse(visitor: any, state: any): void {
    traverse(this, visitor, state);
  }

  traversePathsFast(enter: Function, state: any): void {
    traversePathsFast(this, enter, state);
  }

  traverseNodesFast(enter: Function, state: any): void {
    traverseNodesFast(this.node, enter, state);
  }

  static getPath(node: any) {
    if (pathCache.has(node)) return pathCache.get(node);
    throw new Error('Node not found in pathCache');
  }

  /**
   @returns {string} - a human-readable path
   */
  getLocation(): string {
    const parts: (string | number)[] = [];
    let path: NodePath = this;
    do {
      const part = path.inList ? `${path.key}[${path.index}]` : path.key;
      parts.unshift(part);
    } while ((path = path.parentPath));
    return parts.join('.');
  }

  // ANCESTRY:

  /**
   * Starting at current `path` and going up the tree, return the first
   * `path` that causes the provided `callback` to return a truthy value,
   * or `null` if the `callback` never returns a truthy value.
   * @return {NodePath || null}
   */
  findAncestor(callback: any): NodePath | null {
    let path: NodePath = this;
    do {
      if (callback(path)) return path;
    } while ((path = path.parentPath));
    return null;
  }

  /**
   * Same as findAncestor, but starting at this path's parent.
   * @return {NodePath || null}
   */
  findAncestorFromParent(callback: any): NodePath | null {
    let path: NodePath = this;
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
  getAncestry(): NodePath[] {
    let path: NodePath = this;
    const paths: NodePath[] = [];
    do {
      paths.push(path);
    } while ((path = path.parentPath));
    return paths;
  }

  /**
   * A helper to find if `this` path is an ancestor of @param {NodePath} maybeDescendant
   * @returns {Boolean}
   */
  isAncestor(maybeDescendant: NodePath): boolean {
    return maybeDescendant.isDescendant(this);
  }

  /**
   * A helper to find if `this` path is a descendant of @param {NodePath} maybeAncestor
   * @returns {Boolean}
   */
  isDescendant(maybeAncestor: NodePath): boolean {
    return !!this.findAncestorFromParent((path: NodePath) => path === maybeAncestor);
  }

  // SIBLINGS

  getSiblingNode(index: any) {
    if (!this.inList) return null;
    return this.container[index];
  }

  /* includes self */
  getSiblingNodes() {
    if (!this.inList) return null;
    return this.container;
  }

  getFirstSiblingNode() {
    if (!this.inList) return null;
    return this.container[0];
  }

  getLastSiblingNode() {
    if (!this.inList) return null;
    return this.container[this.container.length - 1];
  }

  getPrevSiblingNode() {
    return this.getSiblingNode(this.key as number - 1);
  }

  getNextSiblingNode() {
    return this.getSiblingNode(this.key as number + 1);
  }

  getAllNextSiblingNodes() {
    if (!this.inList || !this.index) return null;
    let { index } = this;
    let sibling = this.getSiblingNode(++index);
    const siblings: any[] = [];
    while (sibling) {
      siblings.push(sibling);
      sibling = this.getSiblingNode(++index);
    }
    return siblings;
  }

  getAllPrevSiblingNodes() {
    if (!this.inList || !this.index) return null;
    let { index } = this;
    let sibling = this.getSiblingNode(--index);
    const siblings: any[] = [];
    while (sibling) {
      siblings.push(sibling);
      sibling = this.getSiblingNode(--index);
    }
    return siblings;
  }


  // SEARCHES for specific nodeTypes:

  /**
   * @param {string} nodeType - a valid Solidity nodeType.
   * Get the first @return {NodePath || null} matching the given nodeType, in which `this` is contained (including `this` in the search).
   */
  getAncestorOfType(nodeType: string): NodePath | null {
    return this.findAncestor((path: NodePath) => path.node.nodeType === nodeType);
  }

  /**
   * @param {string} containerName - e.g. parameters, nodes, statements, declarations, imports, ...
   * Get the first @return {NodePath || null} whose containerName matches the given containerName (including `this` in the search)
   */
  getAncestorContainedWithin(containerName: string): NodePath | null {
    return this.findAncestor((path: NodePath) => path.containerName === containerName);
  }

  /**
   * Callable from any nodeType below (or equal to) a 'SourceUnit' node.
   * @returns {NodePath || null} the parameters of the function.
   */
  getSourceUnit(node: any = this.node): NodePath | null {
    const path = NodePath.getPath(node);
    return path.getAncestorOfType('SourceUnit') || null;
  }

  /**
   * Callable from any nodeType below (or equal to) a 'ContractDefinition' node.
   * @returns {NodePath || null} the parameters of the function.
   */
  getContractDefinition(node: any = this.node): NodePath | null {
    const path = NodePath.getPath(node);
    return path.getAncestorOfType('ContractDefinition') || null;
  }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {NodePath || null} the parameters of the function.
   */
  getFunctionDefinition(node: any = this.node): NodePath | null {
    const path = NodePath.getPath(node);
    return path.getAncestorOfType('FunctionDefinition') || null;
  }

  /**
   * Callable from a ContractDefinition node only
   * @returns {Array[String] || null} the parameters of the function.
   */
  getFunctionNames(contractDefinitionNode = this.node): string[] | null {
    if (contractDefinitionNode.nodeType !== 'ContractDefinition') return null;
    const entryVisitor = (node: any, state: any) => {
      if (node.nodeType !== 'FunctionDefinition') return;
      state.functionNames.push(node.name);
      state.skipSubNodes = true;
    };
    const state = { functionNames: [], skipSubNodes: false };
    traverseNodesFast(contractDefinitionNode, entryVisitor, state);
    return state.functionNames;
  }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {Array[Node] || null} the parameters of the function.
   */
  getFunctionParameters(): any[] | null {
    const functionDefinition = this.getAncestorOfType('FunctionDefinition');
    return functionDefinition?.node?.parameters?.parameters ?? null;
  }

    /**
   * Callable from any nodeType below (or equal to) a 'EventDefintion' node.
   * @returns {Array[Node] || null} the parameters of the event.
   */
     getEventParameters(): any[] | null {
      const eventDefinition = this.getAncestorOfType('EventDefinition');
      return eventDefinition?.node?.parameters?.parameters ?? null;
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
   * A helper to find if `this` path is a descendant of a particular nodeType or @param {array} nodeTypes
   * @returns {Boolean}
   */
  isInType(...nodeTypes: string[]): boolean {
    let path: NodePath = this;
    while (path) {
      for (const nodeType of nodeTypes) {
        if (path.node.nodeType === nodeType) return true;
      }
      path = path.parentPath;
    }

    return false;
  }

  /**
   * A helper to find if `this` path is in a rightHandSide container or another container which requires the value of`this` to be accessed
   * @returns {NodePath || String || Boolean}
   */
  getRhsAncestor(onlyReturnContainerName:boolean = false): NodePath | string | boolean {
    // NB ordering matters. An identifier can exist in an arguments container which itself is in an initialValue container. We want the parent.
    const rhsContainers = [
      'rightHandSide',
      'initialValue', // as arg
      'trueExpression', // a conditional requires value accessing
      'falseExpression',
      'indexExpression', // as arg
      // 'subExpression', // removing subExpression as can be considered lhs
      'rightExpression',
      'arguments', // a value used as an arg needs to be accessed
    ];
    for (const container of rhsContainers) {
      const ancestor = this.getAncestorContainedWithin(container);
      if (ancestor && !onlyReturnContainerName) return ancestor;
      if (ancestor && onlyReturnContainerName) return container;
    }
    return false;
  }

  /**
   * A helper to find if `this` path is in a leftHandSide container or another container which requires the value of`this` to be modified
   * @returns {NodePath || String || Boolean}
   */
  getLhsAncestor(onlyReturnContainerName:boolean = false): NodePath | string | boolean {
    // NB ordering matters. An identifier can exist in an arguments container which itself is in an initialValue container. We want the parent.
    const lhsContainers = [
      'leftHandSide',
      'declarations',
      'subExpression',
      'leftExpression',
    ];
    for (const container of lhsContainers) {
      const ancestor = this.getAncestorContainedWithin(container);
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
    let parent: NodePath | null;

    switch (rhsContainer) {
      case 'rightHandSide':
        parent = this.getAncestorOfType('Assignment');
        return parent?.node.leftHandSide;
      case 'initialValue':
        parent = this.getAncestorOfType('VariableDeclarationStatement');
        return parent?.node.declarations[0];
      case 'subExpression':
        // a++ - assigning itself
        return this.node;
      case 'rightExpression':
        // TODO there may be nested binops, so this may not be the 'true' parent lhs
        parent = this.getAncestorOfType('BinaryOperation');
        return parent?.node.leftExpression;
      case 'arguments': // a value used as an arg needs to be accessed
        parent = this.getAncestorOfType('FunctionCall');
        return parent?.node.declarations?.[0] || false;
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
    let parent: NodePath | null;
    switch (lhsContainer) {
      case 'leftHandSide':
        parent = this.getAncestorOfType('Assignment');
        return parent?.node.rightHandSide;
      case 'declarations':
        parent = this.getAncestorOfType('VariableDeclarationStatement');
        return parent?.node.initialValue;
      case 'subExpression':
        // a++ - assigning itself
        return this.node;
      case 'leftExpression':
        // TODO there may be nested binops, so this may not be the 'true' parent lhs
        parent = this.getAncestorOfType('BinaryOperation');
        return parent?.node.rightExpression;
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
    return this.containerName === 'statements';
  }

  /**
   * Is this path.node a descendant of a statement which is _within_ a function's body?
   * @returns {Boolean}
   */
  isInFunctionBodyStatement(): boolean {
    return !!this.queryAncestors((path: NodePath) => path.isFunctionBodyStatement());
  }

  isFunctionParameterDeclaration(): boolean {
    const functionParameters = this.getFunctionParameters();
    return functionParameters ? functionParameters.some(node => node === this.node) : false;
  }

  isEventParameterDeclaration(): boolean {
    const functionParameters = this.getEventParameters();
    return functionParameters ? functionParameters.some(node => node === this.node) : false;
  }

  isFunctionParameter(node: any = this.node): boolean  {
    const referencedBinding = this.getScope().getReferencedBinding(node); // there will be cases where the reference is a special type like 'msg.sender' which doesn't have a binding.
    return referencedBinding?.path.isFunctionParameterDeclaration() ?? false;
  }

  isFunctionReturnParameterDeclaration(): boolean {
    return (
      this.parent.nodeType === 'ParameterList' &&
      this.parent.containerName === 'returnParameters'
    );
  }

  isFunctionReturnParameter(node: any = this.node): boolean {

    const referencedBinding = this.getScope().getReferencedBinding(node);
    return (
      referencedBinding?.path.isFunctionReturnParameterDeclaration() ?? false
    );
  }

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

  // TODO: this will capture `memory` delcarations as well. In future we might want to split out identification of memory (heap) variables from stack variables.
  // NOTE: this does not consider function parameters to be local stack variables.
  isLocalStackVariable(node: any = this.node): boolean {
    const referencedBinding = this.scope.getReferencedBinding(node);
    return referencedBinding ? referencedBinding.path.isLocalStackVariableDeclaration() : false;
  }

  isExternalContractInstanceDeclaration(node: any = this.node): boolean {
    if (
      !['VariableDeclaration', 'VariableDeclarationStatement'].includes(
        node.nodeType,
      )
    )
      return false;
    if (!node.typeDescriptions?.typeString.includes('contract')) return false;

    // Ensure the contract being declared is external:
    const referencedContractId = node.typeName?.referencedDeclaration;
    const thisContractDefinition = this.getContractDefinition(node)?.node;
    const sourceUnit = this.getSourceUnit(node)?.node;
    const exportedSymbolsId =
      sourceUnit?.exportedSymbols?.[thisContractDefinition.name]?.[0];
    if (!exportedSymbolsId) return false;
    return referencedContractId !== exportedSymbolsId;
  }

  isExternalContractInstance(node: any = this.node): boolean {
    const varDecNode = this.getReferencedNode(node);
    return this.isExternalContractInstanceDeclaration(varDecNode);
  }

  isExternalFunctionCall(): boolean {
    if (this.nodeType !== 'FunctionCall') return false;
    const { expression: functionNode } = this.node; // the function being called
    // The `expression` for an external function call will be a MemberAccess nodeType. myExternalContract.functionName
    if (functionNode.nodeType !== 'MemberAccess') return false;
    return this.isExternalContractInstance(functionNode.expression);
  }

  isInternalFunctionCall(): boolean {
  if (this.nodeType !== 'FunctionCall') return false;
  const { expression: functionNode } = this.node;
  if (functionNode.nodeType === 'MemberAccess' && functionNode.kind=== 'typeConversion') return false;
  if(this.node.kind === 'functionCall' && functionNode.typeDescriptions.typeIdentifier.includes(`_internal_`))
    return true;
  return false;
  }

  isTypeConversion() {
    return (
      this.nodeType === 'FunctionCall' && this.node.kind === 'typeConversion'
    );
  }

  /*
  The original requirement which led to this function was "how do we identify address(0) as zero".
  @WARNING: incomplete. Don't use this function without understanding what it does. You might need to add to it (e.g. to add functionality to identify a simple Literal representing zero)
  */
  isZero() {
    if (
      this.isTypeConversion() &&
      this.node.arguments.length === 1 &&
      this.node.arguments[0].value === '0'
    )
      return true;
    return false;
  }

  /**
   * @returns {String || null} the name of an exported symbol, if one exists for the given `id`
   */
  getReferencedExportedSymbolName(node: any = this.node): string | null {
    const id: number = node.referencedDeclaration;
    if (!id) return null;
    const exportedSymbols: { string: number[] } = this.getSourceUnit()?.node.exportedSymbols;
    if (!exportedSymbols) return null;
    for (const [name, ids] of Object.entries(exportedSymbols)) {
      if (ids.some(_id => _id === id)) return name;
    }
    return null;
  }

  /**
   * Decides whether an expression is an incrementation.
   * E.g. `a = a + b` is an incrementation.
   * E.g. `a + b` is an incrementation.
   * E.g. `a++` is an incrementation.
   * @param {Object} expressionNode - an expression, usually an Assignment nodeType.
   * @param {Object} lhsNode - the left hand side node, usually an Identifier. We're checking whether this lhsNode is being incremented by the expressionNode.
   * @returns {Object {bool, bool}} - { isIncremented, isDecremented }
   */
  isIncrementation(expressionNode: any = this.node): any {
    return {
      isIncremented: expressionNode.isIncremented,
      isDecremented: expressionNode.isIncremented,
    };
  }

  /**
   * Decides whether an expression is an incrementation of some node (`lhsNode`).
   * E.g. `a = a + b` is an expression which is an incrementation of `a`.
   * @param {Object} expressionNode - an expression, usually an Assignment nodeType.
   * @param {Object} lhsNode - the left hand side node, usually an Identifier. We're checking whether this lhsNode is being incremented by the expressionNode.
   * @returns {Object {bool, bool}} - { isIncremented, isDecremented }
   */
  isIncrementationOf(lhsNode: any, expressionNode: any = this.node): any {
    const { isIncremented, isDecremented } = expressionNode;
    const incrementsThisNode =
      expressionNode.incrementedDeclaration === lhsNode.referencedDeclaration;
    return incrementsThisNode
      ? { isIncremented, isDecremented }
      : { isIncremented: false, isDecremented: false };
  }

  /**
   * Checks whether a node represents `msg.sender`
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isMsgSender(node: any = this.node): boolean {
    return (
      node.nodeType === 'MemberAccess' &&
      node.memberName === 'sender' &&
      node.typeDescriptions.typeString === 'address' &&
      this.isMsg(node.expression)
    );
  }

    /**
   * Checks whether a node represents `msg.value`
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
     isMsgValue(node: any = this.node): boolean {
      return (
        node.nodeType === 'MemberAccess' &&
        node.memberName === 'value' &&
        node.typeDescriptions.typeString === 'uint256' &&
        this.isMsg(node.expression)
      );
    }
  

  /**
   * Checks whether a node represents the special solidity type `msg` (e.g. used in `msg.sender`)
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isMsg(node: any = this.node): boolean {
    return (
      node.nodeType === 'Identifier' &&
      node.name === 'msg' &&
      node.typeDescriptions.typeIdentifier === 't_magic_message' &&
      node.typeDescriptions.typeString === 'msg'
    );
  }

  /**
   * Checks whether a node represents the special solidity keyword `this`
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isThis(node: any = this.node): boolean {
    return (
      node.nodeType === 'Identifier' &&
      node.name === 'this' &&
      node.referencedDeclaration > 4294967200
    );
  }

  /**
   * Checks whether a node represents an external contract ('exported symbol')
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isExportedSymbol(node: any = this.node): boolean {
    return !!this.getReferencedExportedSymbolName(node);
  }

  /**
   * Checks whether a node is a VariableDeclaration of a Mapping.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isMappingDeclaration(node: any = this.node): boolean {
    if (
      node.nodeType === 'VariableDeclaration' &&
      node.typeName.nodeType === 'Mapping'
    )
      return true;
    return false;
  }

   /**
   * Checks whether a node is an EventDefinition.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
    isEventDefinition(node: any = this.node): boolean {
      if (node.typeDescriptions.typeIdentifier.includes('t_function_event'))
      return true;
      return false;
    }

  /**
   * Checks whether a node is an Identifier for a mapping.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isMappingIdentifier(node: any = this.node): boolean {
    if (!['IndexAccess', 'Identifier'].includes(node.nodeType)) return false;
    // It could be a mapping or it could be an array. The only way to tell is to trace it all the way back to its referencedDeclaration.
    const varDecNode = this.getReferencedNode(node); // If it's an IndexAccess node, it will look at the IndexAccess.baseExpression through getReferencedDeclarationId().
    return this.isMappingDeclaration(varDecNode || node);
  }

  /**
   * Checks whether a node is a mapping.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isMapping(node: any = this.node): boolean {
    if (node.nodeType === 'MemberAccess') return this.isMapping(node.expression);
    return this.isMappingDeclaration(node) || this.isMappingIdentifier(node);
  }

  /**
   * A mapping's key will contain an Identifier node pointing to a previously-declared variable.
   * @param {Object} - the mapping's index access node.
   * @returns {Node} - an Identifier node
   */
  getMappingKeyIdentifier(node: any = this.node): any {
    if (node.expression?.nodeType === 'IndexAccess') return this.getMappingKeyIdentifier(node.expression);
    if (node.nodeType !== 'IndexAccess')
      return this.getAncestorOfType('IndexAccess')?.getMappingKeyIdentifier();
    const { indexExpression } = node;
    const keyNode = (this.isMsgSender(indexExpression) || this.isMsgValue(indexExpression))
      ? indexExpression?.expression
      : indexExpression; // the former to pick up the 'msg' identifier of a 'msg.sender' ast representation
    return keyNode;
  }

  /**
   * A struct property will contain a MemberAccess node pointing to a previously-declared variable.
   * @param {Object} - the struct's identifier node.
   * @returns {Node} - a MemberAccess node
   */
  getStructPropertyNode(node: any = this.node): any {
    if (node.nodeType !== 'MemberAccess')
      return this.getAncestorOfType('MemberAccess')?.getStructPropertyNode();
    return node;
  }

  /**
   * Checks whether a node is a Solidity `require` statement.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isRequireStatement(node: any = this.node): boolean {
    /* `require` statements are often contained within the following structure:
        {
          nodeType: 'ExpressionStatement',
          expression: {
            nodeType: 'FunctionCall',
            arguments: [...],
            expression: {
              name: 'require'
            }
          }
        }

        We'll return 'true' for both the `ExpressionStatement` and the `FunctionCall`
     */
    switch (node.nodeType) {
      case 'ExpressionStatement':
        return this.isRequireStatement(node.expression);
      case 'FunctionCall':
        return node.expression.name === 'require';
      case 'Identifier':
        return (
          node.name === 'require' && node.referencedDeclaration > 4294967200
        );
      default:
        return false;
    }
  }

    /**
   * Checks whether a node is a Solidity `revert` statement.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
     isRevertStatement(node: any = this.node): boolean {
      switch (node.nodeType) {
        case 'ExpressionStatement':
          return this.isRevertStatement(node.expression);
        case 'FunctionCall':
          return node.expression.name === 'revert';
        case 'Identifier':
          return (
            node.name === 'revert' && node.referencedDeclaration > 4294967200
          );
        default:
          return false;
      }
    }

  /**
   * Checks whether a node is of a struct type.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isStruct(node: any = this.node): boolean {
    if (this.isStructDeclaration(node)) return true;
    const parent = node.nodeType === 'MemberAccess' ? node : this.getAncestorOfType('MemberAccess')?.node;
    return !!parent && (parent.expression.typeDescriptions?.typeString.includes('struct') || parent.expression?.typeDescriptions?.typeString.includes('struct'));
  }

  /**
   * Checks whether a node is a VariableDeclaration of a struct.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isStructDeclaration(node: any = this.node): boolean {
    // with a space ('struct ') to avoid custom type NAMES that include struct without being a struct
    return !!this.getAncestorOfType('StructDefinition') || (node.nodeType === 'VariableDeclaration' && ( node.typeDescriptions?.typeString?.includes('struct ') || node.typeName?.typeDescriptions?.typeString?.includes('struct ')));
  }

  getStructDeclaration(node: any = this.node): any {
    if (!this.isStruct(node) && !node.typeDescriptions?.typeString.includes('struct ')) return null;
    if (this.getAncestorOfType('StructDefinition')) return this.getAncestorOfType('StructDefinition');
    // if this is at the contract level, the StructDefinition will be a sibling
    const fnDef = this.getAncestorOfType('FunctionDefinition') || this;
    let parent = node.typeName?.pathNode || node.typeDescriptions?.typeString.includes('struct ') ? node : null;
    parent ??= (NodePath.getPath(node) || this).queryAncestors(p => {
      if (p.node.typeName?.pathNode ||
      p.node.typeDescriptions?.typeString.includes('struct ') ||
      p.node.expression?.typeDescriptions?.typeString.includes('struct ')) return p;
    }
    ).node;
    if (parent.typeName?.pathNode) {
      const typeId = parent.typeName.pathNode ? parent.typeName.pathNode.referencedDeclaration : parent.typeName.valueType.referencedDeclaration;
      const structNode = fnDef.getAllPrevSiblingNodes()?.concat(fnDef.getAllNextSiblingNodes()).find(n => `${n.id}` === `${typeId}`);
      return structNode;
    } else if (parent.typeDescriptions?.typeString.includes('struct ')) {
      // matches number between $ and _ in typeIdentifier (this is where id is stored)
      // e.g. 8 in "t_struct$_MyStruct_$8_storage_ptr"
      const structID = parent.typeDescriptions?.typeIdentifier.match(/(?<=\$)(\d+)(?=\_)/)[0];
      const structNode = fnDef.getAllPrevSiblingNodes()?.concat(fnDef.getAllNextSiblingNodes()).find(n => `${n.id}` === `${structID}`);
      return structNode;
    } else {
      const structNode = this.getReferencedNode(parent) || this.scope.getReferencedBinding(parent)?.node;
      return this.getStructDeclaration(structNode);
    }
  }

 /**
  * Checks whether a node is of an array type.
  * @param {node} node (optional - defaults to this.node)
  * @returns {Boolean}
  */
  isArray(node: any = this.node): boolean {
    if (this.getReferencedNode(node) && this.isArrayDeclaration(this.getReferencedNode(node))) return true;
    const memberAccNode = this.getAncestorOfType('MemberAccess');
    return memberAccNode && memberAccNode.node.baseExpression?.typeDescriptions?.typeIdentifier.includes('array');
  }

    /**
  * Checks whether a node is of an array type.
  * @param {node} node (optional - defaults to this.node)
  * @returns {Boolean}
  */
  isConstantArray(node: any = this.node): boolean {
    if (!this.isArray(node)) return false;
    let arrLen;
    switch (node.nodeType) {
      case 'IndexAccess':
        arrLen = node.baseExpression.typeDescriptions.typeString.match(/(?<=\[)(\d+)(?=\])/);
        break;
      case 'Identifier':
      default:
        arrLen = node.typeDescriptions.typeString.match(/(?<=\[)(\d+)(?=\])/);
        break;
    }
    if (!arrLen) return false;
    for (const match of arrLen) {
      // tries to convert to a number
      if (+match) return true;
    }
    return false;
  }

  /**
   * Checks whether a node is a VariableDeclaration of a Mapping.
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isArrayDeclaration(node: any = this.node): boolean {
    if (
      node.nodeType === 'VariableDeclaration' &&
      node.typeName.nodeType === 'ArrayTypeName'
    )
      return true;
    return false;
  }

  /**
   * Checks whether a node is inside a 'subscope' i.e. a block inside a block
   * @param {node} node (optional - defaults to this.node)
   * @returns {Boolean}
   */
  isInSubScope(): any {
    const currentScopeBlock = this.queryAncestors(path => path.nodeType === 'Block' ? path : false);
    return currentScopeBlock.parentPath.queryAncestors(path => path.nodeType === 'Block' ? path : false)
  }

  isModification() {
    switch (this.nodeType) {
      case 'Identifier':
        // Currently, the only state variable 'modifications' we're aware of are:
        //   - when a state variable is referenced on the LHS of an assignment;
        //   - a unary operator
        // We now do this by checking if at any point the identifier is within a right hand side. If so it cannot be on the LHS of an assignment.
        // prettier-ignore
        return (
          !(this.queryAncestors(path => path.containerName === 'indexExpression')) && !this.getAncestorOfType('FunctionCall') &&
          !this.getAncestorContainedWithin('initialValue') &&
          !(this.getRhsAncestor(true)) && !(this.queryAncestors(path => path.containerName === 'condition') ||  this.queryAncestors(path => path.containerName === 'initializationExpression') ||  this.queryAncestors(path => path.containerName === 'loopExpression'))
        );
      default:
        return false;
    }
  }

  /**
   * Get the referencedDeclaration node id of a particular node.
   * I.e. get the id of the node which the input node references.
   * @param {Node} node - OPTIONAL - the node which references some other node
   * @return {Number || null} - the id of the node being referenced by the input node.
   */
  getReferencedDeclarationId(referencingNode = this.node): number | null {
    const { nodeType } = referencingNode;
    let id: number;
    switch (nodeType) {
      case 'VariableDeclarationStatement':
        id = this.getReferencedDeclarationId(referencingNode.declarations[0]) || -1;
        break;
      case 'StructDefinition':
      case 'VariableDeclaration':
        id = referencingNode.id;
        break;
      case 'Identifier':
        id = referencingNode.referencedDeclaration;
        break;
      case 'IndexAccess':
        id = referencingNode.baseExpression.referencedDeclaration;
        break;
      case 'MemberAccess':
        id = referencingNode.expression.referencedDeclaration || this.getReferencedDeclarationId(referencingNode.expression);
        break;
      default:
        // No other nodeTypes have been encountered which include a referencedDeclaration
        return null;
    }
    return id;
  }

  /**
   * @returns {Binding || null} - the binding of the node being referred-to by `this`.
   */
  getReferencedBinding(referencingNode: any = this.node): Binding | null {
    return this.getScope().getReferencedBinding(referencingNode);
  }

  /**
   * @returns {Node || null} - the node being referred-to by the input referencingNode.
   */
  getReferencedNode(referencingNode = this.node): any {
    return this.getScope().getReferencedNode(referencingNode);
  }

  /**
   * @returns {Node || null} - the node being referred-to by the input referencingNode.
   */
  getReferencedPath(referencingNode = this.node): NodePath | null {
    return this.getScope().getReferencedPath(referencingNode);
  }

  /**
   * The callback must return something falsey if it can't find what it's
   * looking for. Otherwise, (if it finds what it's looking for) it can return
   * whatever it wants.
   * @param {Function} callback
   * @param {Node} referencingNode optional
   * @returns { ? || falsey} - depends on the callback
   */
  queryReferencedPath(callback: any, referencingNode: any = this.node): any | null {
    return callback(this.getReferencedPath(referencingNode)) ?? null;
  }

  /**
   * Slower than querying the `scope` object.
   * Suppose this.node refers to some previously-declared variable. Or suppose `this.node` is the _parent_ or _grandparent_ or earlier _ancestor_ of a node which refers to some previously-declared variable (e.g. a 'statement' node will have subNodes which make the references).
   * This function will collect (within the scope of nodes beneath `beneathNodeType`) all nodePaths which reference the same node(s).
   * @return {Object} = { refDecId: [path, path, path] }, where the array of paths is all paths which refer to the same referenceDeclaration id.
   */
  getAllNodesWhichReferenceTheSame(beneathNodeType: string = 'Block'): any {
    // We'll search all subnodes for referencedDeclarations.
    // Later, we'll find nodes `beneathNodeType` which reference the same.
    const state = {};
    const refId = this.node.referencedDeclaration;
    if (refId) {
      state[refId] = [];
    } else {
      const visitor1 = (path: NodePath, state: any) => {
        const refId = path.node.referencedDeclaration;
        if (refId) state[refId] = []; // initialise an array to which we'll push nodes which reference the same referencedDeclaration node.
      };
      traversePathsFast(this, visitor1, state);
    }
    if (Object.keys(state).length === 0) return {}; // no references

    const rootNodePath = this.getAncestorOfType(beneathNodeType);
    if (!rootNodePath) return {};

    const visitor2 = (path: NodePath, state: any) => {
      for (const refId of Object.keys(state)) {
        if (path.node.referencedDeclaration === refId) state[refId].push(path);
      }
    };
    traversePathsFast(rootNodePath, visitor2, state);
    return state;
  }

  /**
   * Slower than querying the `scope` object.
   * Suppose this.node modifies some previously-declared variable. Or suppose `this.node` is the _parent_ or _grandparent_ or earlier _ancestor_ of a node which modifies some previously-declared variable (e.g. a 'statement' node might have subNodes which make modifications (such as assignment subNodes)).
   * This function will collect (within the scope of nodes beneath `beneathNodeType`) all nodePaths which modify the same node(s).
   * @return {Object} = { refDecId: [path, path, path] }, where the array of paths is all paths which _modify_ the same referenceDeclaration id.
   */
  getAllNodesWhichModifyTheSame(beneathNodeType: string = 'Block'): any {
    // We'll search all subnodes for referencedDeclarations on the LHS.
    // Later, we'll find nodes `beneathNodeType` which modify the same nodes.
    const state = {};
    const refId = this.node.referencedDeclaration;
    // TODO: currently, the only 'modification' we care about is a value on the 'leftHandSide' of an assignment node.
    if (refId && this.containerName === 'leftHandSide') {
      state[refId] = [];
    } else {
      const visitor1 = (path: NodePath, state: any) => {
        const refId = path.node.referencedDeclaration;
        if (refId && path.containerName === 'leftHandSide') state[refId] = []; // initialise an array to which we'll push nodes which modify the same referencedDeclaration node.
      };
      traversePathsFast(this, visitor1, state);
    }
    if (Object.keys(state).length === 0) return {}; // no references

    const rootNodePath = this.getAncestorOfType(beneathNodeType);
    if (!rootNodePath) return {};

    const visitor2 = (path: NodePath, state: any) => {
      for (const refId of Object.keys(state)) {
        if (
          path.node.referencedDeclaration === refId &&
          path.containerName === 'leftHandSide'
        )
          state[refId].push(path);
      }
    };
    traversePathsFast(rootNodePath, visitor2, state);
    return state;
  }

  markContainsSecret() {
    let path: NodePath = this;
    while ((path = path.parentPath)) {
      path.containsSecret ??= true;
      path.node.containsSecret ??= true;
      const indicator = path.scope.getReferencedIndicator(path.node, true);
      // we don't want to add itself as an interacted with path
      if (indicator && this.node.referencedDeclaration !== indicator.id)
        indicator.addSecretInteractingPath(this);
    }
  }

  markContainsPublic() {
    let path : NodePath = this;
    while ((path = path.parentPath)) {
      path.containsPublic ??= true;
      path.node.containsPublic ??= true;
      const indicator = path.scope.getReferencedIndicator(path.node, true);
      // we don't want to add itself as an interacted with path
      if (indicator && this.node.referencedDeclaration !== indicator.id)
        indicator.addPublicInteractingPath(this);
    }
  }

  getUniqueFunctionName() {
    if (this.node.fileName) return this.node.fileName;
    // before creating a function node we check for functions with same name
    const prevSiblings = this.getAllPrevSiblingNodes();
    const nextSiblings = this.getAllNextSiblingNodes();
    let index = 0
    let incIndex = 0;
    let fnName = this.node.name;

    prevSiblings?.forEach((sibling: any) => {
      if (fnName === sibling.name) index ++;
    });

    if (index === 0) return fnName;

    fnName = this.node.name + '_' + index;

    while (incIndex === 0) {
      incIndex = 1;
      prevSiblings?.forEach((sibling: any) => {
        if (fnName === sibling.name) {
          index ++;
          incIndex --;
        }
      });
      nextSiblings?.forEach((sibling: any) => {
        if (fnName === sibling.name) {
          index ++;
          incIndex --;
        }
      });
      fnName = this.node.name + '_' + index;
    }
    logger.info(`ALERT: Your overloaded function ${this.node.name} has been renamed to ${fnName} to prevent overwrites!`)
    backtrace.getSourceCode(this.node.src);
    this.node.fileName = fnName;
    return fnName;
  }

  // SCOPE

  // checks whether this path's nodeType is one which signals the beginning of a new scope
  isScopable(): boolean {
    switch (this.node.nodeType) {
      case 'SourceUnit':
      case 'ContractDefinition':
      case 'FunctionDefinition':
        return true;
      default:
        return false;
    }
  }

  getScope(): Scope {
    if (this.scope) return this.scope;
    const scope = this.queryAncestors((path: NodePath) => path.scope);
    if (!scope) throw new Error('Expect every node to be within a scope.');
    return scope;
  }

  setScope() {
    if (this.node.nodeType === 'SourceUnit') {
      this.scope = new Scope(this);
      return;
    }

    const nearestAncestorScope = this.getScope();
    this.scope = this.isScopable() ? new Scope(this) : nearestAncestorScope;
    nearestAncestorScope.update(this);
  }
}
