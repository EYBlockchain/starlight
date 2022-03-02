/* eslint-disable max-classes-per-file, no-param-reassign, no-continue */
import config from 'config';
import logger from '../utils/logger.mjs';
import { SyntaxUsageError, ZKPError, TODOError } from '../error/errors.mjs';
import backtrace from '../error/backtrace.mjs';
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

  static getBinding(node) {
    if (bindingCache.has(node)) return bindingCache.get(node);
    logger.warn(`Node ${node.name} not found in bindingCache`);
    return null;
  }

  /**
   * Gets a mapping's indicator object for a particular key.
   * @param {Object} - the mapping's index access node.
   * @returns {String} - the name under which the mapping[key]'s indicator is stored
   */
  // TODO move to common functions
  getMappingKeyName(path) {
    const { node } = path;
    if (node.nodeType !== 'IndexAccess')
      return this.getMappingKeyName(path.getAncestorOfType('IndexAccess'));
    const keyIdentifierNode = path.getMappingKeyIdentifier();
    if (!keyIdentifierNode)
      return node.indexExpression.name || node.indexExpression.value;
    const keyBinding = path.isMsg(keyIdentifierNode)
      ? null
      : Binding.getBinding(path.getReferencedNode(keyIdentifierNode));
    let keyName = keyIdentifierNode.name;

    // If the value of the mapping key is edited between mapping accesses then the below copes with that.
    // NB: we can't use the modification count because this may refer to a mappingKey before its modified for the nth time
    if (keyBinding?.isModified) {
      let i = 0;
      // Consider each time the variable (which becomes the mapping's key) is edited throughout the scope:
      for (const modifyingPath of keyBinding.modifyingPaths) {
        // we have found the 'current' state (relative to the input node), so we don't need to move any further
        if (node.id < modifyingPath.node.id && i === 0) break;
        i++;
        if (
          modifyingPath.node.id < node.id && // a modification to the variable _before_ it was used as the mapping's key
          node.id < keyBinding.modifyingPaths[i]?.node.id
        )
          break;
      }
      if (i > 0) keyName = `${keyIdentifierNode.name}_${i}`;
    }
    return keyName;
  }

  // If this binding represents a mapping stateVar, then throughout the code, this mapping will be accessed with different keys. Only when we reach that key during traversal can we update this binding to say "this mapping sometimes gets accessed via this particular key"
  // @param referencingPath = NodePath of baseExpression
  addMappingKey(referencingPath) {
    const keyNode = referencingPath.getMappingKeyIdentifier();
    const keyPath = NodePath.getPath(keyNode);
    if (!keyPath) throw new Error('No keyPath found in pathCache');

    if (keyNode.nodeType !== 'Identifier') {
      throw new TODOError(
        `A mapping key of nodeType '${keyNode.nodeType}' isn't supported yet. We've only written the code for keys of nodeType Identifier'`,
        keyNode,
      );
    }

    // naming of the key within mappingKeys:
    const keyName = this.getMappingKeyName(referencingPath);

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
    this.isUnknown ??= path.node.isUnknown;
    this.isKnown ??= path.node.isKnown;
    this.reinitialisable ??= path.node.reinitialisable;
    if (path.isModification()) this.addModifyingPath(path);
  }

  updateOwnership(ownerNode, msgIsMappingKeyorMappingValue = false) {
    if (
      ownerNode.expression?.name === 'msg' &&
      msgIsMappingKeyorMappingValue === 'value'
    ) {
      // here: the owner is msg.sender for mapping[key] = msg.sender
      ownerNode.name = 'msg';
      ownerNode.mappingOwnershipType = 'value';
    } else if (ownerNode.expression?.name === 'msg') {
      // here: the owner is msg.sender for mapping[msg.sender] = value
      ownerNode.name = 'msg';
      ownerNode.mappingOwnershipType = 'key';
    }
    if (!msgIsMappingKeyorMappingValue && ownerNode.baseExpression) {
      // here: the key is not msg and we don't know if we have a key or value owner, if at all
      // the input ownerNode is either 1. msg.sender or 2. whatever msg.sender must equal
      // above deals with 1., here deals with 2. if isMapping
      if (ownerNode.baseExpression.referencedDeclaration === this.id) {
        // if the ownerNode is the same as this node, then the value rep. the owner
        const thisPath = NodePath.getPath(ownerNode);
        const binOpNode = thisPath.getAncestorOfType('BinaryOperation').node;
        if (
          binOpNode.operator !== '==' &&
          !thisPath.isMsgSender(binOpNode.leftExpression) &&
          !thisPath.isMsgSender(binOpNode.rightExpression)
        )
          throw new Error(`The new msg.sender ownership code didn't work!`);
        // extracting this particular msg.sender node to maintain node.src
        const thisMsgSenderNode = thisPath.isMsgSender(binOpNode.leftExpression)
          ? binOpNode.leftExpression
          : binOpNode.rightExpression;
        this.updateOwnership(thisMsgSenderNode, 'value');
        return;
      }
    } else {
      ownerNode.mappingOwnershipType = msgIsMappingKeyorMappingValue;
    }
    if (this.isOwned && this.owner.name !== ownerNode.name) {
      throw new ZKPError(
        `We found two distinct owners (${this.owner.name} and ${ownerNode.name}) of a secret state, which we can't allow because only one public key needs to be able to open/nullify the secret.`,
        this.node,
      );
    }
    if (
      this.isOwned &&
      this.owner.mappingOwnershipType !== ownerNode.mappingOwnershipType
    ) {
      throw new ZKPError(
        `We found two distinct owners of a secret state - msg.sender when the mapping key is msg.sender, and when the mapping value is msg.sender, which we can't allow because only one public key needs to be able to open/nullify the secret.`,
        this.node,
      );
    }
    ownerNode.isParam = NodePath.getPath(ownerNode).isFunctionParameter();
    this.owner = ownerNode;
    this.isOwned = true;
    if (
      this.owner.typeDescriptions.typeIdentifier.includes('address') ||
      this.owner.name === 'msg'
    )
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
      console.log('err 1');
      throw new SyntaxUsageError(
        `Can't mark a whole state as 'unknown'`,
        this.node,
        this.isWholeReason,
      );
    }

    // error: conflicting reinitialisable/partitioned state
    if (this.reinitialisable && this.isPartitioned) {
      throw new SyntaxUsageError(
        `Can't mark a partitioned state as 'reinitialisable' - partitioned states do not need nullfiers to initialise/add to, so there's no need for this syntax.`,
        this.node,
        this.isPartitionedReason,
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
    if (!this.stateVariable) return;
    if (this.node.isConstant || this.node.constant) return;
    if (this.isMapping) {
      for (const [, mappingKey] of Object.entries(this.mappingKeys)) {
        if (mappingKey.isMsgSender || mappingKey.referencedKeyIsParam) {
          if (mappingKey.isNullifiable()) return;
          // if a msg sender or param key is nullifiable, then the entire mapping is nullifiable
        }
      }
      // we reach here, there's no msg sender/param keys, so we must check each one
      for (const [, mappingKey] of Object.entries(this.mappingKeys)) {
        if (!mappingKey.isNullifiable() && this.isWhole)
          throw new ZKPError(
            `All whole states must be nullifiable, otherwise they are useless after initialisation! Consider making ${this.name} editable or constant.`,
            this.node,
          );
      }
      return;
    }
    if (this.isNullified !== true && this.isWhole) {
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
    let msgSenderEverywhereMappingKey;
    let msgSenderEverywhereMappingValue;
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
        msgSenderEverywhereMappingKey ??= true;
      } else if (
        this.isMapping &&
        path.isMsgSender(path.getCorrespondingRhsNode())
      ) {
        msgSenderEverywhereMappingValue ??= true;
      } else {
        // if we find a single non-msg sender mapping key, then msg sender can't be the owner
        msgSenderEverywhereMappingKey = false;
        msgSenderEverywhereMappingValue = false;
      }
    });
    if (msgSenderEverywhereMappingKey && !msgSenderEverywhereMappingValue) {
      // pass the msg.sender node to the updateOwnership method
      this.updateOwnership(
        this.addMappingKey(this.nullifyingPaths[0]).keyPath.node,
        'key',
      );
    } else if (msgSenderEverywhereMappingValue) {
      // pass the msg.sender node to the updateOwnership method
      const owner =
        this.nullifyingPaths[0].parent.rightHandSide ||
        this.nullifyingPaths[0].parentPath.parent.rightHandSide;
      this.updateOwnership(owner, 'value');
    }
  }

  ownerSetToZeroCheck() {
    // TODO rename - this method also marks 'burn' statements
    const ownerNode = this.owner;
    const ownerBinding = this.path.getReferencedBinding(ownerNode);

    // mapping[msg.sender] is owned by msg.sender => look for mapping[0]
    if (ownerNode.name === 'msg' && ownerNode.mappingOwnershipType === 'key') {
      // the owner is represented by the mapping key - we look through the keys for 0
      for (const [, mappingKey] of Object.entries(this.mappingKeys)) {
        // TODO we can't yet set mappingKeys to anything not an identifier
        const keyNode = mappingKey.keyPath.node;
        if (
          keyNode.nodeType === 'FunctionCall' &&
          keyNode.arguments[0]?.value === '0'
        ) {
          // we have found an owner set to hardcoded 0
          this.ownerSetToZeroWarning(keyNode);
          if (this.reinitialisable) {
            const burnPath = mappingKey.keyPath.getAncestorOfType(
              'ExpressionStatement',
            );
            burnPath.isBurnStatement = true;
            // TODO call updateBurnStatement in indicator
          }
        }
      }
    }
    // mapping[key] = msg.sender is owned by msg.sender => look for mapping[key] = 0
    // OR owner is some value (admin = address) => look for admin = 0
    if (
      ownerNode.name === 'msg' &&
      ownerNode.mappingOwnershipType === 'value'
    ) {
      // the owner is represented by the mapping value - we look through the modifyingPaths for 0
      this.searchModifyingPathsForZero();
    } else if (ownerBinding) {
      ownerBinding.searchModifyingPathsForZero();
    }
    if (this.reinitialisable && !this.isBurned)
      throw new SyntaxUsageError(
        `The state ${this.name} has been marked as reinitialisable but we can't find anywhere to burn a commitment ready for reinitialisation.`,
        this.node,
      );
  }

  searchModifyingPathsForZero() {
    for (const path of this.modifyingPaths) {
      const assignmentNode = path.getAncestorOfType('Assignment')?.node;
      if (!assignmentNode) continue;
      if (
        assignmentNode.rightHandSide.nodeType === 'FunctionCall' &&
        assignmentNode.rightHandSide.arguments[0]?.value === '0' &&
        (assignmentNode.leftHandSide.id === path.node.id ||
          assignmentNode.leftHandSide.baseExpression.id === path.node.id)
      ) {
        // we have found an owner set to hardcoded 0
        this.ownerSetToZeroWarning(assignmentNode);
        if (this.reinitialisable) {
          path.getAncestorOfType('ExpressionStatement').isBurnStatement = true;
          path.scope.getReferencedIndicator(path.node).addBurningPath(path);
        }
      }
    }
  }

  ownerSetToZeroWarning(node = this.node) {
    if (!this.reinitialisable) {
      logger.warn(
        `This line resets the public key inside the commitment (i.e. the owner) to 0. This means you relinquish ownership of the state and it can never be used again. \nIf you want the state to be burned and reset, mark the line where it is initialised as reinitialisable. Without doing so, you end up with a secret state of no owner which nobody can access.`,
      );
      backtrace.getSourceCode(node.src);
    } else {
      logger.debug(
        `Found a statement which burns the secret state and allows it to be reinitialised. If this line isn't meant to do that, check why you are setting the address to 0.`,
      );
      if (config.log_level === 'debug') backtrace.getSourceCode(node.src);
      this.isBurned = true;
      // TODO more useful indicators here
    }
  }
}

const commonFunctions = {};

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
    this.isUnknown ??= path.node.isUnknown;
    this.isKnown ??= path.node.isKnown;
    this.reinitialisable ??= path.node.reinitialisable;
    if (path.isModification()) this.addModifyingPath(path);

    this.container.updateProperties(path);
  }

  updateOwnership(ownerNode) {
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
      console.log('err 2');
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
    // in some cases, it's fine for certain mapping keys to not be nullifiable, as a parameter key means that any key is nullifiable
    // so, we don't throw an error here
    return !!this.isNullified;
  }
}
