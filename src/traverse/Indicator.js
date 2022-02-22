"use strict";
/* eslint-disable max-classes-per-file, no-param-reassign */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.MappingKey = exports.StateVariableIndicator = exports.LocalVariableIndicator = exports.FunctionDefinitionIndicator = exports.ContractDefinitionIndicator = void 0;
var NodePath_js_1 = require("./NodePath.js");
var Binding_js_1 = require("./Binding.js");
var logger_js_1 = require("../utils/logger.js");
var backtrace_js_1 = require("../error/backtrace.js");
var errors_js_1 = require("../error/errors.js");
var ContractDefinitionIndicator = /** @class */ (function () {
    function ContractDefinitionIndicator() {
        this.initialisationRequired = false;
        this.containsAccessedOnlyState = false;
        this.zkSnarkVerificationRequired = false;
        this.oldCommitmentAccessRequired = false;
        this.nullifiersRequired = false;
        this.newCommitmentsRequired = false;
    }
    // A ContractDefinitionIndicator will be updated if (some time after its creation) we encounter an AST node which gives us more information about the contract's global states
    // E.g. if we encounter a VariableDeclaration node for a secret state.
    ContractDefinitionIndicator.prototype.update = function (path) {
        if (path.node.isSecret) {
            // These Indicator properties are used to construct import statements & boilerplate for the shield contract AST:
            this.newCommitmentsRequired = true;
            this.zkSnarkVerificationRequired = true;
        }
    };
    ContractDefinitionIndicator.prototype.updateIncrementation = function (path, state) {
        var _a;
        if (!path.isIncremented || state.incrementedIdentifier.isKnown) {
            // a reinitialised state does require new commitments
            this.newCommitmentsRequired = true;
            this.initialisationRequired = true;
            // a reinitialised state does not require a nullifier
            if (state.incrementedPath &&
                !state.incrementedIdentifier.reinitialisable) {
                this.nullifiersRequired = true;
                this.oldCommitmentAccessRequired = true;
            }
            // an incremented, but not decremented, state only needs a new commitment
        }
        else if (!path.isDecremented &&
            (state.incrementedIdentifier.isUnknown ||
                ((_a = state.incrementedIdentifier.baseExpression) === null || _a === void 0 ? void 0 : _a.isUnknown))) {
            this.newCommitmentsRequired = true;
            // we may have an incrementation not marked as unknown in this scope:
        }
        else if (!path.isDecremented) {
            this.newCommitmentsRequired = true;
        }
        if (path.isDecremented && !state.incrementedIdentifier.isKnown) {
            this.nullifiersRequired = true;
            this.newCommitmentsRequired = true;
            this.oldCommitmentAccessRequired = true;
        }
    };
    return ContractDefinitionIndicator;
}());
exports.ContractDefinitionIndicator = ContractDefinitionIndicator;
var FunctionDefinitionIndicator = /** @class */ (function (_super) {
    __extends(FunctionDefinitionIndicator, _super);
    function FunctionDefinitionIndicator(scope) {
        var _this = _super.call(this) || this;
        _this.interactsWithSecret = false;
        _this.interactsWithPublic = false;
        _this.onChainKeyRegistry = false;
        _this.initialisationRequired = false;
        _this.parentIndicator = scope.parentScope.indicators;
        return _this;
    }
    FunctionDefinitionIndicator.prototype.update = function (path) {
        if (path.node.isSecret) {
            // These Indicator properties are used to construct import statements & boilerplate for the shield contract AST:
            this.interactsWithSecret = true;
            this.zkSnarkVerificationRequired = true;
        }
    };
    FunctionDefinitionIndicator.prototype.updateIncrementation = function (path, state) {
        var _a;
        this.parentIndicator.updateIncrementation(path, state);
        if (!path.isIncremented || state.incrementedIdentifier.isKnown) {
            // a reinitialised state does require new commitments
            this.newCommitmentsRequired = true;
            this.initialisationRequired = true;
            // a reinitialised state does not require a nullifier
            if (state.incrementedPath &&
                !state.incrementedIdentifier.reinitialisable) {
                this.nullifiersRequired = true;
                this.oldCommitmentAccessRequired = true;
            }
            // an incremented, but not decremented, state only needs a new commitment
        }
        else if (!path.isDecremented &&
            (state.incrementedIdentifier.isUnknown ||
                ((_a = state.incrementedIdentifier.baseExpression) === null || _a === void 0 ? void 0 : _a.isUnknown))) {
            this.newCommitmentsRequired = true;
            // we may have an incrementation not marked as unknown in this scope:
        }
        else if (!path.isDecremented) {
            this.newCommitmentsRequired = true;
        }
        if (path.isDecremented && !state.incrementedIdentifier.isKnown) {
            this.nullifiersRequired = true;
            this.newCommitmentsRequired = true;
            this.oldCommitmentAccessRequired = true;
        }
    };
    FunctionDefinitionIndicator.prototype.updateNewCommitmentsRequired = function () {
        // if we have burn statements, there are some scopes where we don't need new commitments at all
        var burnedOnly = true;
        for (var _i = 0, _a = Object.entries(this); _i < _a.length; _i++) {
            var _b = _a[_i], stateVarIndicator = _b[1];
            if (!(stateVarIndicator instanceof StateVariableIndicator))
                continue; // eslint-disable-line no-continue, no-use-before-define
            // if we have a indicator which is NOT burned, then we do need new commitments
            if (stateVarIndicator.isSecret &&
                (!stateVarIndicator.isBurned || stateVarIndicator.newCommitmentsRequired)) {
                burnedOnly = false;
                break;
            }
        }
        this.newCommitmentsRequired = !burnedOnly;
    };
    return FunctionDefinitionIndicator;
}(ContractDefinitionIndicator));
exports.FunctionDefinitionIndicator = FunctionDefinitionIndicator;
/**
 * Within a Function's scope, for each local variable that gets declared, we
 * create a 'LocalVariableIndicator'.
 */
var LocalVariableIndicator = /** @class */ (function (_super) {
    __extends(LocalVariableIndicator, _super);
    /** @param {NodePath} path the path of the localVariable for which we're creating an indicator
     */
    function LocalVariableIndicator(path) {
        var _this = _super.call(this, path.scope) || this;
        _this.isReferenced = false;
        _this.isModified = false;
        _this.id = path.node.id;
        _this.name = path.node.name;
        _this.scope = path.scope;
        _this.node = path.node;
        _this.parentIndicator = path.scope.indicators;
        _this.referenceCount = 0;
        _this.referencingPaths = [];
        _this.modificationCount = 0;
        _this.modifyingPaths = [];
        _this.interactsWith = [];
        if (path.isInType('VariableDeclarationStatement')) {
            _this.initialValue = path.getAncestorOfType('VariableDeclarationStatement').node.initialValue;
        }
        _this.isParam = path.isInType('ParameterList');
        return _this;
    }
    LocalVariableIndicator.prototype.update = function (path) {
        this.addReferencingPath(path);
        if (path.isModification()) {
            this.addModifyingPath(path);
        }
    };
    LocalVariableIndicator.prototype.addReferencingPath = function (path) {
        this.isReferenced = true;
        ++this.referenceCount;
        if (!this.referencingPaths.some(function (p) { return p.node.id === path.node.id; }))
            this.referencingPaths.push(path);
    };
    LocalVariableIndicator.prototype.addModifyingPath = function (path) {
        this.isModified = true;
        ++this.modificationCount;
        if (!this.modifyingPaths.some(function (p) { return p.node.id === path.node.id; })) {
            this.modifyingPaths.push(path);
        }
    };
    LocalVariableIndicator.prototype.addSecretInteractingPath = function (path) {
        this.interactsWithSecret = true;
        path.isSecret = true;
        if (!this.interactsWith.some(function (p) { return p.node.id === path.node.id; })) {
            this.interactsWith.push(path);
        }
    };
    LocalVariableIndicator.prototype.addPublicInteractingPath = function (path) {
        this.interactsWithPublic = true;
        path.isPublic = true;
        if (!this.interactsWith.some(function (p) { return p.node.id === path.node.id; })) {
            this.interactsWith.push(path);
        }
    };
    return LocalVariableIndicator;
}(FunctionDefinitionIndicator));
exports.LocalVariableIndicator = LocalVariableIndicator;
/**
 * Within a Function's scope, for each state variable that gets mentioned, we
 * create a 'StateVariableIndicator'.
 */
var StateVariableIndicator = /** @class */ (function (_super) {
    __extends(StateVariableIndicator, _super);
    /** @param {NodePath} path the path of the stateVariable for which we're creating an indicator
     */
    function StateVariableIndicator(path) {
        var _this = _super.call(this, path.scope) || this;
        _this.isUnknown = false;
        _this.isKnown = false;
        _this.isReferenced = false;
        _this.isModified = false;
        _this.isNullified = false;
        _this.isAccessed = false;
        _this.isIncremented = false;
        _this.isDecremented = false;
        _this.isWhole = false;
        _this.isPartitioned = false;
        _this.isBurned = false;
        _this.reinitialisable = false;
        _this.isOwned = false;
        var referencedBinding = path.getReferencedBinding();
        var referencedId = referencedBinding.id;
        var referencedName = referencedBinding.name;
        if (!(referencedBinding instanceof Binding_js_1.VariableBinding))
            throw new TypeError("Variable indicator for ".concat(referencedName, " cannot find a variable binding"));
        _this.id = referencedId;
        _this.name = referencedName;
        _this.binding = referencedBinding;
        _this.scope = path.scope;
        _this.node = path.node;
        _this.parentIndicator = path.scope.indicators;
        _this.isSecret = referencedBinding.isSecret;
        _this.referenceCount = 0;
        _this.referencingPaths = [];
        _this.modificationCount = 0;
        _this.modifyingPaths = [];
        _this.nullificationCount = 0;
        _this.nullifyingPaths = [];
        _this.burningPaths = [];
        _this.interactsWith = [];
        if (path.isMappingIdentifier()) {
            _this.isMapping = true;
            _this.mappingKeys = {};
        }
        return _this;
    }
    // TODO / FIXME - THIS FUNCTION IS CURRENTLY JUST A COPY-PASTE FROM THE BINDING CLASS!
    // If this binding represents a mapping stateVar, then throughout the code, this mapping will be accessed with different keys. Only when we reach that key during traversal can we update this binding to say "this mapping sometimes gets accessed via this particular key"
    StateVariableIndicator.prototype.addMappingKey = function (referencingPath) {
        var keyNode = referencingPath.getMappingKeyIdentifier();
        var keyPath = NodePath_js_1["default"].getPath(keyNode);
        if (!keyPath)
            throw new Error('No keyPath found in pathCache');
        if (keyNode.nodeType !== 'Identifier') {
            throw new Error("A mapping key of nodeType '".concat(keyNode.nodeType, "' isn't supported yet. We've only written the code for keys of nodeType Identifier'"));
        }
        // naming of the key within mappingKeys:
        var keyName = this.binding.getMappingKeyName(referencingPath);
        // add this mappingKey if it hasn't yet been added:
        var mappingKeyExists = !!this.mappingKeys[keyName];
        if (!mappingKeyExists)
            this.mappingKeys[keyName] = new MappingKey(this, keyPath);
        return this.mappingKeys[keyName];
    };
    // A StateVariableIndicator will be updated if (some time after its creation) we encounter an AST node which refers to this state variable.
    // E.g. if we encounter an Identifier node.
    StateVariableIndicator.prototype.update = function (path) {
        if (this.isMapping) {
            this.addMappingKey(path).updateProperties(path);
        }
        else {
            this.updateProperties(path);
        }
    };
    StateVariableIndicator.prototype.updateProperties = function (path) {
        var _a, _b, _c;
        this.addReferencingPath(path);
        (_a = this.isUnknown) !== null && _a !== void 0 ? _a : (this.isUnknown = path.node.isUnknown);
        (_b = this.isKnown) !== null && _b !== void 0 ? _b : (this.isKnown = path.node.isKnown);
        (_c = this.reinitialisable) !== null && _c !== void 0 ? _c : (this.reinitialisable = path.node.reinitialisable);
        if (path.isModification()) {
            this.addModifyingPath(path);
        }
    };
    StateVariableIndicator.prototype.addSecretInteractingPath = function (path) {
        this.interactsWithSecret = true;
        path.isSecret = true;
        if (!this.interactsWith.some(function (p) { return p.node.id === path.node.id; })) {
            this.interactsWith.push(path);
        }
    };
    StateVariableIndicator.prototype.addPublicInteractingPath = function (path) {
        this.interactsWithPublic = true;
        path.isPublic = true;
        if (!this.interactsWith.some(function (p) { return p.node.id === path.node.id; })) {
            this.interactsWith.push(path);
        }
    };
    StateVariableIndicator.prototype.updateFromBinding = function () {
        var _a, _b, _c, _d, _e, _f, _g;
        var _h;
        // it's possible we dont know in this fn scope whether a state is whole/owned or not, but the binding (contract scope) will
        (_a = this.isWhole) !== null && _a !== void 0 ? _a : (this.isWhole = this.binding.isWhole);
        this.isWholeReason = this.isWhole
            ? this.binding.isWholeReason
            : this.isWholeReason;
        (_b = this.isPartitioned) !== null && _b !== void 0 ? _b : (this.isPartitioned = this.binding.isPartitioned);
        this.isPartitionedReason = this.isPartitioned
            ? this.binding.isPartitionedReason
            : this.isPartitionedReason;
        (_c = this.isOwned) !== null && _c !== void 0 ? _c : (this.isOwned = this.binding.isOwned);
        (_d = this.owner) !== null && _d !== void 0 ? _d : (this.owner = this.binding.owner);
        (_e = this.onChainKeyRegistry) !== null && _e !== void 0 ? _e : (this.onChainKeyRegistry = this.binding.onChainKeyRegistry);
        (_f = (_h = this.parentIndicator).onChainKeyRegistry) !== null && _f !== void 0 ? _f : (_h.onChainKeyRegistry = this.binding.onChainKeyRegistry);
        if (this.isMapping) {
            this.mappingOwnershipType = (_g = this.owner) === null || _g === void 0 ? void 0 : _g.mappingOwnershipType;
            var mappingKeys = Object.entries(this.mappingKeys);
            for (var _i = 0, mappingKeys_1 = mappingKeys; _i < mappingKeys_1.length; _i++) {
                var _j = mappingKeys_1[_i], mappingKey = _j[1];
                mappingKey.updateFromBinding();
            }
        }
    };
    StateVariableIndicator.prototype.updateAccessed = function (path) {
        var _a, _b, _c;
        var _d;
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
        var reason = { src: path.node.src, 0: "Accessed" };
        (_a = this.isWholeReason) !== null && _a !== void 0 ? _a : (this.isWholeReason = []);
        this.isWholeReason.push(reason);
        (_b = this.accessedPaths) !== null && _b !== void 0 ? _b : (this.accessedPaths = []);
        this.accessedPaths.push(path);
        if (this.isMapping) {
            (_c = (_d = this.addMappingKey(path)).accessedPaths) !== null && _c !== void 0 ? _c : (_d.accessedPaths = []);
            this.addMappingKey(path).accessedPaths.push(path);
        }
    };
    StateVariableIndicator.prototype.updateIncrementation = function (path, state) {
        var _this = this;
        var _a, _b, _c, _d, _e, _f;
        this.parentIndicator.updateIncrementation(path, state);
        if (!path.isIncremented || state.incrementedIdentifier.isKnown) {
            this.isWhole = true;
            var reason = { src: state.incrementedIdentifier.src, 0: "Overwritten" };
            (_a = this.isWholeReason) !== null && _a !== void 0 ? _a : (this.isWholeReason = []);
            this.isWholeReason.push(reason);
            // a reinitialised state does not require a nullifier
            if (state.incrementedPath &&
                !state.incrementedIdentifier.reinitialisable) {
                this.addNullifyingPath(state.incrementedPath);
            }
            // an incremented, but not decremented, state only needs a new commitment
        }
        else if (!path.isDecremented &&
            (state.incrementedIdentifier.isUnknown ||
                ((_b = state.incrementedIdentifier.baseExpression) === null || _b === void 0 ? void 0 : _b.isUnknown))) {
            this.isPartitioned = true;
            var reason = {
                src: state.incrementedIdentifier.src,
                0: "Incremented and marked as unknown"
            };
            (_c = this.isUnknown) !== null && _c !== void 0 ? _c : (this.isUnknown = true);
            (_d = this.isPartitionedReason) !== null && _d !== void 0 ? _d : (this.isPartitionedReason = []);
            this.isPartitionedReason.push(reason);
        }
        // if its known, we already added the path
        if (path.isDecremented && !state.incrementedIdentifier.isKnown) {
            this.addNullifyingPath(state.incrementedPath);
        }
        // if its incremented anywhere, isIncremented = true
        // so we only assign if it's already falsey
        this.isIncremented || (this.isIncremented = path.isIncremented);
        this.isDecremented || (this.isDecremented = path.isDecremented);
        (_e = this.increments) !== null && _e !== void 0 ? _e : (this.increments = []);
        (_f = this.decrements) !== null && _f !== void 0 ? _f : (this.decrements = []);
        state.increments.forEach(function (inc) {
            _this.increments.push(inc);
        });
        state.decrements.forEach(function (dec) {
            _this.decrements.push(dec);
        });
        if (this.isMapping) {
            this.addMappingKey(state.incrementedPath).updateIncrementation(path, state);
        }
    };
    StateVariableIndicator.prototype.addReferencingPath = function (path) {
        this.isReferenced = true;
        ++this.referenceCount;
        if (!this.referencingPaths.some(function (p) { return p.node.id === path.node.id; }))
            this.referencingPaths.push(path);
    };
    StateVariableIndicator.prototype.addModifyingPath = function (path) {
        this.isModified = true;
        ++this.modificationCount;
        if (!this.modifyingPaths.some(function (p) { return p.node.id === path.node.id; })) {
            this.modifyingPaths.push(path);
            // TODO check usage of below when reinitialisable
            this.initialisationRequired = true; // Used? Probably for whole states?
            var node = path.node;
            if (node.isKnown)
                this.isKnown = true;
            if (node.isUnknown)
                this.isUnknown = true;
        }
    };
    StateVariableIndicator.prototype.addNullifyingPath = function (path) {
        this.isNullified = true;
        this.oldCommitmentAccessRequired = true;
        ++this.nullificationCount;
        this.nullifyingPaths.push(path);
        this.binding.addNullifyingPath(path);
        if (this.isMapping)
            this.addMappingKey(path).addNullifyingPath(path);
    };
    StateVariableIndicator.prototype.addBurningPath = function (path) {
        this.isBurned = true;
        this.burningPaths.push(path);
        if (this.isMapping)
            this.addMappingKey(path).addBurningPath(path);
    };
    StateVariableIndicator.prototype.prelimTraversalErrorChecks = function () {
        if (!this.isSecret)
            return;
        if (this.isMapping) {
            var mappingKeys = Object.entries(this.mappingKeys);
            for (var _i = 0, mappingKeys_2 = mappingKeys; _i < mappingKeys_2.length; _i++) {
                var _a = mappingKeys_2[_i], mappingKey = _a[1];
                mappingKey.prelimTraversalErrorChecks();
            }
        }
        // warning: state is clearly whole, don't need known decorator
        // added not accessed because this flags incrementations marked as known, they need to be marked as known
        if (this.isKnown && this.isWhole && !this.isIncremented) {
            logger_js_1["default"].warn("PEDANTIC: Unnecessary 'known' decorator. Secret state '".concat(this.name, "' is trivially 'known' because it is 'whole', due to:"));
            this.isWholeReason.forEach(function (reason) {
                console.log(reason[0]);
            });
        }
        // error: conflicting unknown/whole state
        if (this.isUnknown && this.isWhole) {
            console.log('err 3');
            throw new errors_js_1.SyntaxUsageError("Can't mark a whole state as 'unknown'", this.node, this.isWholeReason);
        }
        // error: conflicting whole/partitioned state
        if (this.isWhole && this.isPartitioned) {
            throw new errors_js_1.SyntaxUsageError("State cannot be whole and partitioned. The following reasons conflict.", this.node, __spreadArray(__spreadArray([], this.isWholeReason, true), this.isPartitionedReason, true));
        }
    };
    StateVariableIndicator.prototype.updateNewCommitmentsRequired = function () {
        var _this = this;
        // if we have burn statements, there are some scopes where we don't need new commitments at all
        if (!this.isBurned && this.isSecret && this.isModified) {
            this.parentIndicator.newCommitmentsRequired = true;
            this.newCommitmentsRequired = true;
            if (this.isMapping) {
                var mappingKeys = Object.entries(this.mappingKeys);
                for (var _i = 0, mappingKeys_3 = mappingKeys; _i < mappingKeys_3.length; _i++) {
                    var _a = mappingKeys_3[_i], mappingKey = _a[1];
                    mappingKey.newCommitmentsRequired = true;
                }
            }
            return;
        }
        if (!this.isSecret || !this.isBurned)
            return;
        var burnedOnly = true;
        this.modifyingPaths.forEach(function (path) {
            // if we have a modifyingPath which is NOT a burningPath, then we do need new commitments
            if (!_this.burningPaths.some(function (p) { return p.node.id === path.node.id; })) {
                logger_js_1["default"].warn("The state ".concat(_this.name, " is being burned (ownership is being revoked and the state ready for reset) and edited in the same scope (").concat(_this.scope.scopeName, "). \nThat edit may be useless and the output commmitment scheme may not work. Make sure you know what you're doing here."));
                backtrace_js_1["default"].getSourceCode(path.node.src);
                backtrace_js_1["default"].getSourceCode(_this.burningPaths[0].node.src);
                _this.parentIndicator.newCommitmentsRequired = true;
                if (_this.isMapping)
                    _this.addMappingKey(path).newCommitmentsRequired = true;
                burnedOnly = false;
            }
        });
        this.newCommitmentsRequired = !burnedOnly;
    };
    return StateVariableIndicator;
}(FunctionDefinitionIndicator));
exports.StateVariableIndicator = StateVariableIndicator;
/**
 * If a Binding/StateVarIndicator represents a mapping, it will contain a MappingKey class.
 */
var MappingKey = /** @class */ (function (_super) {
    __extends(MappingKey, _super);
    /**
     * A mappingKey can be contained within a binding or an indicator class.
     * @param { Binding || StateVarIndicator } container
     * @param { NodePath } keyPath
     */
    function MappingKey(container, keyPath) {
        var _this = _super.call(this, keyPath) || this;
        _this.container = container;
        _this.id = container.id;
        _this.node = container.node;
        // TODO: distinguish between if the key is a reference and if the key is not a reference - the prefix 'referenced' is misleading below:
        _this.referencedKeyId = keyPath.node.referencedDeclaration;
        _this.referencedKeyName = keyPath.isMsg()
            ? 'msg'
            : keyPath.getReferencedNode().name;
        _this.referencedKeyNodeType = keyPath.isMsg()
            ? 'msg.sender'
            : keyPath.getReferencedNode().nodeType;
        _this.referencedKeyIsParam = keyPath.isFunctionParameter(); // is a function parameter - used for finding owner
        _this.isMsgSender = keyPath.isMsg(); // used for finding owner
        _this.isSecret = container.isSecret; // only really used by binding.
        _this.isMapping = true;
        _this.name = _this.isMsgSender
            ? "".concat(container.name, "[msg.sender]")
            : "".concat(container.name, "[").concat(keyPath.node.name, "]");
        return _this;
    }
    MappingKey.prototype.updateProperties = function (path) {
        var _a, _b, _c;
        this.addReferencingPath(path);
        (_a = this.isUnknown) !== null && _a !== void 0 ? _a : (this.isUnknown = path.node.isUnknown);
        (_b = this.isKnown) !== null && _b !== void 0 ? _b : (this.isKnown = path.node.isKnown);
        (_c = this.reinitialisable) !== null && _c !== void 0 ? _c : (this.reinitialisable = path.node.reinitialisable);
        if (path.isModification())
            this.addModifyingPath(path);
        this.container.updateProperties(path);
    };
    // TODO: move into commonFunctions (because it's the same function as included in the Indicator class)
    MappingKey.prototype.addReferencingPath = function (path) {
        this.isReferenced = true;
        ++this.referenceCount;
        if (!this.referencingPaths.some(function (p) { return p.node.id === path.node.id; }))
            this.referencingPaths.push(path);
    };
    MappingKey.prototype.addModifyingPath = function (path) {
        this.isModified = true;
        ++this.modificationCount;
        if (!this.modifyingPaths.some(function (p) { return p.node.id === path.node.id; })) {
            this.modifyingPaths.push(path);
            this.initialisationRequired = true; // Used? Probably for whole states?
            var node = path.node;
            if (node.isKnown)
                this.isKnown = true;
            if (node.isUnknown)
                this.isUnknown = true;
        }
    };
    MappingKey.prototype.addNullifyingPath = function (path) {
        this.isNullified = true;
        ++this.nullificationCount;
        this.nullifyingPaths.push(path);
    };
    MappingKey.prototype.addBurningPath = function (path) {
        this.isBurned = true;
        this.burningPaths.push(path);
    };
    MappingKey.prototype.addSecretInteractingPath = function (path) {
        this.interactsWithSecret = true;
        path.isSecret = true;
        if (!this.interactsWith.some(function (p) { return p.node.id === path.node.id; })) {
            this.interactsWith.push(path);
            this.container.addSecretInteractingPath(path);
        }
    };
    MappingKey.prototype.addPublicInteractingPath = function (path) {
        this.interactsWithPublic = true;
        path.isPublic = true;
        if (!this.interactsWith.some(function (p) { return p.node.id === path.node.id; })) {
            this.interactsWith.push(path);
            this.container.addPublicInteractingPath(path);
        }
    };
    MappingKey.prototype.prelimTraversalErrorChecks = function () {
        var _a;
        // warning: state is clearly whole, don't need known decorator
        if (this.isKnown && this.isWhole) {
            logger_js_1["default"].warn("PEDANTIC: Unnecessary 'known' decorator. Secret state '".concat(this.name, "' is trivially 'known' because it is 'whole', due to: ").concat(this.isWholeReason));
            (_a = this.isWholeReason) === null || _a === void 0 ? void 0 : _a.forEach(function (reason) {
                console.log(reason[0]);
            });
        }
        // error: conflicting unknown/whole state
        if (this.isUnknown && this.isWhole) {
            throw new errors_js_1.SyntaxUsageError("Can't mark a whole state as 'unknown'", this.node, this.isWholeReason);
        }
        // error: conflicting whole/partitioned state
        if (this.isWhole && this.isPartitioned) {
            throw new errors_js_1.SyntaxUsageError("State cannot be whole and partitioned. The following reasons conflict.", this.container.node, __spreadArray(__spreadArray([], this.isWholeReason, true), this.isPartitionedReason, true));
        }
    };
    MappingKey.prototype.updateIncrementation = function (path, state) {
        var _this = this;
        var _a, _b, _c, _d, _e, _f;
        if (!path.isIncremented || state.incrementedIdentifier.isKnown) {
            this.isWhole = true;
            var reason = { src: state.incrementedIdentifier.src, 0: "Overwritten" };
            (_a = this.isWholeReason) !== null && _a !== void 0 ? _a : (this.isWholeReason = []);
            this.isWholeReason.push(reason);
            if (state.incrementedPath && !state.incrementedIdentifier.reinitialisable)
                this.addNullifyingPath(state.incrementedPath);
        }
        else if (!path.isDecremented &&
            (state.incrementedIdentifier.isUnknown ||
                ((_b = state.incrementedIdentifier.baseExpression) === null || _b === void 0 ? void 0 : _b.isUnknown))) {
            this.isPartitioned = true;
            var reason = {
                src: state.incrementedIdentifier.src,
                0: "Incremented and marked as unknown"
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
        state.increments.forEach(function (inc) {
            _this.increments.push(inc);
        });
        state.decrements.forEach(function (dec) {
            _this.decrements.push(dec);
        });
    };
    MappingKey.prototype.updateFromBinding = function () {
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
    };
    return MappingKey;
}(StateVariableIndicator));
exports.MappingKey = MappingKey;
