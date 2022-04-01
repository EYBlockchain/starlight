/* eslint-disable max-classes-per-file, no-param-reassign */

import NodePath from './NodePath.js';
import Scope from './Scope.js';
import MappingKey from './MappingKey.js';
import { VariableBinding } from './Binding.js';
import logger from '../utils/logger.js';
import backtrace from '../error/backtrace.js';
import { SyntaxUsageError } from '../error/errors.js';


export class ContractDefinitionIndicator {
  zkSnarkVerificationRequired: boolean;
  oldCommitmentAccessRequired: boolean;
  nullifiersRequired: boolean;
  newCommitmentsRequired: boolean;
  initialisationRequired?: boolean;
  containsAccessedOnlyState?: boolean;
  constructor() {
    this.zkSnarkVerificationRequired = false;
    this.oldCommitmentAccessRequired = false;
    this.nullifiersRequired = false;
    this.newCommitmentsRequired = false;
  }

  // A ContractDefinitionIndicator will be updated if (some time after its creation) we encounter an AST node which gives us more information about the contract's global states
  // E.g. if we encounter a VariableDeclaration node for a secret state.
  update(path: NodePath) {
    if (path.node.isSecret) {
      // These Indicator properties are used to construct import statements & boilerplate for the shield contract AST:
      this.newCommitmentsRequired = true;
      this.zkSnarkVerificationRequired = true;
    }
  }

  updateIncrementation(path: NodePath, state: any) {
    // if an incrementation is marked as unknown anywhere, the binding will know
    if (
      !path.isIncremented ||
      state.incrementedIdentifier.isKnown
    ) {
      // a reinitialised state does require new commitments
      this.newCommitmentsRequired = true;
      this.initialisationRequired = true;
      // a reinitialised state does not require a nullifier
      if (
        state.incrementedPath &&
        !state.incrementedIdentifier.reinitialisable
      ) {
        this.nullifiersRequired = true;
        this.oldCommitmentAccessRequired = true;
      }
      // an incremented, but not decremented, state only needs a new commitment
    } else if (
      !path.isDecremented &&
      (state.incrementedIdentifier.isUnknown ||
        state.incrementedIdentifier.baseExpression?.isUnknown)
    ) {
      this.newCommitmentsRequired = true;
      // we may have an incrementation not marked as unknown in this scope:
    } else if (!path.isDecremented) {
      this.newCommitmentsRequired = true;
    }
    if (path.isDecremented && !state.incrementedIdentifier.isKnown) {
      this.nullifiersRequired = true;
      this.newCommitmentsRequired = true;
      this.oldCommitmentAccessRequired = true;
    }
  }
}

export class FunctionDefinitionIndicator extends ContractDefinitionIndicator {

  parentIndicator: ContractDefinitionIndicator;
  interactsWithSecret?: boolean;
  interactsWithPublic?: boolean;
  internalFunctionInteractsWithSecret?: boolean;
  onChainKeyRegistry?: boolean;

  constructor(scope: Scope) {
    super();
    this.initialisationRequired = false;
    this.parentIndicator = scope.parentScope.indicators;
  }

  update(path: NodePath) {
    if (path.node.isSecret) {
      // These Indicator properties are used to construct import statements & boilerplate for the shield contract AST:
      this.interactsWithSecret = true;
      this.zkSnarkVerificationRequired = true;

    }

    if(path.node.typeDescriptions.typeIdentifier.includes(`_internal_`))
      {  
        const functionReferncedNode = path.scope.getReferencedNode(path.node);
        const params = functionReferncedNode.parameters.parameters ;
          if(params.some(node => node.isSecret))
          {
            this.internalFunctionInteractsWithSecret = true; }
    }

  }

  updateIncrementation(path: NodePath, state: any) {
    this.parentIndicator.updateIncrementation(path, state);
    // if an incrementation is marked as unknown anywhere, the binding will know
    if (
      !path.isIncremented ||
      state.incrementedIdentifier.isKnown
    ) {
      // a reinitialised state does require new commitments
      this.newCommitmentsRequired = true;
      this.initialisationRequired = true;
      // a reinitialised state does not require a nullifier
      if (
        state.incrementedPath &&
        !state.incrementedIdentifier.reinitialisable
      ) {
        this.nullifiersRequired = true;
        this.oldCommitmentAccessRequired = true;
      }
      // an incremented, but not decremented, state only needs a new commitment
    } else if (
      !path.isDecremented &&
      (state.incrementedIdentifier.isUnknown ||
        state.incrementedIdentifier.baseExpression?.isUnknown)
    ) {
      this.newCommitmentsRequired = true;
      // we may have an incrementation not marked as unknown in this scope:
    } else if (!path.isDecremented) {
      this.newCommitmentsRequired = true;
    }
    if (path.isDecremented && !state.incrementedIdentifier.isKnown) {
      this.nullifiersRequired = true;
      this.newCommitmentsRequired = true;
      this.oldCommitmentAccessRequired = true;
    }
  }

  updateNewCommitmentsRequired() {
    // if we have burn statements, there are some scopes where we don't need new commitments at all
    let burnedOnly = true;
    for (const [, stateVarIndicator] of Object.entries(this)) {
      if (!(stateVarIndicator instanceof StateVariableIndicator)) continue; // eslint-disable-line no-continue, no-use-before-define
      // if we have a indicator which is NOT burned, then we do need new commitments
      if (
        stateVarIndicator.isSecret &&
        (!stateVarIndicator.isBurned || stateVarIndicator.newCommitmentsRequired)
      ) {
        burnedOnly = false;
        break;
      }
    }
    this.newCommitmentsRequired = !burnedOnly;
  }

  // no constructor yet...
  //
  // BIG COMMENT FOR INFO ONLY
  // id: { // Although state variables have unique names, id is more consistent with other objects
  //   id: state_var_node_id
  //   name: state_var_name,
  //   binding: { binding_of_var_decl },
  //   isReferenced: true,
  //   referenceCount: 3,
  //   referencingPaths: [
  //     path_of_identifier,
  //     path_of_identifier,
  //     ...
  //   ], // we use an array to preserve the order of references
  //   isModified: true,
  //   modificationCount: 1,
  //   modifyingPaths: [
  //     path_of_identifier,
  //     path_of_identifier,
  //     ...
  //   ], // a subset of referencingPaths. // we use an array to preserve the order of references
  //   nullifyingPaths: [
  //     path_of_identifier,
  //     path_of_identifier,
  //     ...
  //   ], // a subset of modifyingPaths. // we use an array to preserve the order of references
  //   oldCommitmentAccessRequired: true,
  //   isNullified: true,
  //   initialisationRequired: true,
  //   newCommitmentsRequired: true,
  // }
}
/**
 * Within a Function's scope, for each local variable that gets declared, we
 * create a 'LocalVariableIndicator'.
 */
export class LocalVariableIndicator extends FunctionDefinitionIndicator {

  parentIndicator: FunctionDefinitionIndicator;
  id: number;
  name: string;
  scope: Scope;
  node: any;

  isReferenced?: boolean;
  referenceCount: number;
  referencingPaths: NodePath[];
  isModified?: boolean;
  modificationCount: number;
  modifyingPaths: NodePath[];
  interactsWith: NodePath[];
  isParam: boolean;

  initialValue?: any;

  /** @param {NodePath} path the path of the localVariable for which we're creating an indicator
   */
  constructor(path: NodePath) {
    super(path.scope);
    this.id = path.node.id;
    this.name = path.node.name;
    this.scope = path.scope;
    this.node = path.node;
    this.parentIndicator = path.scope.indicators;

    this.referenceCount = 0;
    this.referencingPaths = [];

    this.modificationCount = 0;
    this.modifyingPaths = [];

    this.interactsWith = [];

    if (path.isInType('VariableDeclarationStatement')) {
      this.initialValue = path.getAncestorOfType(
        'VariableDeclarationStatement',
      ).node.initialValue;
    }

    this.isParam = path.isInType('ParameterList');
  }

  update(path: NodePath) {
    this.addReferencingPath(path);
    if (path.isModification()) {
      this.addModifyingPath(path);
    }
  }

  addReferencingPath(path: NodePath) {
    this.isReferenced = true;
    ++this.referenceCount;
    if (!this.referencingPaths.some(p => p.node.id === path.node.id))
      this.referencingPaths.push(path);
  }

  addModifyingPath(path: NodePath) {
    this.isModified = true;
    ++this.modificationCount;
    if (!this.modifyingPaths.some(p => p.node.id === path.node.id)) {
      this.modifyingPaths.push(path);
    }
  }

  addSecretInteractingPath(path: NodePath) {
    this.interactsWithSecret = true;
    path.isSecret = true;
    if (!this.interactsWith.some(p => p.node.id === path.node.id)) {
      this.interactsWith.push(path);
    }
  }

  addPublicInteractingPath(path: NodePath) {
    this.interactsWithPublic = true;
    path.isPublic = true;
    if (!this.interactsWith.some(p => p.node.id === path.node.id)) {
      this.interactsWith.push(path);
    }
  }
}


/**
 * Within a Function's scope, for each state variable that gets mentioned, we
 * create a 'StateVariableIndicator'.
 */
export class StateVariableIndicator extends FunctionDefinitionIndicator {

  parentIndicator: FunctionDefinitionIndicator;
  id: number;
  name: string;
  scope: Scope;
  binding: VariableBinding;
  node: any;

  isSecret: boolean;
  isUnknown?: boolean;
  isKnown?: boolean;

  isMapping?: boolean;
  mappingKeys?: {[key: string]: MappingKey};
  mappingOwnershipType?: string;

  isReferenced?: boolean;
  referenceCount: number;
  referencingPaths: NodePath[];
  isModified?: boolean;
  modificationCount: number;
  modifyingPaths: NodePath[];
  isNullified?: boolean;
  nullificationCount: number;
  nullifyingPaths: NodePath[];
  isAccessed?: boolean;
  accessedPaths?: NodePath[];

  isIncremented?: boolean;
  increments?: any[];
  isDecremented?: boolean;
  decrements?: any[];
  isWhole?: boolean;
  isPartitioned?: boolean;

  isWholeReason?: {}[];
  isPartitionedReason?: {}[];

  isBurned?: boolean;
  burningPaths: NodePath[];
  reinitialisable?: boolean;
  interactsWith: NodePath[];
  isParam: boolean;
  isOwned?: boolean;
  owner?: any;

  initialValue?: any;

  /** @param {NodePath} path the path of the stateVariable for which we're creating an indicator
   */
  constructor(path: NodePath) {
    super(path.scope);
    const referencedBinding = path.getReferencedBinding();
    const referencedId = referencedBinding.id;
    const referencedName = referencedBinding.name;

    if (!(referencedBinding instanceof VariableBinding)) throw new TypeError(`Variable indicator for ${referencedName} cannot find a variable binding`);

    this.id = referencedId;
    this.name = referencedName;
    this.binding = referencedBinding;
    this.scope = path.scope;
    this.node = path.node;
    this.parentIndicator = path.scope.indicators;

    this.isSecret = referencedBinding.isSecret;

    this.referenceCount = 0;
    this.referencingPaths = [];

    this.modificationCount = 0;
    this.modifyingPaths = [];

    this.nullificationCount = 0;
    this.nullifyingPaths = [];

    this.burningPaths = [];

    this.interactsWith = [];

    if (path.isMappingIdentifier()) {
      this.isMapping = true;
      this.mappingKeys = {};
    }
  }

  // TODO / FIXME - THIS FUNCTION IS CURRENTLY JUST A COPY-PASTE FROM THE BINDING CLASS!
  // If this binding represents a mapping stateVar, then throughout the code, this mapping will be accessed with different keys. Only when we reach that key during traversal can we update this binding to say "this mapping sometimes gets accessed via this particular key"
  addMappingKey(referencingPath: NodePath): MappingKey {
    const keyNode = referencingPath.getMappingKeyIdentifier();
    const keyPath = NodePath.getPath(keyNode);
    if (!keyPath) throw new Error('No keyPath found in pathCache');

    if (keyNode.nodeType !== 'Identifier') {
      throw new Error(
        `A mapping key of nodeType '${keyNode.nodeType}' isn't supported yet. We've only written the code for keys of nodeType Identifier'`,
      );
    }

    // naming of the key within mappingKeys:
    const keyName = this.binding.getMappingKeyName(referencingPath);

    // add this mappingKey if it hasn't yet been added:
    const mappingKeyExists = !!this.mappingKeys[keyName];
    if (!mappingKeyExists)
      this.mappingKeys[keyName] = new MappingKey(this, keyPath);

    return this.mappingKeys[keyName];
  }

  // A StateVariableIndicator will be updated if (some time after its creation) we encounter an AST node which refers to this state variable.
  // E.g. if we encounter an Identifier node.
  update(path: NodePath) {
    if (this.isMapping) {
      this.addMappingKey(path).updateProperties(path);
    } else {
      this.updateProperties(path);
    }
  }


  updateProperties(path: NodePath) {
    this.addReferencingPath(path);
    this.isUnknown ??= path.node.isUnknown;
    this.isKnown ??= path.node.isKnown;
    this.reinitialisable ??= path.node.reinitialisable;
    if (path.isModification())
    {
      this.addModifyingPath(path);
  }
}

  addSecretInteractingPath(path: NodePath) {
    this.interactsWithSecret = true;
    path.isSecret = true;
    if (!this.interactsWith.some(p => p.node.id === path.node.id)) {
      this.interactsWith.push(path);
    }
  }

  addPublicInteractingPath(path: NodePath) {
    this.interactsWithPublic = true;
    path.isPublic = true;
    if (!this.interactsWith.some(p => p.node.id === path.node.id)) {
      this.interactsWith.push(path);
    }
  }

  updateFromBinding() {
    // it's possible we dont know in this fn scope whether a state is whole/owned or not, but the binding (contract scope) will
    // add nullifyingPaths we didn't know were nullifying
    if (this.binding.isWhole && this.isModified) {
      this.modifyingPaths.forEach(modPath => {
        // if not included, we add it
        if (!this.nullifyingPaths.some(p => p.node.id === modPath.node.id)) this.addNullifyingPath(modPath);
      })
    }
    this.isWhole ??= this.binding.isWhole;
    this.isWholeReason = this.isWhole
      ? this.binding.isWholeReason
      : this.isWholeReason;
    this.isPartitioned ??= this.binding.isPartitioned;
    this.isPartitionedReason = this.isPartitioned
      ? this.binding.isPartitionedReason
      : this.isPartitionedReason;
    this.isOwned ??= this.binding.isOwned;
    this.owner ??= this.binding.owner;
    this.onChainKeyRegistry ??= this.binding.onChainKeyRegistry;
    this.parentIndicator.onChainKeyRegistry ??= this.binding.onChainKeyRegistry;
    if (this.isMapping) {
      this.mappingOwnershipType = this.owner?.mappingOwnershipType;
      const mappingKeys: [string, MappingKey][] = Object.entries(this.mappingKeys);
      for (const [, mappingKey] of mappingKeys) {
        mappingKey.updateFromBinding();
      }
    }
  }

  updateAccessed(path: NodePath) {
    this.isWhole = true;
    this.isAccessed = true;
    this.oldCommitmentAccessRequired = true;
    this.parentIndicator.oldCommitmentAccessRequired = true;
    this.parentIndicator.initialisationRequired = true;
    this.parentIndicator.parentIndicator.oldCommitmentAccessRequired = true;
    if (!this.isModified) {
      this.parentIndicator.containsAccessedOnlyState = true;
      this.parentIndicator.parentIndicator.containsAccessedOnlyState = true;
    }
    const reason = { src: path.node.src, 0: `Accessed` };
    this.isWholeReason ??= [];
    this.isWholeReason.push(reason);
    this.accessedPaths ??= [];
    this.accessedPaths.push(path);
    if (this.isMapping) {
      this.addMappingKey(path).accessedPaths ??= [];
      this.addMappingKey(path).accessedPaths.push(path);
    }
  }

  updateIncrementation(path: NodePath, state: any) {
    if (this.isSecret) this.parentIndicator.updateIncrementation(path, state);
    // if an incrementation is marked as unknown anywhere, the binding will know
    if (
      !path.isIncremented ||
      state.incrementedIdentifier.isKnown
    ) {
      this.isWhole = true;
      const reason = { src: state.incrementedIdentifier.src, 0: `Overwritten` };
      this.isWholeReason ??= [];
      this.isWholeReason.push(reason);
      // a reinitialised state does not require a nullifier
      if (
        state.incrementedPath &&
        !state.incrementedIdentifier.reinitialisable
      ) {
        this.addNullifyingPath(state.incrementedPath);
      }
      // an incremented, but not decremented, state only needs a new commitment
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
    // if its known, we already added the path
    if (path.isDecremented && !state.incrementedIdentifier.isKnown) {
      this.addNullifyingPath(state.incrementedPath);
    }
    // if its incremented anywhere, isIncremented = true
    // so we only assign if it's already falsey
    this.isIncremented ||= path.isIncremented;
    this.isDecremented ||= path.isDecremented;
    this.increments ??= [];
    this.decrements ??= [];
    state.increments.forEach((inc: any) => {
      this.increments.push(inc);
    });
    state.decrements.forEach((dec: any) => {
      this.decrements.push(dec);
    });
    if (this.isMapping) {
      this.addMappingKey(state.incrementedPath).updateIncrementation(
        path,
        state,
      );
    }
  }

  addReferencingPath(path: NodePath) {
    this.isReferenced = true;
    ++this.referenceCount;
    if (!this.referencingPaths.some(p => p.node.id === path.node.id))
      this.referencingPaths.push(path);
  }

  addModifyingPath(path: NodePath) {
    this.isModified = true;
    ++this.modificationCount;
    if (!this.modifyingPaths.some(p => p.node.id === path.node.id)) {
      this.modifyingPaths.push(path);

      // TODO check usage of below when reinitialisable
      this.initialisationRequired = true; // Used? Probably for whole states?

      const { node } = path;
      if (node.isKnown) this.isKnown = true;
      if (node.isUnknown) this.isUnknown = true;
    }
  }

  addNullifyingPath(path: NodePath) {
    this.isNullified = true;
    this.parentIndicator.nullifiersRequired = true;
    this.oldCommitmentAccessRequired = true;
    ++this.nullificationCount;
    this.nullifyingPaths.push(path);
    this.binding.addNullifyingPath(path);
    if (this.isMapping) this.addMappingKey(path).addNullifyingPath(path);
  }

  addBurningPath(path: NodePath) {
    this.isBurned = true;
    this.burningPaths.push(path);
    if (this.isMapping) this.addMappingKey(path).addBurningPath(path);
  }

  prelimTraversalErrorChecks() {
    if (!this.isSecret) return;
    if (this.isMapping) {
      const mappingKeys: [string, MappingKey][] = Object.entries(this.mappingKeys);
      for (const [, mappingKey] of mappingKeys) {
        mappingKey.prelimTraversalErrorChecks();
      }
    }
    // warning: state is clearly whole, don't need known decorator
    // added not accessed because this flags incrementations marked as known, they need to be marked as known
    if (this.isKnown && this.isWhole && !this.isIncremented) {
      logger.warn(
        `PEDANTIC: Unnecessary 'known' decorator. Secret state '${this.name}' is trivially 'known' because it is 'whole', due to:`,
      );
      this.isWholeReason.forEach(reason => {
        console.log(reason[0]);
      });
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

  updateNewCommitmentsRequired() {
    // if we have burn statements, there are some scopes where we don't need new commitments at all
    if (!this.isBurned && this.isSecret && this.isModified) {
      this.parentIndicator.newCommitmentsRequired = true;
      this.newCommitmentsRequired = true;
      if (this.isMapping) {
        const mappingKeys: [string, MappingKey][] = Object.entries(this.mappingKeys);
        for (const [, mappingKey] of mappingKeys) {
          mappingKey.newCommitmentsRequired = true;
        }
      }
      return;
    }
    if (!this.isSecret || !this.isBurned) return;
    let burnedOnly = true;
    this.modifyingPaths.forEach(path => {
      // if we have a modifyingPath which is NOT a burningPath, then we do need new commitments
      if (!this.burningPaths.some(p => p.node.id === path.node.id)) {
        logger.warn(
          `The state ${this.name} is being burned (ownership is being revoked and the state ready for reset) and edited in the same scope (${this.scope.scopeName}). \nThat edit may be useless and the output commmitment scheme may not work. Make sure you know what you're doing here.`,
        );
        backtrace.getSourceCode(path.node.src);
        backtrace.getSourceCode(this.burningPaths[0].node.src);
        this.parentIndicator.newCommitmentsRequired = true;
        if (this.isMapping)
          this.addMappingKey(path).newCommitmentsRequired = true;
        burnedOnly = false;
      }
    });
    this.newCommitmentsRequired = !burnedOnly;
  }
}
