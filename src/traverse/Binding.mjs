/* eslint-disable max-classes-per-file */

import logger from '../utils/logger.mjs';
import NodePath from './NodePath.mjs';
import { bindingCache } from './cache.mjs';

export default class Binding {
  // Exists to catch nodeTypes for which a binding makes no sense
  static isBindable(nodeType) {
    switch (nodeType) {
      case 'ContractDefinition':
      case 'FunctionDefinition':
      case 'VariableDeclaration':
        return true;
      case 'ArrayTypeName':
      case 'Assignment':
      case 'Block':
      case 'BinaryOperation':
      case 'ElementaryTypeName':
      case 'ElementaryTypeNameExpression':
      case 'ExpressionStatement':
      case 'FunctionCall':
      case 'Identifier':
      case 'ImportDirective':
      case 'IndexAccess':
      case 'Literal':
      case 'Mapping':
      case 'MemberAccess':
      case 'ParameterList':
      case 'PragmaDirective':
      case 'Return':
      case 'TupleExpression':
      case 'UnaryOperation':
      case 'UserDefinedTypeName':
      case 'VariableDeclarationStatement':
        return false;
      default:
        logger.error(`Hitherto unknown nodeType '${nodeType}'`);
        throw new TypeError(nodeType);
    }
  }

  /**
   We initialise the class via a static method (rather than through a constructor) to handle the possibility that we don't actually want to create a binding for the given path. Viz if the path is not 'bindable' (see isBindable).
   * @param {NodePath} path
   * @returns {Binding || null}
   */
  static create(path) {
    const { node } = path;

    if (!this.isBindable(node.nodeType)) return null;

    const cachedBinding = bindingCache.get(node);
    if (cachedBinding) return cachedBinding;

    const binding = new Binding(path);
    bindingCache.set(node, binding);
    return binding;
  }

  constructor(path) {
    const {
      node: { name, id, nodeType },
      node,
      scope,
    } = path;

    this.kind = nodeType; // QUESTION: why not just call it nodeType? In future will 'kind' differ from nodeType?
    this.id = id;
    this.name = name;
    this.node = node;
    this.path = path;
    this.scope = scope;

    if (['ContractDefinition', 'FunctionDefinition'].includes(nodeType)) return;

    if (path.isNodeType('VariableDeclaration')) {
      this.stateVariable = node.stateVariable;

      this.isReferenced = false;
      this.referenceCount = 0;
      this.referencingPaths = []; // array of paths of `Identifier` nodes which reference this variable

      this.isModified = false;
      this.modificationCount = 0;
      this.modifyingPaths = []; // array of paths of `Identifier` nodes which modify this variable
      // NOTE: modification _is_ nullification, unless it's a partitioned state being incremented (in which case there's no nullifier). So nullifyingPaths is a subset of modifyingPaths.

      this.isNullified = false;
      this.nullificationCount = 0;
      this.nullifyingPaths = []; // array of paths of `Identifier` nodes which nullify this binding

      this.increments = []; // array of nodes
      this.decrements = []; // array of nodes

      this.isMapping = false;
      this.mappingKeys = null; // object of objects, indexed by node id.

      this.isSecret = node.isSecret ?? false;
      this.isKnown = false;
      this.isWhole = false;
      this.isPartitioned = false;

      this.isOwned = false;
      this.owner = null; // object of objects, indexed by node id.

      if (path.isMappingDeclaration()) {
        this.isMapping = true;
        this.mappingKeys = {};
      }
    }
  }

  // If this binding represents a mapping stateVar, then throughout the code, this mapping will be accessed with different keys. Only when we reach that key during traversal can we update this binding to say "this mapping sometimes gets accessed via this particular key"
  addMappingKey(referencingPath) {
    const keyNode =
      referencingPath.parent.indexExpression.expression ||
      referencingPath.parent.indexExpression; // FIXME: the keyNode should always be parent.indexExpression. The reason for the complication is to get 'Msg' for msg.sender, but it'd be better (and make it easier to expand to other struct (MemberAccess) keys in future) if we always use parent.indexExpression. In the case of msg.sender, the keyname would become msg.sender. At the moment, making that change causes the increments stuff to break. :(
    const keyPath = NodePath.getPath(keyNode);
    if (!keyPath) throw new Error('No keyPath found in pathCache');

    if (keyNode.nodeType !== 'Identifier') {
      throw new Error(
        `A mapping key of nodeType '${keyNode.nodeType}' isn't supported yet. We've only written the code for keys of nodeType Identifier'`,
      );
    }

    // naming of the key within mappingKeys:
    let keyName = keyNode.name;
    const keyBinding = keyPath.getReferencedBinding();
    if (keyBinding?.isModified)
      keyName = `${keyName}_${keyBinding.modificationCount}`;

    // add this mappingKey if it hasn't yet been added:
    const mappingKeyExists = !!this.mappingKeys[keyName];
    if (!mappingKeyExists)
      this.mappingKeys[keyName] = new MappingKey(this, keyPath);

    return this.mappingKeys[keyName];
  }

  // A binding will be updated if (some time after its creation) we encounter an AST node which refers to this binding's variable.
  // E.g. if we encounter an Identifier node.
  update(path) {
    if (this.isMapping) {
      this.addMappingKey(path).updateProperties(path);
    } else {
      this.updateProperties(path);
    }
  }

  updateProperties(path) {
    this.addReferencingPath(path);
    if (path.isModification()) this.addModifyingPath(path);
  }

  updateIncrementation(path, state) {
    // The binding level tells us about the state everywhere, so we only need to update if it's whole
    // We update the function level indicators with isIncremented
    if (!path.isIncremented) {
      this.isWhole = true;
      const reason = { src: state.incrementedIdentifier.src, 0: `Overwritten` };
      if (this.isWholeReason) {
        this.isWholeReason.push(reason);
      } else {
        this.isWholeReason = [reason];
      }
    }
  }

  addReferencingPath(path) {
    this.isReferenced = true;
    ++this.referenceCount;
    if (!this.referencingPaths.some(p => p.node.id === path.node.id))
      this.referencingPaths.push(path);
  }

  addModifyingPath(path) {
    this.isModified = true;
    ++this.modificationCount;
    if (!this.modifyingPaths.some(p => p.node.id === path.node.id))
      this.modifyingPaths.push(path);
  }

  addNullifyingPath(path) {
    this.isNullified = true;
    ++this.nullificationCount;
    this.nullifyingPaths.push(path);
  }
}

const commonFunctions = {

};

// add common functions as methods to the classes:
// Object.assign(MappingKey.prototype, commonFunctions);
//
// Object.assign(Binding.prototype, commonFunctions);

/**
 * If a Binding/StateVarIndicator represents a mapping, it will contain a MappingKey class.
 */
export class MappingKey {
  /**
   * A mappingKey can be contained within a binding or an indicator class.
   * @param { Binding || StateVarIndicator } container
   * @param { NodePath } keyPath
   */
  constructor(container, keyPath) {
    this.container = container;

    // TODO: distinguish between if the key is a reference and if the key is not a reference - the prefix 'referenced' is misleading below:
    this.referencedKeyId = keyPath.node.referencedDeclaration;
    this.referencedKeyNodeType = keyPath.isMsg()
      ? 'msg.sender'
      : keyPath.getReferencedNode().nodeType;
    this.referencedKeyIsParam = keyPath.isFunctionParameter(); // is a function parameter - used for finding owner
    this.isMsgSender = keyPath.isMsg(); // used for finding owner
    this.isSecret = container.isSecret;

    this.isReferenced = false;
    this.referenceCount = 0;
    this.referencingPaths = []; // paths which reference this variable

    this.isModified = false;
    this.modificationCount = 0;
    this.modifyingPaths = []; // paths which reference this variable
  }

  updateProperties(path) {
    this.addReferencingPath(path);
    if (path.isModification()) this.addModifyingPath(path);

    this.container.updateProperties(path);
  }

  // TODO: move into commonFunctions (because it's the same function as included in the Binding class)
  addReferencingPath(path) {
    this.isReferenced = true;
    ++this.referenceCount;
    if (!this.referencingPaths.some(p => p.node.id === path.node.id))
      this.referencingPaths.push(path);
  }

  addModifyingPath(path) {
    this.isModified = true;
    ++this.modificationCount;
    if (!this.modifyingPaths.some(p => p.node.id === path.node.id)) {
      this.modifyingPaths.push(path);
    }
  }
}
