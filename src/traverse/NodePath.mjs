/* eslint-disable no-param-reassign */

import { traverse } from './traverse.mjs';
import logger from '../utils/logger.mjs';

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
   */
  findInAncestors(callback) {
    const path = this.parentPath || null;
    return callback(path) || path.findInAncestors(callback);
  }

  /**
   * A helper to find if `this` path is a descendant of @param {NodePath} maybeAncestor
   */
  isDescendant(maybeAncestor) {
    return !!this.findAncestorFromParent(path => path === maybeAncestor);
  }

  /**
   * A helper to find if `this` path is a descendant of a particular nodeType or @param {array} nodeTypes
   */
  inType(...nodeTypes) {
    let path = this;
    while (path) {
      for (const nodeType of nodeTypes) {
        if (path.node.nodeType === nodeType) return true;
      }
      path = path.parentPath;
    }

    return false;
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

}

export default NodePath;
