/* eslint-disable max-classes-per-file */

import logger from '../utils/logger.mjs';
import { SyntaxUsageError, ZKPError } from '../error/errors.mjs';
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
  // @param referencingPath = NodePath of baseExpression
  addMappingKey(referencingPath) {
    // Just for accessing the mappingKey methods
    const { scope } = referencingPath;
    const keyNode = scope.getMappingKeyIdentifier(referencingPath.parent);
    const keyPath = NodePath.getPath(keyNode);
    if (!keyPath) throw new Error('No keyPath found in pathCache');

    if (keyNode.nodeType !== 'Identifier') {
      throw new Error(
        `A mapping key of nodeType '${keyNode.nodeType}' isn't supported yet. We've only written the code for keys of nodeType Identifier'`,
      );
    }

    // naming of the key within mappingKeys:
    const keyName = scope.getMappingKeyName(referencingPath.parent);

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

  updateOwnership(ownerNode) {
    if (ownerNode.expression?.name === 'msg') ownerNode.name = 'msg';
    if (this.isOwned && this.owner.name !== ownerNode.name) {
      throw new ZKPError(
        `We found two distinct owners (${this.owner.name} and ${ownerNode.name}) of a secret state, which we can't allow because only one public key needs to be able to open/nullify the secret.`,
        this.node,
      );
    }
    this.owner = ownerNode;
    this.isOwned = true;
    if (this.owner.typeDescriptions.typeIdentifier.includes('address'))
      this.onChainKeyRegistry = true;
    if (this.isMapping) {
      for (const [, mappingKey] of Object.entries(this.mappingKeys)) {
        mappingKey.updateOwnership(ownerNode);
      }
    }
  }

  updateBlacklist(blacklistedNode) {
    this.blacklist ??= [];
    this.blacklist.push(blacklistedNode);
  }

  updateAccessed(path) {
    // The binding level tells us about the state everywhere, so we only need to update if it's whole/partitioned
    // TODO split if isMapping
    this.isWhole = true;
    this.isAccessed = true;
    const reason = { src: path.node.src, 0: `Accessed` };
    this.isWholeReason ??= [];
    this.isWholeReason.push(reason);
  }

  updateIncrementation(path, state) {
    // The binding level tells us about the state everywhere, so we only need to update if it's whole/partitioned
    // We update the function level indicators with isIncremented
    // TODO split if isMapping
    if (!path.isIncremented) {
      this.isWhole = true;
      const reason = { src: state.incrementedIdentifier.src, 0: `Overwritten` };
      this.isWholeReason ??= [];
      this.isWholeReason.push(reason);
    } else if (
      !path.isDecremented &&
      (state.incrementedIdentifier.isUnknown ||
        state.incrementedIdentifier.baseExpression?.isUnknown)
    ) {
      this.isPartitioned = true;
      const reason = {
        src: state.incrementedIdentifier.src,
        0: `Incremented and marked as unknown`,
      };
      this.isUnknown ??= true;
      this.isPartitionedReason ??= [];
      this.isPartitionedReason.push(reason);
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
    if (this.isMapping) this.addMappingKey(path).addNullifyingPath(path);
  }

  prelimTraversalErrorChecks() {
    if (!this.isSecret) return;
    if (this.isMapping) {
      for (const [, mappingKey] of Object.entries(this.mappingKeys)) {
        mappingKey.prelimTraversalErrorChecks();
      }
    }
    // warning: state is clearly whole, don't need known decorator
    if (this.isKnown && this.isWhole) {
      logger.warn(
        `PEDANTIC: Unnecessary 'known' decorator. Secret state '${this.name}' is trivially 'known' because it is 'whole', due to:`,
      );
      this.isWholeReason.forEach(reason => {
        console.log(reason[0]);
      });
    }
    // error: no known/unknown mark on any incrementation(s)
    if (
      this.isIncremented &&
      (this.isWhole ?? true) &&
      !this.isDecremented &&
      !this.isKnown &&
      !this.isUnknown
    ) {
      throw new SyntaxUsageError(
        `Secret state '${this.name}' incremented, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know.`,
        this.node,
      );
    }
    // error: conflicting unknown/whole state
    if (this.isUnknown && this.isWhole) {
      throw new SyntaxUsageError(
        `Can't mark a whole state as 'unknown'`,
        this.node,
        this.isWholeReason,
      );
    }
    // error: conflicting whole/partitioned state
    if (this.isWhole && this.isPartitioned) {
      throw new SyntaxUsageError(
        `State cannot be whole and partitioned. The following reasons conflict.`,
        this.node,
        [...this.isWholeReason, ...this.isPartitionedReason],
      );
    }
  }

  /**
   * Decides whether the state/each state in this scope is nullifiable
   * This function exists solely to catch errors.
   * If no errors are found, the calling code will simply carry on.
   */
  isNullifiable() {
    if (this.kind !== 'VariableDeclaration') {
      for (const [, binding] of Object.entries(this.path.scope.bindings)) {
        binding.isNullifiable();
      }
    }
    if (!this.isSecret) return;
    // if (!this.isWhole) return; // commenting out because partitioned states are still useless if they aren't nullifiable.
    if (!this.stateVariable) return;
    if (this.node.isConstant || this.node.constant) return;
    if (this.isMapping) {
      for (const [, mappingKey] of Object.entries(this.mappingKeys)) {
        if (mappingKey.isMsgSender || mappingKey.referencedKeyIsParam) {
          mappingKey.isNullifiable();
          // if a msg sender or param key is nullifiable, then the entire mapping is nullifiable
          return;
        }
      }
      // we reach here, there's no msg sender/param keys, so we must check each one
      for (const [, mappingKey] of Object.entries(this.mappingKeys)) {
        mappingKey.isNullifiable();
      }
      return;
    }
    if (this.isNullified !== true) {
      throw new ZKPError(
        `All whole states must be nullifiable, otherwise they are useless after initialisation! Consider making ${this.name} editable or constant.`,
        this.node,
      );
    }
  }

  /**
   * Decides whether the state is owned.
   * Infers ownership and marks the binding.
   */
  inferOwnership() {
    if (this.kind !== 'VariableDeclaration') return;
    let msgSenderEverywhere;
    this.nullifyingPaths.forEach(path => {
      const functionDefScope = path.scope.getAncestorOfScopeType(
        'FunctionDefinition',
      );
      if (functionDefScope.callerRestriction === 'match') {
        this.updateOwnership(functionDefScope.callerRestrictionNode);
        return;
      }
      if (functionDefScope.callerRestriction === 'exclude') {
        this.updateBlacklist(functionDefScope.callerRestrictionNode);
      }
      if (this.isMapping && this.addMappingKey(path).isMsgSender) {
        // if its unassigned, we assign true
        // if its true, it remains true
        msgSenderEverywhere ??= true;
      } else {
        // if we find a single non-msg sender mapping key, then msg sender can't be the owner
        msgSenderEverywhere = false;
      }
    });
    if (msgSenderEverywhere)
      this.updateOwnership(
        this.addMappingKey(this.nullifyingPaths[0]).keyPath.node,
      );
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
    this.keyPath = keyPath;
    this.isMsgSender = keyPath.isMsg(); // used for finding owner
    this.isSecret = container.isSecret;

    this.name = this.isMsgSender
      ? `${container.name}[msg.sender]`
      : `${container.name}[${keyPath.node.name}]`;

    this.isReferenced = false;
    this.referenceCount = 0;
    this.referencingPaths = []; // paths which reference this variable

    this.isModified = false;
    this.modificationCount = 0;
    this.modifyingPaths = []; // paths which reference this variable

    this.isNullified = false;
    this.nullificationCount = 0;
    this.nullifyingPaths = []; // array of paths of `Identifier` nodes which nullify this binding
  }

  updateProperties(path) {
    this.addReferencingPath(path);
    if (path.isModification()) this.addModifyingPath(path);

    this.container.updateProperties(path);
  }

  updateOwnership(ownerNode) {
    if (ownerNode.expression?.name === 'msg') ownerNode.name = 'msg';
    if (this.isOwned && this.owner.name !== ownerNode.name) {
      throw new ZKPError(
        `We found two distinct owners (${this.owner.name} and ${ownerNode.name}) of a secret state, which we can't allow because only one public key needs to be able to open/nullify the secret.`,
        this.node,
      );
    }
    this.owner = ownerNode;
    this.isOwned = true;
    if (this.owner.typeDescriptions.typeIdentifier.includes('address'))
      this.onChainKeyRegistry = true;
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

  addNullifyingPath(path) {
    this.isNullified = true;
    ++this.nullificationCount;
    this.nullifyingPaths.push(path);
  }

  prelimTraversalErrorChecks() {
    // warning: state is clearly whole, don't need known decorator
    if (this.isKnown && this.isWhole) {
      logger.warn(
        `PEDANTIC: Unnecessary 'known' decorator. Secret state '${this.name}' is trivially 'known' because it is 'whole', due to: ${this.isWholeReason}`,
      );
      this.isWholeReason?.forEach(reason => {
        console.log(reason[0]);
      });
    }
    // error: no known/unknown mark on any incrementation(s)
    if (
      this.isIncremented &&
      (this.isWhole ?? true) &&
      !this.isDecremented &&
      !this.isKnown &&
      !this.isUnknown
    ) {
      throw new SyntaxUsageError(
        `Secret state '${this.name}' incremented, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know.`,
        this.container.node,
      );
    }
    // error: conflicting unknown/whole state
    if (this.isUnknown && this.isWhole) {
      throw new SyntaxUsageError(
        `Can't mark a whole state as 'unknown'`,
        this.node,
        this.isWholeReason,
      );
    }
    // error: conflicting whole/partitioned state
    if (this.isWhole && this.isPartitioned) {
      throw new SyntaxUsageError(
        `State cannot be whole and partitioned. The following reasons conflict.`,
        this.node,
        [...this.isWholeReason, ...this.isPartitionedReason],
      );
    }
  }

  isNullifiable() {
    if (this.isNullified) return;
    // if (!this.isWhole) return; // commenting out because partitioned states are still useless if they aren't nullifiable.
    throw new ZKPError(
      `All whole states must be nullifiable, otherwise they are useless after initialisation! Consider making ${this.name} editable or constant.`,
      this.node,
    );
  }
}
