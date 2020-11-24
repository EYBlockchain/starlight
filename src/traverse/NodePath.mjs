/* eslint-disable no-param-reassign, no-shadow */

import { traverse, traverseNodesFast, traversePathsFast } from './traverse.mjs';
import logger from '../utils/logger.mjs';
import { path as pathCache } from './cache.mjs';

/**
A NodePath is required as a way of 'connecting' a node to its parent (and its parent, and so on...). We can't assign a `.parent` to a `node` (to create `node.parent`), because we'd end up with a cyclic reference; the parent already contains the node, so the node can't then contain the parent!
The solution: wrap both the node and the parent in a class.
*/
class NodePath {
  /**
  @param {Object} node - the node of a tree
  @param {Object} parent - the parent of the node (itself a node)
  @param {Object || Array} container - contains the node - see details immediately below.
  @param {string || number} key - where container[key] = node, always.
  @param {string} listKey - OPTIONAL - only required if `container` is an array.
  @param {NodePath} parentPath - OPTIONAL - since a parentPath won't exist for the top-most node of the tree.
  */
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
   *                { <-- index of array       <--| this is the node
   *                    // contents of the node      <--| at some 'key' (index)
   *                }                                <--| of this container
   *            ]
   *        }
   *        // the node is at parent[key][index] = container[index]
   */
  constructor({ node, parent, key, container, index, parentPath }) {
    const cachedPath = pathCache.get(node);
    if (pathCache.has(node)) return cachedPath;

    NodePath.validateConstructorArgs({ node, parent, container, key, index, parentPath });

    this.node = node;
    this.parent = parent;
    this.key = key;
    this.container = container;
    this.parentPath = parentPath || null;

    this.inList = Array.isArray(container);
    this.index = this.inList ? index : null;

    this.containerName = this.key; // synonym
    this.nodeType = this.node.nodeType;

    pathCache.set(node, this);
  }

  static validateConstructorArgs({ node, parent, key, container, index, parentPath }) {
    if (!parent) throw new Error(`Can't create a path without a parent`);
    if (!node) throw new Error(`Can't create a path without a node`);
    if (!container) throw new Error(`Can't create a path without a container`);
    if (!key && key !== 0) throw new Error(`Can't create a path without a key`);
    if (parent[key] !== container) throw new Error(`container !== parent[key]`);
    if (Array.isArray(container)) {
      if (!index && index !== 0) throw new Error(`index must exist for a container of type array`);
      if (container[index] !== node)
        throw new Error(`parent[key][index] !== node for a container of type 'array'`);
    } else {
      if (index || index === 0) {
        logger.warn(`index shouldn't exist for a non-array container`);
      }
      if (node !== container) throw new Error(`container !== node for a non-array container`);
    }
  }

  traverse(visitor, state, scope) {
    traverse(this, visitor, state, scope);
  }

  /**
   @returns {string} - a human-readable path
   */
  getLocation() {
    const parts = [];
    let path = this;
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
  findAncestor(callback) {
    let path = this;
    do {
      if (callback(path)) return path;
    } while ((path = path.parentPath));
    return null;
  }

  /**
   * Same as findAncestor, but starting at this path's parent.
   * @return {NodePath || null}
   */
  findAncestorFromParent(callback) {
    let path = this;
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
  queryAncestors(callback) {
    const path = this.parentPath || null;
    return callback(path) || path.queryAncestors(callback);
  }

  /**
   * Build an array of node paths containing the entire ancestry of the current node path.
   *
   * NOTE: The current node path is included in this.
   * @returns {Array[NodePath]}
   */
  getAncestry() {
    let path = this;
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
  isAncestor(maybeDescendant) {
    return maybeDescendant.isDescendant(this);
  }

  /**
   * A helper to find if `this` path is a descendant of @param {NodePath} maybeAncestor
   * @returns {Boolean}
   */
  isDescendant(maybeAncestor) {
    return !!this.findAncestorFromParent(path => path === maybeAncestor);
  }

  // SIBLINGS

  getSiblingNode(index) {
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
    return this.getSiblingNode(this.key - 1);
  }

  getNextSiblingNode() {
    return this.getSiblingNode(this.key + 1);
  }

  getAllNextSiblingNodes() {
    if (!this.inList) return null;
    let { index } = this;
    let sibling = this.getSiblingNode(++index);
    const siblings = [];
    while (sibling) {
      siblings.push(sibling);
      sibling = this.getSiblingNode(++index);
    }
    return siblings;
  }

  getAllPrevSiblingNodes() {
    if (!this.inList) return null;
    let { index } = this;
    let sibling = this.getSiblingNode(--index);
    const siblings = [];
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
  getAncestorOfType(nodeType) {
    return this.findAncestor(path => path.node.nodeType === nodeType);
  }

  /**
   * @param {string} containerName - e.g. parameters, nodes, statements, declarations, imports, ...
   * Get the first @return {NodePath || null} whose containerName matches the given containerName (including `this` in the search)
   */
  getAncestorContainedWithin(containerName) {
    return this.findAncestor(path => path.containerName === containerName);
  }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {Array[NodePath] || null} the parameters of the function.
   */
  getFunctionParameters() {
    const functionDefinition = this.getAncestorOfType('FunctionDefinition');
    return functionDefinition ? functionDefinition.parameters.parameters : null;
  }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {Array[NodePath] || null} the parameters of the function.
   */
  getFunctionReturnParameters() {
    const functionDefinition = this.getAncestorOfType('FunctionDefinition');
    return functionDefinition ? functionDefinition.returnParameters.parameters : null;
  }

  /**
   * Callable from any nodeType below (or equal to) a 'FunctionDefinition' node.
   * @returns {Array[NodePath] || null} the statements of the function.
   */
  getFunctionBodyStatements() {
    const functionDefinition = this.getAncestorOfType('FunctionDefinition');
    return functionDefinition && functionDefinition.body
      ? functionDefinition.body.statements
      : null;
  }

  /**
   * A helper to find if `this` path is a descendant of a particular nodeType or @param {array} nodeTypes
   * @returns {Boolean}
   */
  isInType(...nodeTypes) {
    let path = this;
    while (path) {
      for (const nodeType of nodeTypes) {
        if (path.node.nodeType === nodeType) return true;
      }
      path = path.parentPath;
    }

    return false;
  }

  /**
   * Is this path.node a 'Statement' type?
   * @returns {Boolean}
   */
  isStatement() {
    const statementNodeTypes = [
      'ExpressionStatement',
      'VariableDeclarationStatement',
      'ImportStatements',
      'ImportStatement',
    ];
    return statementNodeTypes.includes(this.nodeType);
  }

  /**
   * Is this path.node a 'Statement' type which is _within_ a function's body?
   * @returns {Boolean}
   */
  isFunctionBodyStatement() {
    return this.containerName === 'statements';
  }

  /**
   * Is this path.node a descendant of a statement which is _within_ a function's body?
   * @returns {Boolean}
   */
  isInFunctionBodyStatement() {
    return this.queryAncestors(path => path.isFunctionBodyStatement());
  }

  /**
   * Slower than querying the `scope` object.
   * Suppose this.node refers to some previously-declared variable. Or suppose `this.node` is the _parent_ or _grandparent_ or earlier _ancestor_ of a node which refers to some previously-declared variable (e.g. a 'statement' node will have subNodes which make the references).
   * This function will collect (within the scope of nodes beneath `beneathNodeType`) all nodePaths which reference the same node(s).
   * @return {Object} = { refDecId: [path, path, path] }, where the array of paths is all paths which refer to the same referenceDeclaration id.
   */
  getAllNodesWhichReferenceTheSame(beneathNodeType = 'Block') {
    // We'll search all subnodes for referencedDeclarations.
    // Later, we'll find nodes `beneathNodeType` which reference the same.
    const state = {};
    const refId = this.node.referencedDeclaration;
    if (refId) {
      state[refId] = [];
    } else {
      const visitor1 = (path, state) => {
        const refId = path.node.referencedDeclaration;
        if (refId) state[refId] = []; // initialise an array to which we'll push nodes which reference the same referencedDeclaration node.
      };
      traversePathsFast(this, visitor1, state);
    }
    if (Object.keys(state).length === 0) return {}; // no references

    const rootNodePath = this.getAncestorOfType(beneathNodeType);
    if (!rootNodePath) return {};

    const visitor2 = (path, state) => {
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
  getAllNodesWhichModifyTheSame(beneathNodeType = 'Block') {
    // We'll search all subnodes for referencedDeclarations on the LHS.
    // Later, we'll find nodes `beneathNodeType` which modify the same nodes.
    const state = {};
    const refId = this.node.referencedDeclaration;
    // TODO: currently, the only 'modification' we care about is a value on the 'leftHandSide' of an assignment node.
    if (refId && this.containerName === 'leftHandSide') {
      state[refId] = [];
    } else {
      const visitor1 = (path, state) => {
        const refId = path.node.referencedDeclaration;
        if (refId && path.containerName === 'leftHandSide') state[refId] = []; // initialise an array to which we'll push nodes which modify the same referencedDeclaration node.
      };
      traversePathsFast(this, visitor1, state);
    }
    if (Object.keys(state).length === 0) return {}; // no references

    const rootNodePath = this.getAncestorOfType(beneathNodeType);
    if (!rootNodePath) return {};

    const visitor2 = (path, state) => {
      for (const refId of Object.keys(state)) {
        if (path.node.referencedDeclaration === refId && path.containerName === 'leftHandSide')
          state[refId].push(path);
      }
    };
    traversePathsFast(rootNodePath, visitor2, state);
    return state;
  }

  // SCOPE

  setScope() {
    let path = this.parentPath;
    let nearestAncestorScope;
    // move up the path 'tree', until a scope is found
    while (path && !nearestAncestorScope) {
      nearestAncestorScope = path.scope;
      path = path.parentPath;
    }
    this.scope = Scope.getOrCreate(nearestAncestorScope);
  }
}

export default NodePath;
