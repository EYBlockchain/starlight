import NodePath from './NodePath.js';
import logger from '../utils/logger.js';
import { SyntaxUsageError, ZKPError } from '../error/errors.js';

/**
 * If a Binding/StateVarIndicator represents a mapping, it will contain a MappingKey class.
 */
export default class MappingKey {

  id: number;
  name: string;
  node: any;
  path: NodePath;
  isSecret: boolean;

  isReferenced?: boolean;
  referenceCount: number = 0;
  referencingPaths: NodePath[] = [];

  isModified: boolean;
  modificationCount: number = 0;
  modifyingPaths: NodePath[] = []; // array of paths of `Identifier` nodes which modify this variable

  isAccessed?: boolean;
  accessedPaths: NodePath[] = [];
  // NOTE: modification _is_ nullification, unless it's a partitioned state being incremented (in which case there's no nullifier). So nullifyingPaths is a subset of modifyingPaths.

  isNullified?: boolean;
  nullificationCount: number = 0;
  nullifyingPaths: NodePath[] = []; // array of paths of `Identifier` nodes which nullify this binding
  isBurned?: boolean;
  burningPaths: NodePath[];

  container: any;
  referencedKeyId: number;
  referencedKeyName: string;
  referencedKeyNodeType: string;
  referencedKeyIsParam: boolean; // is a function parameter - used for finding owner
  keyPath: NodePath;
  isMsgSender: boolean; // used for finding owner

  interactsWith: any[] = [];
  interactsWithPublic: boolean;
  interactsWithSecret: boolean;
  newCommitmentsRequired: boolean;

  isMapping: boolean;
  mappingKeys?: any;
  isStruct: boolean;

  isKnown?:boolean;
  isUnknown?:boolean;
  isIncremented?:boolean;
  increments: any[] = [];
  decrements: any[] = [];
  isDecremented?: boolean;
  isWhole?: boolean;

  isPartitioned?: boolean;
  isWholeReason?: {}[];
  isPartitionedReason?: {}[];

  reinitialisable?: boolean;
  initialisationRequired?: boolean;
  isOwned?: boolean;
  mappingOwnershipType?: string;
  onChainKeyRegistry?: boolean;
  owner: any = null; // object of objects, indexed by node id.

  constructor(container: any, keyPath: NodePath) {
    this.container = container;
    this.id = container.id;
    this.node = container.node;

    // TODO: distinguish between if the key is a reference and if the key is not a reference - the prefix 'referenced' is misleading below:
    this.referencedKeyId = keyPath.node.referencedDeclaration;
    this.referencedKeyName = keyPath.isMsg()
      ? 'msg'
      : keyPath.isStruct ? keyPath.node.memberName : keyPath.getReferencedNode().name;
    this.referencedKeyNodeType = keyPath.isMsg()
      ? 'msg.sender'
      : keyPath.getReferencedNode().nodeType;
    this.referencedKeyIsParam = keyPath.isFunctionParameter(); // is a function parameter - used for finding owner
    this.keyPath = keyPath;
    this.isMsgSender = keyPath.isMsg(); // used for finding owner
    this.isSecret = container.isSecret;

    this.isMapping = container.isMapping;
    this.isStruct = keyPath.isStruct();

    if (this.isMapping) {
      this.name = this.isMsgSender
        ? `${container.name}[msg.sender]`
        : `${container.name}[${keyPath.node.name}]`;
    } else if (this.isStruct) {
      this.name = `${container.name}.${keyPath.node.memberName}`;
    }

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

  updateProperties(path: NodePath) {
    this.addReferencingPath(path);
    this.isUnknown ??= path.node.isUnknown;
    this.isKnown ??= path.node.isKnown;
    this.reinitialisable ??= path.node.reinitialisable;
    if (path.isModification()) this.addModifyingPath(path);

    this.container.updateProperties(path);
  }

  updateOwnership(ownerNode: any) {
    if (this.isOwned && this.owner.name !== ownerNode.name) {
      throw new ZKPError(
        `We found two distinct owners (${this.owner.name} and ${ownerNode.name}) of a secret state, which we can't allow because only one public key needs to be able to open/nullify the secret.`,
        this.node,
      );
    }
    this.owner = ownerNode;
    this.isOwned = true;
  }

  updateIncrementation(path: NodePath, state: any) {
    if (!path.isIncremented || state.incrementedIdentifier.isKnown) {
      this.isWhole = true;
      const reason = { src: state.incrementedIdentifier.src, 0: `Overwritten` };
      this.isWholeReason ??= [];
      this.isWholeReason.push(reason);
      if (state.incrementedPath && !state.incrementedIdentifier.reinitialisable)
        this.addNullifyingPath(state.incrementedPath);
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
    if (path.isDecremented && !state.incrementedIdentifier.isKnown)
      this.addNullifyingPath(state.incrementedPath);
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
  }

  // TODO: move into commonFunctions (because it's the same function as included in the Binding class)
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

  addNullifyingPath(path: NodePath) {
    this.isNullified = true;
    ++this.nullificationCount;
    this.nullifyingPaths.push(path);
  }

  addBurningPath(path: NodePath) {
    this.isBurned = true;
    this.burningPaths.push(path);
  }

  addSecretInteractingPath(path: NodePath) {
    this.interactsWithSecret = true;
    path.isSecret = true;
    if (!this.interactsWith.some(p => p.node.id === path.node.id)) {
      this.interactsWith.push(path);
      this.container.addSecretInteractingPath(path);
    }
  }

  addPublicInteractingPath(path: NodePath) {
    this.interactsWithPublic = true;
    path.isPublic = true;
    if (!this.interactsWith.some(p => p.node.id === path.node.id)) {
      this.interactsWith.push(path);
      this.container.addPublicInteractingPath(path);
    }
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

  updateFromBinding() {
    // it's possible we dont know in this fn scope whether a state is whole/owned or not, but the binding (contract scope) will
    this.isWhole ??= this.container.binding.isWhole;
    this.isWholeReason = this.isWhole
      ? this.container.binding.isWholeReason
      : this.isWholeReason;
    this.isPartitioned ??= this.container.binding.isPartitioned;
    this.isPartitionedReason = this.isPartitioned
      ? this.container.binding.isPartitionedReason
      : this.isPartitionedReason;
    this.isOwned ??= this.container.binding.isOwned;
    this.owner ??= this.container.binding.owner;
    this.mappingOwnershipType = this.owner?.mappingOwnershipType;
    this.onChainKeyRegistry ??= this.container.binding.onChainKeyRegistry;
  }
}
