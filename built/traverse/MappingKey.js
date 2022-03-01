import logger from '../utils/logger.js';
import { SyntaxUsageError, ZKPError } from '../error/errors.js';
/**
 * If a Binding/StateVarIndicator represents a mapping, it will contain a MappingKey class.
 */
export default class MappingKey {
    constructor(container, keyPath) {
        this.referenceCount = 0;
        this.referencingPaths = [];
        this.modificationCount = 0;
        this.modifyingPaths = []; // array of paths of `Identifier` nodes which modify this variable
        this.accessedPaths = [];
        this.nullificationCount = 0;
        this.nullifyingPaths = []; // array of paths of `Identifier` nodes which nullify this binding
        this.interactsWith = [];
        this.isMapping = true;
        this.mappingKeys = {}; // object of objects, indexed by node id.
        this.increments = [];
        this.decrements = [];
        this.owner = null; // object of objects, indexed by node id.
        this.container = container;
        this.id = container.id;
        this.node = container.node;
        // TODO: distinguish between if the key is a reference and if the key is not a reference - the prefix 'referenced' is misleading below:
        this.referencedKeyId = keyPath.node.referencedDeclaration;
        this.referencedKeyName = keyPath.isMsg()
            ? 'msg'
            : keyPath.getReferencedNode().name;
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
        var _a, _b, _c;
        this.addReferencingPath(path);
        (_a = this.isUnknown) !== null && _a !== void 0 ? _a : (this.isUnknown = path.node.isUnknown);
        (_b = this.isKnown) !== null && _b !== void 0 ? _b : (this.isKnown = path.node.isKnown);
        (_c = this.reinitialisable) !== null && _c !== void 0 ? _c : (this.reinitialisable = path.node.reinitialisable);
        if (path.isModification())
            this.addModifyingPath(path);
        this.container.updateProperties(path);
    }
    updateOwnership(ownerNode) {
        if (this.isOwned && this.owner.name !== ownerNode.name) {
            throw new ZKPError(`We found two distinct owners (${this.owner.name} and ${ownerNode.name}) of a secret state, which we can't allow because only one public key needs to be able to open/nullify the secret.`, this.node);
        }
        this.owner = ownerNode;
        this.isOwned = true;
    }
    updateIncrementation(path, state) {
        var _a, _b, _c, _d, _e, _f;
        if (!path.isIncremented || state.incrementedIdentifier.isKnown) {
            this.isWhole = true;
            const reason = { src: state.incrementedIdentifier.src, 0: `Overwritten` };
            (_a = this.isWholeReason) !== null && _a !== void 0 ? _a : (this.isWholeReason = []);
            this.isWholeReason.push(reason);
            if (state.incrementedPath && !state.incrementedIdentifier.reinitialisable)
                this.addNullifyingPath(state.incrementedPath);
        }
        else if (!path.isDecremented &&
            (state.incrementedIdentifier.isUnknown ||
                ((_b = state.incrementedIdentifier.baseExpression) === null || _b === void 0 ? void 0 : _b.isUnknown))) {
            this.isPartitioned = true;
            const reason = {
                src: state.incrementedIdentifier.src,
                0: `Incremented and marked as unknown`,
            };
            (_c = this.isUnknown) !== null && _c !== void 0 ? _c : (this.isUnknown = true);
            (_d = this.isPartitionedReason) !== null && _d !== void 0 ? _d : (this.isPartitionedReason = []);
            this.isPartitionedReason.push(reason);
        }
        if (path.isDecremented && !state.incrementedIdentifier.isKnown)
            this.addNullifyingPath(state.incrementedPath);
        // if its incremented anywhere, isIncremented = true
        // so we only assign if it's already falsey
        this.isIncremented || (this.isIncremented = path.isIncremented);
        this.isDecremented || (this.isDecremented = path.isDecremented);
        (_e = this.increments) !== null && _e !== void 0 ? _e : (this.increments = []);
        (_f = this.decrements) !== null && _f !== void 0 ? _f : (this.decrements = []);
        state.increments.forEach((inc) => {
            this.increments.push(inc);
        });
        state.decrements.forEach((dec) => {
            this.decrements.push(dec);
        });
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
    addBurningPath(path) {
        this.isBurned = true;
        this.burningPaths.push(path);
    }
    addSecretInteractingPath(path) {
        this.interactsWithSecret = true;
        path.isSecret = true;
        if (!this.interactsWith.some(p => p.node.id === path.node.id)) {
            this.interactsWith.push(path);
            this.container.addSecretInteractingPath(path);
        }
    }
    addPublicInteractingPath(path) {
        this.interactsWithPublic = true;
        path.isPublic = true;
        if (!this.interactsWith.some(p => p.node.id === path.node.id)) {
            this.interactsWith.push(path);
            this.container.addPublicInteractingPath(path);
        }
    }
    prelimTraversalErrorChecks() {
        var _a;
        // warning: state is clearly whole, don't need known decorator
        if (this.isKnown && this.isWhole) {
            logger.warn(`PEDANTIC: Unnecessary 'known' decorator. Secret state '${this.name}' is trivially 'known' because it is 'whole', due to: ${this.isWholeReason}`);
            (_a = this.isWholeReason) === null || _a === void 0 ? void 0 : _a.forEach(reason => {
                console.log(reason[0]);
            });
        }
        // error: conflicting unknown/whole state
        if (this.isUnknown && this.isWhole) {
            console.log('err 2');
            throw new SyntaxUsageError(`Can't mark a whole state as 'unknown'`, this.node, this.isWholeReason);
        }
        // error: conflicting whole/partitioned state
        if (this.isWhole && this.isPartitioned) {
            throw new SyntaxUsageError(`State cannot be whole and partitioned. The following reasons conflict.`, this.node, [...this.isWholeReason, ...this.isPartitionedReason]);
        }
    }
    isNullifiable() {
        // in some cases, it's fine for certain mapping keys to not be nullifiable, as a parameter key means that any key is nullifiable
        // so, we don't throw an error here
        return !!this.isNullified;
    }
    updateFromBinding() {
        var _a, _b, _c, _d, _e, _f;
        // it's possible we dont know in this fn scope whether a state is whole/owned or not, but the binding (contract scope) will
        (_a = this.isWhole) !== null && _a !== void 0 ? _a : (this.isWhole = this.container.binding.isWhole);
        this.isWholeReason = this.isWhole
            ? this.container.binding.isWholeReason
            : this.isWholeReason;
        (_b = this.isPartitioned) !== null && _b !== void 0 ? _b : (this.isPartitioned = this.container.binding.isPartitioned);
        this.isPartitionedReason = this.isPartitioned
            ? this.container.binding.isPartitionedReason
            : this.isPartitionedReason;
        (_c = this.isOwned) !== null && _c !== void 0 ? _c : (this.isOwned = this.container.binding.isOwned);
        (_d = this.owner) !== null && _d !== void 0 ? _d : (this.owner = this.container.binding.owner);
        this.mappingOwnershipType = (_e = this.owner) === null || _e === void 0 ? void 0 : _e.mappingOwnershipType;
        (_f = this.onChainKeyRegistry) !== null && _f !== void 0 ? _f : (this.onChainKeyRegistry = this.container.binding.onChainKeyRegistry);
    }
}
