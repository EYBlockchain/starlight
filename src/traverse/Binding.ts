/* eslint-disable max-classes-per-file, no-param-reassign, no-continue */
import config from 'config';
import logger from '../utils/logger.js';
import { SyntaxUsageError, ZKPError, TODOError } from '../error/errors.js';
import backtrace from '../error/backtrace.js';
import NodePath from './NodePath.js';
import MappingKey from './MappingKey.js';
import { bindingCache } from './cache.js';

export class Binding {

  kind: string; // QUESTION: why not just call it nodeType? In future will 'kind' differ from nodeType?
  id: number;
  name: string;
  node: any;
  path: NodePath;

  isReferenced?: boolean;
  referenceCount: number = 0;
  referencingPaths: NodePath[] = [];

  onChainKeyRegistry?: boolean;


  // Exists to catch nodeTypes for which a binding makes no sense
  static isBindable(nodeType: string): boolean {
    switch (nodeType) {
      case 'ContractDefinition':
      case 'FunctionDefinition':
      case 'VariableDeclaration':
        return true;
      case 'IfStatement':
      case 'ForStatement':
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
      case 'StructDefinition':
      case 'ModifierDefinition':
      case 'EventDefinition':
      case 'EmitStatement':
      case 'Break':
      case 'Continue':
      case 'Conditional':
      case 'WhileStatement':
      case 'DoWhileStatement':
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
  static create(path: NodePath): Binding {
    const { node } = path;

    if (!this.isBindable(node.nodeType)) return null;

    const cachedBinding = bindingCache.get(node);
    if (cachedBinding) return cachedBinding;
    let binding: Binding;
    if (node.nodeType === 'VariableDeclaration') {
      binding = new VariableBinding(path);
    } else {
      binding = new Binding(path);
    }
    bindingCache.set(node, binding);
    return binding;
  }

  constructor(path: NodePath) {
    const {
      node: { name, id, nodeType },
      node,
    } = path;

    this.kind = nodeType; // QUESTION: why not just call it nodeType? In future will 'kind' differ from nodeType?
    this.id = id;
    this.name = name;
    this.node = node;
    this.path = path;

  }

  static getBinding(node: any) {
    if (bindingCache.has(node)) return bindingCache.get(node);
    logger.warn(`Node ${node.name} not found in bindingCache`);
    return null;
  }

  update(path: NodePath) {
    this.updateProperties(path);
  }

  updateProperties(path: NodePath) {
    this.addReferencingPath(path);
  }

  addReferencingPath(path: NodePath) {
    this.isReferenced = true;
    ++this.referenceCount;
    if (!this.referencingPaths.some(p => p.node.id === path.node.id))
      this.referencingPaths.push(path);
  }

  isNullifiable() {
    const bindings: [string, Binding][] = Object.entries(this.path.scope.bindings);
    for (const [, binding] of bindings) {
      binding.isNullifiable();
    }
  }
}

export class VariableBinding extends Binding {
  isSecret: boolean;
  stateVariable: boolean;

  isModified: boolean;
  modificationCount: number = 0;
  modifyingPaths: NodePath[] = []; // array of paths of `Identifier` nodes which modify this variable
  // NOTE: modification _is_ nullification, unless it's a partitioned state being incremented (in which case there's no nullifier). So nullifyingPaths is a subset of modifyingPaths.

  isNullified?: boolean;
  nullificationCount: number = 0;
  nullifyingPaths: NodePath[] = []; // array of paths of `Identifier` nodes which nullify this binding

  increments: any[] = []; // array of nodes
  decrements: any[] = []; // array of nodes

  isMapping?: boolean;
  mappingKeys: any = {}; // object of objects, indexed by node id.

  isStruct?: boolean;
  structProperties: any = {};

  isKnown?: boolean;
  isUnknown?: boolean;
  isIncremented?: boolean;
  isDecremented?: boolean;
  isWhole?: boolean;
  isAccessed?: boolean;
  isPartitioned?: boolean;
  isBurned?: boolean;
  reinitialisable?: boolean;
  initialisedInConstructor?: boolean;
  encryptionRequired?: boolean;

  isWholeReason?: {}[];
  isPartitionedReason?: {}[];

  blacklist?: any[];




  isOwned?: boolean;
  owner: any = null; // object of objects, indexed by node id.

  constructor(path: NodePath) {
    super(path);
    const {
      node: { name },
      node,
    } = path;

    if (!path.isNodeType('VariableDeclaration') && !path.getAncestorOfType('IndexAccess')) {
      throw new TypeError(`Binding for ${name} cannot be a VariableBinding`);
    }

    this.stateVariable = node.stateVariable;

    this.isSecret = node.isSecret ?? false;


    if (path.isMappingDeclaration() || path.isArrayDeclaration()) {
      this.isMapping = true;
      this.mappingKeys = {};
    }

    if (path.isStruct()) {
      this.isStruct = true;
      this.structProperties = {};
    }
  }

  /**
   * Gets a mapping's indicator object for a particular key.
   * @param {Object} - the mapping's index access node.
   * @returns {String} - the name under which the mapping[key]'s indicator is stored
   */
  getMappingKeyName(path: NodePath): string {
    return path.scope.getMappingKeyName(path) || ``;
  }

  // If this binding represents a mapping stateVar, then throughout the code, this mapping will be accessed with different keys. Only when we reach that key during traversal can we update this binding to say "this mapping sometimes gets accessed via this particular key"
  // @param referencingPath = NodePath of baseExpression
  addMappingKey(referencingPath: NodePath): MappingKey {
    const keyNode = referencingPath.getMappingKeyIdentifier();
    const keyPath = NodePath.getPath(keyNode);
    if (!keyPath) throw new Error('No keyPath found in pathCache');

    // if (keyNode.nodeType !== 'Identifier') {
    //   throw new TODOError(
    //     `A mapping key of nodeType '${keyNode.nodeType}' isn't supported yet. We've only written the code for keys of nodeType Identifier'`,
    //     keyNode,
    //   );
    // }

    // naming of the key within mappingKeys:
    const keyName = this.getMappingKeyName(referencingPath);

    // add this mappingKey if it hasn't yet been added:
    const mappingKeyExists = !!this.mappingKeys[keyName];
    if (!mappingKeyExists)
      this.mappingKeys[keyName] = new MappingKey(this, keyPath);

    return this.mappingKeys[keyName];
  }

  addStructProperty(referencingPath: NodePath): MappingKey {
    // we DONT want to add a struct property if we have a mapping of a struct
    // the mappingKey deals with that
    if (this.isMapping && this.addMappingKey(referencingPath).structProperties) return this.addMappingKey(referencingPath).addStructProperty(referencingPath);

    const keyNode = referencingPath.getStructPropertyNode();
    const keyPath = keyNode.id === referencingPath.node.id ? referencingPath : referencingPath.getAncestorOfType('MemberAccess');
    if (!keyPath) throw new Error('No keyPath found in pathCache');
    if (!this.structProperties[keyNode.memberName])
      this.structProperties[keyNode.memberName] = new MappingKey(this, keyPath, true);

    return this.structProperties[keyNode.memberName];
  }

  // A binding will be updated if (some time after its creation) we encounter an AST node which refers to this binding's variable.
  // E.g. if we encounter an Identifier node.
  update(path: NodePath) {
    if (this.isMapping && path.getAncestorOfType('IndexAccess')) {
      this.addMappingKey(path).updateProperties(path);
    } else if (this.isStruct && path.getAncestorOfType('MemberAccess')) {
      this.addStructProperty(path).updateProperties(path);
    } else {
      this.updateProperties(path);
    }
  }

  updateProperties(path: NodePath) {
    this.addReferencingPath(path);
    this.isUnknown ??= path.node.isUnknown;
    this.isKnown ??= path.node.isKnown;
    this.reinitialisable ??= path.node.reinitialisable;
    if (path.isModification()) this.addModifyingPath(path);
  }

  updateOwnership(ownerNode: any, msgIsMappingKeyorMappingValue?: string | null) {
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
          !thisPath.isMsgSender(binOpNode.rightExpression) &&
          !thisPath.isMsgValue(binOpNode.leftExpression) &&
          !thisPath.isMsgValue(binOpNode.rightExpression)
        )
          throw new Error(`The new msg.sender ownership code didn't work!`);
        // extracting this particular msg.sender node to maintain node.src
        const thisMsgSenderNode = (thisPath.isMsgSender(binOpNode.leftExpression) || thisPath.isMsgValue(binOpNode.leftExpression))
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
    const ownerBinding = this.path.getReferencedBinding(ownerNode);
    ownerNode.isSecret ??= ownerBinding instanceof VariableBinding ? ownerBinding.isSecret : null;
    if (
      this.owner.typeDescriptions.typeIdentifier.includes('address') ||
      this.owner.name === 'msg'
    )
      this.onChainKeyRegistry = true;
    if (this.isMapping) {
      const mappingKeys: [string, MappingKey][] = Object.entries(this.mappingKeys);
      for (const [, mappingKey] of mappingKeys) {
        mappingKey.updateOwnership(ownerNode);
      }
    }

    if (this.isStruct) {
      const structProperties: [string, MappingKey][] = Object.entries(this.structProperties);
      for (const [, mappingKey] of structProperties) {
        mappingKey.updateFromBinding();
      }
    }
  }

  updateBlacklist(blacklistedNode: any) {
    this.blacklist ??= [];
    this.blacklist.push(blacklistedNode);
  }

  updateAccessed(path: NodePath) {
    // The binding level tells us about the state everywhere, so we only need to update if it's whole/partitioned
    this.isWhole = true;
    this.isAccessed = true;
    const reason = { src: path.node.src, 0: `Accessed` };
    this.isWholeReason ??= [];
    this.isWholeReason.push(reason);

    if (this.isMapping && path.getAncestorOfType('IndexAccess')) {
      this.addMappingKey(path).isAccessed = true;
      this.addMappingKey(path).accessedPaths ??= [];
      this.addMappingKey(path).accessedPaths.push(path);
    }

    if (this.isStruct && path.getAncestorOfType('MemberAccess')) {
      this.addStructProperty(path).isAccessed = true;
      this.addStructProperty(path).accessedPaths ??= [];
      this.addStructProperty(path).accessedPaths.push(path);
    }
  }

  updateIncrementation(path: NodePath, state: any) {
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
        state.incrementedIdentifier.baseExpression?.isUnknown ||
        state.incrementedIdentifier.expression?.baseExpression?.isUnknown )
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

  addModifyingPath(path: NodePath) {
    this.isModified = true;
    ++this.modificationCount;
    if (!this.modifyingPaths.some(p => p.node.id === path.node.id))
      this.modifyingPaths.push(path);
  }

  addNullifyingPath(path: NodePath) {
    this.isNullified = true;
    ++this.nullificationCount;
    this.nullifyingPaths.push(path);
    if (this.isMapping && path.getAncestorOfType('IndexAccess')) this.addMappingKey(path).addNullifyingPath(path);
    if (this.isStruct && path.getAncestorOfType('MemberAccess')) this.addStructProperty(path).addNullifyingPath(path);
  }

  prelimTraversalErrorChecks() {
    if (!this.isSecret) return;
    if (this.isMapping) {
      const mappingKeys: [string, MappingKey][] = Object.entries(this.mappingKeys);
      for (const [, mappingKey] of mappingKeys) {
        mappingKey.prelimTraversalErrorChecks();
      }
    }
    if (this.isStruct) {
      const structProperties: [string, MappingKey][] = Object.entries(this.structProperties);
      for (const [, mappingKey] of structProperties) {
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
      if (this.isWholeReason && this.isPartitionedReason)
        throw new SyntaxUsageError(
          `State cannot be whole and partitioned. The following reasons conflict.`,
          this.node,
          [...this.isWholeReason, ...this.isPartitionedReason],
        );
      else throw new SyntaxUsageError(
        `State ${this.name} cannot be whole and partitioned`,
        this.node,
        []
      )
    }
  }

  /**
   * Decides whether the state/each state in this scope is nullifiable
   * This function exists solely to catch errors.
   * If no errors are found, the calling code will simply carry on.
   */
  isNullifiable() {
    if (!this.isSecret) return;
    if (!this.stateVariable) return;
    if (this.node.isConstant || this.node.constant) return;
    if (this.isMapping) {
      const mappingKeys: [string, MappingKey][] = Object.entries(this.mappingKeys);
      for (const [, mappingKey] of mappingKeys) {
        if (mappingKey.isMsgSender || mappingKey.referencedKeyIsParam) {
          if (mappingKey.isNullifiable()) return;
          // if a msg sender or param key is nullifiable, then the entire mapping is nullifiable
        }
      }
      // we reach here, there's no msg sender/param keys, so we must check each one
      for (const [, mappingKey] of mappingKeys) {
        if (!mappingKey.isNullifiable() && !mappingKey.isAccessed && this.isWhole)
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
    let msgSenderEverywhereMappingKey: boolean = false;
    let msgSenderEverywhereMappingValue: boolean = false;
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
      if (this.isMapping && path.getAncestorOfType('IndexAccess') && this.addMappingKey(path).isMsgSender ) {
        // if its unassigned, we assign true
        // if its true, it remains true
        msgSenderEverywhereMappingKey ??= true;
      } else if (
        this.isMapping && path.getAncestorOfType('IndexAccess') &&
        (path.isMsgSender(path.getCorrespondingRhsNode()) || path.isMsgValue(path.getCorrespondingRhsNode()))
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
      const mappingKeys: [string, MappingKey][] = Object.entries(this.mappingKeys);
      for (const [, mappingKey] of mappingKeys) {
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
            if (burnPath) burnPath.isBurnStatement = true;
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
    } else if (ownerBinding && ownerBinding instanceof VariableBinding) {
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
          const exp = path.getAncestorOfType('ExpressionStatement');
          if (exp) exp.isBurnStatement = true;
          const ind = path.scope.getReferencedIndicator(path.node);
          if (ind) ind.addBurningPath(path);
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
      if (logger.level === 'debug') backtrace.getSourceCode(node.src);
      this.isBurned = true;
      // TODO more useful indicators here
    }
  }
}
