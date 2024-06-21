import NodePath from './NodePath.js';
import { Binding } from './Binding.js';
import { StateVariableIndicator } from './Indicator.js';
import logger from '../utils/logger.js';
import { SyntaxUsageError, ZKPError } from '../error/errors.js';
import backtrace from '../error/backtrace.js';
import { structWarnings } from '../transformers/visitors/ownership/errorChecksVisitor.js';

/**
 * If a Binding/StateVarIndicator represents a mapping, it will contain a MappingKey class.
 */
export default class MappingKey {

  id: number;
  name: string;
  node: any;
  path: NodePath;
  isSecret: boolean;
  isSharedSecret: boolean;

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
  burningPaths: NodePath[] = [];

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
  isStruct: boolean;

  isParent?: boolean;
  isChild?: boolean;
  structProperties?: {[key: string]: any};

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
  encryptionRequired?: boolean;

  returnKeyName(keyNode: any) {
    if (this.keyPath.isMsgSender(keyNode)) return 'msgSender';
    if (this.keyPath.isMsgValue(keyNode)) return 'msgValue';
    if (this.keyPath.isMsg(keyNode)) return 'msg';
    switch (keyNode.nodeType) {
      case 'VariableDeclaration':
      case 'Identifier':
        return keyNode.name;
      case 'MemberAccess':
        return `${this.returnKeyName(keyNode.expression)}.${keyNode.memberName}`;
      case 'IndexAccess':
        return `${this.returnKeyName(keyNode.baseExpression)}[${this.keyPath.scope.getMappingKeyName(keyNode)}]`;
      case 'Literal':
        return keyNode.value;
      default:
        return ``;
    }
  }

  constructor(container: any, keyPath: NodePath, isStructProperty = false) {
    this.container = container;
    this.id = container.id;
    this.node = container.node;

    this.keyPath = keyPath;

    this.referencedKeyId = keyPath.node.referencedDeclaration;
    this.referencedKeyName = isStructProperty ? keyPath.node.memberName : this.returnKeyName(keyPath.node);

    this.referencedKeyNodeType = keyPath.isMsg()
      ? 'msg.sender'
      : keyPath.getReferencedNode()?.nodeType;
    this.referencedKeyIsParam = keyPath.isFunctionParameter(); // is a function parameter - used for finding owner
    this.isMsgSender = keyPath.isMsg(); // used for finding owner
    this.isSecret = container.isSecret;
    this.isSharedSecret = container.isSharedSecret;

    this.isMapping = container.isMapping;
    this.isStruct = container.isStruct; // keyPath.isStruct();

    if (this.isStruct && this.container.isParent) {
      // must be a mapping of a struct
      // we do not currently allow struct of mapping types
      this.name = `${container.name}.${keyPath.node.memberName}`;

    } else if (this.isMapping) {
      this.name = this.isMsgSender
        ? `${container.name}[msg.sender]`
        : `${container.name}[${this.referencedKeyName}]`;
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

  addStructProperty(referencingPath: NodePath): MappingKey {
    this.isParent = true;
    this.isStruct = true;
    this.structProperties ??= {};
    const memberAccPath = referencingPath.findAncestor(p => p.node.nodeType === 'MemberAccess' && !p.isMsgSender());
    if (!(this.structProperties[memberAccPath?.node.memberName] instanceof MappingKey) && memberAccPath)
      this.structProperties[memberAccPath?.node.memberName] = new MappingKey(this, memberAccPath, true);
    this.structProperties[memberAccPath?.node.memberName].isChild = true;
    return this.structProperties[memberAccPath?.node.memberName];
  }

  updateProperties(path: NodePath) {
    if (this.isMapping && this.node.typeDescriptions.typeString.includes('struct ') && !this.isChild && path.getAncestorOfType('MemberAccess')) {

      // in mapping[key].property, the node for .property is actually a parent value, so we need to make sure this isnt already a child of a mappingKey
      this.addStructProperty(path).updateProperties(path);
    }
    this.addReferencingPath(path);
    this.isUnknown ??= path.node.isUnknown;
    this.isKnown ??= path.node.isKnown;
    this.reinitialisable ??= path.node.reinitialisable;
    if (path.isModification()) this.addModifyingPath(path);

    if (!(this.container instanceof MappingKey)) this.container.updateProperties(path);
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

  updateEncryption(options?: any) {
    // no new commitments => nothing to encrypt
    if (!this.newCommitmentsRequired) return;
    // decremented only => no new commitments to encrypt
    if (this.isPartitioned && this.isDecremented && this.nullificationCount === this.referenceCount) return;
    // find whether enc for this scope only has been opted in
    let encThisState: boolean = false;
    this.modifyingPaths.forEach(p => {
      if (p.getAncestorOfType('ExpressionStatement')?.node.forceEncrypt) encThisState = true;
    })
    // whole state only if opted in
    if ((!options?.encAllStates && !encThisState)  && (!this.isPartitioned || !this.isOwned)) return;
    switch (this.mappingOwnershipType) {
      case 'key':
        // owner here is the keypath
        if (this.name.includes('[msg.sender]')) return;
        this.encryptionRequired = true;
        break;
      case 'value':
      default:
        if ((this.owner?.node?.name || this.owner?.name)?.includes('msg')) return;
        this.encryptionRequired = true;
        break;
    }
    if (this.encryptionRequired) {
      this.container.encryptionRequired = true;
      if (!this.isChild) {
        this.container.parentIndicator.encryptionRequired = true;
        this.container.parentIndicator.parentIndicator.encryptionRequired = true;
      } else {
        this.container.container.parentIndicator.encryptionRequired = true;
        this.container.container.parentIndicator.encryptionRequired = true;
      }

    }
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
      if (this.isWholeReason && this.isPartitionedReason)
      throw new SyntaxUsageError(
        `State cannot be whole and partitioned. The following reasons conflict.`,
        this.node,
        [...this.isWholeReason, ...this.isPartitionedReason],
      );
      else throw new SyntaxUsageError(
        `State  ${this.name} cannot be whole and partitioned`,
        this.node,
        []
      )
    }

    if (this.isStruct && this.structProperties) {
     const structProperties = Object.entries(this.structProperties);
     const ogStructProperties = this.referencingPaths[0].getStructDeclaration(this.node).members.map(n => n.name);
     for (const name of ogStructProperties) {
       // we may have empty struct properties if they are never edited
       if (this.structProperties[name] instanceof MappingKey) {
        this.structProperties[name].prelimTraversalErrorChecks();
       } else {
        structWarnings.push(name.concat(' in ').concat(this.keyPath.scope.scopeName));
      }
     }
   }
  }

  isNullifiable() {
    // in some cases, it's fine for certain mapping keys to not be nullifiable, as a parameter key means that any key is nullifiable
    // so, we don't throw an error here
    return !!this.isNullified;
  }

  updateFromBinding() {
    // it's possible we dont know in this fn scope whether a state is whole/owned or not, but the binding (contract scope) will
    const container = this.container instanceof Binding ? this.container : this.container.binding;
    this.isWhole ??= container.isWhole;
    this.isWholeReason = this.isWhole
      ? container.isWholeReason
      : this.isWholeReason;
    this.isPartitioned ??= container.isPartitioned;
    this.isPartitionedReason = this.isPartitioned
      ? container.isPartitionedReason
      : this.isPartitionedReason;
    this.isOwned ??= container.isOwned;
    this.owner ??= container.owner;
    this.mappingOwnershipType = this.owner?.mappingOwnershipType;
    this.onChainKeyRegistry ??= container.onChainKeyRegistry;
  }
}
