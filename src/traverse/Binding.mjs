/* eslint-disable max-classes-per-file */

import logger from '../utils/logger.mjs';
import NodePath from './NodePath.mjs';

export default class Binding {
  // Exists to catch nodeTypes for which a binding makes no sense
  static isBindable(nodeType) {
    switch (nodeType) {
      case 'ContractDefinition' ||
        'FunctionDefinition' ||
        'Identifier' ||
        'FunctionCall':
        return true;
      case 'ArrayTypeName' ||
        'Assignment' ||
        'Block' ||
        'BinaryOperation' ||
        'ElementaryTypeName' ||
        'ElementaryTypeNameExpression' ||
        'ExpressionStatement' ||
        'Identifier' ||
        'ImportDirective' ||
        'IndexAccess' ||
        'Literal' ||
        'Mapping' ||
        'MemberAccess' ||
        'ParameterList' ||
        'PragmaDirective' ||
        'Return' ||
        'TupleExpression' ||
        'UnaryOperation' ||
        'UserDefinedTypeName' ||
        'VariableDeclaration' ||
        'VariableDeclarationStatement':
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
    if (!this.isBindable(path.node.nodeType)) return null;
    return new Binding(path);
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
      this.referencedCount = 0;
      this.referencingPaths = null; // array of paths of `Identifier` nodes which reference this variable

      this.isModified = false;
      this.modificationCount = 0;
      this.modifyingPaths = null; // array of paths of `Identifier` nodes which modify this variable
      // NOTE: modification _is_ nullification, unless it's a partitioned state being incremented (in which case there's no nullifier). So nullifyingPaths is a subset of modifyingPaths.

      this.isNullified = false;
      this.nullificationCount = 0;
      this.nullifyingPaths = null; // array of paths of `Identifier` nodes which nullify this binding

      this.increments = null; // array of nodes
      this.decrements = null; // array of nodes

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

      return;
    }

    if (path.isNodeType('Identifier')) {
      // TODO: the below check probably belongs in the scope checks, rather than in here. (Because it needs to be caught before trying to initialise either a binding &or an indicator etc.)
      if (
        path.isMsg() ||
        path.isRequire() ||
        path.isThis() ||
        path.isExportedSymbol()
      )
        return;

      const referencedBinding = path.getReferencedBinding();
      if (!referencedBinding)
        throw new Error(
          `Couldn't find a referencedDeclaration node for the current Identifier node.  I.e. couldn't find a node with id ${node.referencedDeclaration}`,
        );
    }
  }

  // If this binding represents a mapping stateVar, then throughout the code, this mapping will be accessed with different keys. Only when we reach that key during traversal can we update this binding to say "this mapping sometimes gets accessed via this particular key"
  addMappingKey(referencingPath) {
    if (!this.isMapping) return;
    const keyNode = referencingPath.parent.indexExpression;
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
      this.mappingKeys[keyName] = new MappingKey(this, keyNode);
  }

  /**
   * @desc As we traverse through the AST, each node we reach will provide more
   * info to add (as properties) to `this`.
   * @param {NodePath} path
   */
  update(path) {
    const {
      node: { name, id, nodeType },
      parent,
    } = path;
  }

  addNullifyingPath(path) {
    this.isNullified = true;
    ++this.nullificationCount;
    this.modifyingPaths.push(path);
    // QUESTION: also update modifications? (Because a nullification => modification)
    this.addModifyingPath(path);
  }
}

/**
 * If a Binding represents a mapping, it will contain a MappingKeys class.
 */
export class MappingKey {
  constructor(binding, keyPath) {
    // TODO: distinguish between if the key is a reference and if the key is not a reference - the prefix 'referenced' is misleading below:
    this.referenceKeyId = keyPath.node.referencedDeclaration;
    this.referencedKeyNodeType = keyPath.isMsgSender()
      ? 'msg.sender'
      : keyPath.getReferencedNode().nodeType;
    this.referencedKeyIsParam = keyPath.isFunctionParameter(); // is a function parameter - used for finding owner
    this.isMsgSender = keyPath.isMsg(); // used for finding owner
    this.isSecret = binding.isSecret;
    this.isReferenced = false;
    this.referenceCount = 0;
    this.referencingPaths = []; // paths which reference this binding
    this.isModified = false;
    this.modificationCount = 0;
    this.modifyingPaths = []; // paths which reference this binding;
  }
}

const commonFunctions = {
  // nullification => modification => referencing
  /**
   * @this { Binding || MappingKey }
   */
  addReferencingPath(path) {
    this.isReferenced = true;
    ++this.referenceCount;
    this.referencingPaths.push(path);
  },

  /**
   * @this { Binding || MappingKey }
   */
  addModifyingPath(path) {
    this.isModified = true;
    ++this.modificationCount;
    this.modifyingPaths.push(path);
    // QUESTION: also update references? (Because a modification is a reference)
    this.addReferencingPath(path);
  },
};

// add common functions as methods to the classes:
Object.assign(MappingKey.prototype, commonFunctions);

Object.assign(Binding.prototype, commonFunctions);
