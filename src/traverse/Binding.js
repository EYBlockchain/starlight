"use strict";
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
exports.MappingKeyBinding = exports.VariableBinding = exports.Binding = void 0;
/* eslint-disable max-classes-per-file, no-param-reassign, no-continue */
var config_1 = require("config");
var logger_js_1 = require("../utils/logger.js");
var errors_js_1 = require("../error/errors.js");
var backtrace_js_1 = require("../error/backtrace.js");
var NodePath_js_1 = require("./NodePath.js");
var cache_js_1 = require("./cache.js");
var Binding = /** @class */ (function () {
    function Binding(path) {
        this.isReferenced = false;
        this.referenceCount = 0;
        this.referencingPaths = [];
        var _a = path.node, name = _a.name, id = _a.id, nodeType = _a.nodeType, node = path.node;
        this.kind = nodeType; // QUESTION: why not just call it nodeType? In future will 'kind' differ from nodeType?
        this.id = id;
        this.name = name;
        this.node = node;
        this.path = path;
    }
    // Exists to catch nodeTypes for which a binding makes no sense
    Binding.isBindable = function (nodeType) {
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
                logger_js_1["default"].error("Hitherto unknown nodeType '".concat(nodeType, "'"));
                throw new TypeError(nodeType);
        }
    };
    /**
     We initialise the class via a static method (rather than through a constructor) to handle the possibility that we don't actually want to create a binding for the given path. Viz if the path is not 'bindable' (see isBindable).
     * @param {NodePath} path
     * @returns {Binding || null}
     */
    Binding.create = function (path) {
        var node = path.node;
        if (!this.isBindable(node.nodeType))
            return null;
        var cachedBinding = cache_js_1.bindingCache.get(node);
        if (cachedBinding)
            return cachedBinding;
        var binding;
        if (node.nodeType === 'VariableDeclaration') {
            binding = new VariableBinding(path);
        }
        else {
            binding = new Binding(path);
        }
        cache_js_1.bindingCache.set(node, binding);
        return binding;
    };
    Binding.getBinding = function (node) {
        if (cache_js_1.bindingCache.has(node))
            return cache_js_1.bindingCache.get(node);
        logger_js_1["default"].warn("Node ".concat(node.name, " not found in bindingCache"));
        return null;
    };
    Binding.prototype.update = function (path) {
        this.updateProperties(path);
    };
    Binding.prototype.updateProperties = function (path) {
        this.addReferencingPath(path);
    };
    Binding.prototype.addReferencingPath = function (path) {
        this.isReferenced = true;
        ++this.referenceCount;
        if (!this.referencingPaths.some(function (p) { return p.node.id === path.node.id; }))
            this.referencingPaths.push(path);
    };
    Binding.prototype.isNullifiable = function () {
        var bindings = Object.entries(this.path.scope.bindings);
        for (var _i = 0, bindings_1 = bindings; _i < bindings_1.length; _i++) {
            var _a = bindings_1[_i], binding = _a[1];
            binding.isNullifiable();
        }
    };
    return Binding;
}());
exports.Binding = Binding;
var VariableBinding = /** @class */ (function (_super) {
    __extends(VariableBinding, _super);
    function VariableBinding(path) {
        var _a;
        var _this = _super.call(this, path) || this;
        _this.modificationCount = 0;
        _this.modifyingPaths = []; // array of paths of `Identifier` nodes which modify this variable
        // NOTE: modification _is_ nullification, unless it's a partitioned state being incremented (in which case there's no nullifier). So nullifyingPaths is a subset of modifyingPaths.
        _this.isNullified = false;
        _this.nullificationCount = 0;
        _this.nullifyingPaths = []; // array of paths of `Identifier` nodes which nullify this binding
        _this.increments = []; // array of nodes
        _this.decrements = []; // array of nodes
        _this.isMapping = false;
        _this.mappingKeys = {}; // object of objects, indexed by node id.
        _this.isKnown = false;
        _this.isUnknown = false;
        _this.isIncremented = false;
        _this.isDecremented = false;
        _this.isWhole = false;
        _this.isAccessed = false;
        _this.isPartitioned = false;
        _this.isBurned = false;
        _this.isOwned = false;
        _this.owner = null; // object of objects, indexed by node id.
        var name = path.node.name, node = path.node;
        if (!path.isNodeType('VariableDeclaration'))
            throw new TypeError("Binding for ".concat(name, " cannot be a VariableBinding"));
        _this.stateVariable = node.stateVariable;
        _this.isSecret = (_a = node.isSecret) !== null && _a !== void 0 ? _a : false;
        if (path.isMappingDeclaration()) {
            _this.isMapping = true;
            _this.mappingKeys = {};
        }
        return _this;
    }
    /**
     * Gets a mapping's indicator object for a particular key.
     * @param {Object} - the mapping's index access node.
     * @returns {String} - the name under which the mapping[key]'s indicator is stored
     */
    VariableBinding.prototype.getMappingKeyName = function (path) {
        var _a;
        var node = path.node;
        if (node.nodeType !== 'IndexAccess')
            return this.getMappingKeyName(path.getAncestorOfType('IndexAccess'));
        var keyIdentifierNode = path.getMappingKeyIdentifier();
        if (!keyIdentifierNode)
            return node.indexExpression.name || node.indexExpression.value;
        var keyBinding = path.isMsg(keyIdentifierNode)
            ? null
            : Binding.getBinding(path.getReferencedNode(keyIdentifierNode));
        var keyName = keyIdentifierNode.name;
        // If the value of the mapping key is edited between mapping accesses then the below copes with that.
        // NB: we can't use the modification count because this may refer to a mappingKey before its modified for the nth time
        if (keyBinding === null || keyBinding === void 0 ? void 0 : keyBinding.isModified) {
            var i = 0;
            // Consider each time the variable (which becomes the mapping's key) is edited throughout the scope:
            for (var _i = 0, _b = keyBinding.modifyingPaths; _i < _b.length; _i++) {
                var modifyingPath = _b[_i];
                // we have found the 'current' state (relative to the input node), so we don't need to move any further
                if (node.id < modifyingPath.node.id && i === 0)
                    break;
                i++;
                if (modifyingPath.node.id < node.id && // a modification to the variable _before_ it was used as the mapping's key
                    node.id < ((_a = keyBinding.modifyingPaths[i]) === null || _a === void 0 ? void 0 : _a.node.id))
                    break;
            }
            if (i > 0)
                keyName = "".concat(keyIdentifierNode.name, "_").concat(i);
        }
        return keyName;
    };
    // If this binding represents a mapping stateVar, then throughout the code, this mapping will be accessed with different keys. Only when we reach that key during traversal can we update this binding to say "this mapping sometimes gets accessed via this particular key"
    // @param referencingPath = NodePath of baseExpression
    VariableBinding.prototype.addMappingKey = function (referencingPath) {
        var keyNode = referencingPath.getMappingKeyIdentifier();
        var keyPath = NodePath_js_1["default"].getPath(keyNode);
        if (!keyPath)
            throw new Error('No keyPath found in pathCache');
        if (keyNode.nodeType !== 'Identifier') {
            throw new errors_js_1.TODOError("A mapping key of nodeType '".concat(keyNode.nodeType, "' isn't supported yet. We've only written the code for keys of nodeType Identifier'"), keyNode);
        }
        // naming of the key within mappingKeys:
        var keyName = this.getMappingKeyName(referencingPath);
        // add this mappingKey if it hasn't yet been added:
        var mappingKeyExists = !!this.mappingKeys[keyName];
        if (!mappingKeyExists)
            this.mappingKeys[keyName] = new MappingKeyBinding(this, keyPath);
        return this.mappingKeys[keyName];
    };
    // A binding will be updated if (some time after its creation) we encounter an AST node which refers to this binding's variable.
    // E.g. if we encounter an Identifier node.
    VariableBinding.prototype.update = function (path) {
        if (this.isMapping) {
            this.addMappingKey(path).updateProperties(path);
        }
        else {
            this.updateProperties(path);
        }
    };
    VariableBinding.prototype.updateProperties = function (path) {
        var _a, _b, _c;
        this.addReferencingPath(path);
        (_a = this.isUnknown) !== null && _a !== void 0 ? _a : (this.isUnknown = path.node.isUnknown);
        (_b = this.isKnown) !== null && _b !== void 0 ? _b : (this.isKnown = path.node.isKnown);
        (_c = this.reinitialisable) !== null && _c !== void 0 ? _c : (this.reinitialisable = path.node.reinitialisable);
        if (path.isModification())
            this.addModifyingPath(path);
    };
    VariableBinding.prototype.updateOwnership = function (ownerNode, msgIsMappingKeyorMappingValue) {
        var _a, _b;
        if (((_a = ownerNode.expression) === null || _a === void 0 ? void 0 : _a.name) === 'msg' &&
            msgIsMappingKeyorMappingValue === 'value') {
            // here: the owner is msg.sender for mapping[key] = msg.sender
            ownerNode.name = 'msg';
            ownerNode.mappingOwnershipType = 'value';
        }
        else if (((_b = ownerNode.expression) === null || _b === void 0 ? void 0 : _b.name) === 'msg') {
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
                var thisPath = NodePath_js_1["default"].getPath(ownerNode);
                var binOpNode = thisPath.getAncestorOfType('BinaryOperation').node;
                if (binOpNode.operator !== '==' &&
                    !thisPath.isMsgSender(binOpNode.leftExpression) &&
                    !thisPath.isMsgSender(binOpNode.rightExpression))
                    throw new Error("The new msg.sender ownership code didn't work!");
                // extracting this particular msg.sender node to maintain node.src
                var thisMsgSenderNode = thisPath.isMsgSender(binOpNode.leftExpression)
                    ? binOpNode.leftExpression
                    : binOpNode.rightExpression;
                this.updateOwnership(thisMsgSenderNode, 'value');
                return;
            }
        }
        else {
            ownerNode.mappingOwnershipType = msgIsMappingKeyorMappingValue;
        }
        if (this.isOwned && this.owner.name !== ownerNode.name) {
            throw new errors_js_1.ZKPError("We found two distinct owners (".concat(this.owner.name, " and ").concat(ownerNode.name, ") of a secret state, which we can't allow because only one public key needs to be able to open/nullify the secret."), this.node);
        }
        if (this.isOwned &&
            this.owner.mappingOwnershipType !== ownerNode.mappingOwnershipType) {
            throw new errors_js_1.ZKPError("We found two distinct owners of a secret state - msg.sender when the mapping key is msg.sender, and when the mapping value is msg.sender, which we can't allow because only one public key needs to be able to open/nullify the secret.", this.node);
        }
        ownerNode.isParam = NodePath_js_1["default"].getPath(ownerNode).isFunctionParameter();
        this.owner = ownerNode;
        this.isOwned = true;
        if (this.owner.typeDescriptions.typeIdentifier.includes('address') ||
            this.owner.name === 'msg')
            this.onChainKeyRegistry = true;
        if (this.isMapping) {
            var mappingKeys = Object.entries(this.mappingKeys);
            for (var _i = 0, mappingKeys_1 = mappingKeys; _i < mappingKeys_1.length; _i++) {
                var _c = mappingKeys_1[_i], mappingKey = _c[1];
                mappingKey.updateOwnership(ownerNode);
            }
        }
    };
    VariableBinding.prototype.updateBlacklist = function (blacklistedNode) {
        var _a;
        (_a = this.blacklist) !== null && _a !== void 0 ? _a : (this.blacklist = []);
        this.blacklist.push(blacklistedNode);
    };
    VariableBinding.prototype.updateAccessed = function (path) {
        var _a;
        // The binding level tells us about the state everywhere, so we only need to update if it's whole/partitioned
        // TODO split if isMapping
        this.isWhole = true;
        this.isAccessed = true;
        var reason = { src: path.node.src, 0: "Accessed" };
        (_a = this.isWholeReason) !== null && _a !== void 0 ? _a : (this.isWholeReason = []);
        this.isWholeReason.push(reason);
    };
    VariableBinding.prototype.updateIncrementation = function (path, state) {
        var _a, _b, _c, _d;
        // The binding level tells us about the state everywhere, so we only need to update if it's whole/partitioned
        // We update the function level indicators with isIncremented
        // TODO split if isMapping
        if (!path.isIncremented) {
            this.isWhole = true;
            var reason = { src: state.incrementedIdentifier.src, 0: "Overwritten" };
            (_a = this.isWholeReason) !== null && _a !== void 0 ? _a : (this.isWholeReason = []);
            this.isWholeReason.push(reason);
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
    };
    VariableBinding.prototype.addModifyingPath = function (path) {
        this.isModified = true;
        ++this.modificationCount;
        if (!this.modifyingPaths.some(function (p) { return p.node.id === path.node.id; }))
            this.modifyingPaths.push(path);
    };
    VariableBinding.prototype.addNullifyingPath = function (path) {
        this.isNullified = true;
        ++this.nullificationCount;
        this.nullifyingPaths.push(path);
        if (this.isMapping)
            this.addMappingKey(path).addNullifyingPath(path);
    };
    VariableBinding.prototype.prelimTraversalErrorChecks = function () {
        var _a;
        if (!this.isSecret)
            return;
        if (this.isMapping) {
            var mappingKeys = Object.entries(this.mappingKeys);
            for (var _i = 0, mappingKeys_2 = mappingKeys; _i < mappingKeys_2.length; _i++) {
                var _b = mappingKeys_2[_i], mappingKey = _b[1];
                mappingKey.prelimTraversalErrorChecks();
            }
        }
        // error: no known/unknown mark on any incrementation(s)
        if (this.isIncremented &&
            ((_a = this.isWhole) !== null && _a !== void 0 ? _a : true) &&
            !this.isDecremented &&
            !this.isKnown &&
            !this.isUnknown) {
            throw new errors_js_1.SyntaxUsageError("Secret state '".concat(this.name, "' incremented, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know."), this.node);
        }
        // error: conflicting unknown/whole state
        if (this.isUnknown && this.isWhole) {
            console.log('err 1');
            throw new errors_js_1.SyntaxUsageError("Can't mark a whole state as 'unknown'", this.node, this.isWholeReason);
        }
        // error: conflicting reinitialisable/partitioned state
        if (this.reinitialisable && this.isPartitioned) {
            throw new errors_js_1.SyntaxUsageError("Can't mark a partitioned state as 'reinitialisable' - partitioned states do not need nullfiers to initialise/add to, so there's no need for this syntax.", this.node, this.isPartitionedReason);
        }
        // error: conflicting whole/partitioned state
        if (this.isWhole && this.isPartitioned) {
            throw new errors_js_1.SyntaxUsageError("State cannot be whole and partitioned. The following reasons conflict.", this.node, __spreadArray(__spreadArray([], this.isWholeReason, true), this.isPartitionedReason, true));
        }
    };
    /**
     * Decides whether the state/each state in this scope is nullifiable
     * This function exists solely to catch errors.
     * If no errors are found, the calling code will simply carry on.
     */
    VariableBinding.prototype.isNullifiable = function () {
        if (!this.isSecret)
            return;
        if (!this.stateVariable)
            return;
        if (this.node.isConstant || this.node.constant)
            return;
        if (this.isMapping) {
            var mappingKeys = Object.entries(this.mappingKeys);
            for (var _i = 0, mappingKeys_3 = mappingKeys; _i < mappingKeys_3.length; _i++) {
                var _a = mappingKeys_3[_i], mappingKey = _a[1];
                if (mappingKey.isMsgSender || mappingKey.referencedKeyIsParam) {
                    if (mappingKey.isNullifiable())
                        return;
                    // if a msg sender or param key is nullifiable, then the entire mapping is nullifiable
                }
            }
            // we reach here, there's no msg sender/param keys, so we must check each one
            for (var _b = 0, mappingKeys_4 = mappingKeys; _b < mappingKeys_4.length; _b++) {
                var _c = mappingKeys_4[_b], mappingKey = _c[1];
                if (!mappingKey.isNullifiable() && this.isWhole)
                    throw new errors_js_1.ZKPError("All whole states must be nullifiable, otherwise they are useless after initialisation! Consider making ".concat(this.name, " editable or constant."), this.node);
            }
            return;
        }
        if (this.isNullified !== true && this.isWhole) {
            throw new errors_js_1.ZKPError("All whole states must be nullifiable, otherwise they are useless after initialisation! Consider making ".concat(this.name, " editable or constant."), this.node);
        }
    };
    /**
     * Decides whether the state is owned.
     * Infers ownership and marks the binding.
     */
    VariableBinding.prototype.inferOwnership = function () {
        var _this = this;
        if (this.kind !== 'VariableDeclaration')
            return;
        var msgSenderEverywhereMappingKey;
        var msgSenderEverywhereMappingValue;
        this.nullifyingPaths.forEach(function (path) {
            var functionDefScope = path.scope.getAncestorOfScopeType('FunctionDefinition');
            if (functionDefScope.callerRestriction === 'match') {
                _this.updateOwnership(functionDefScope.callerRestrictionNode);
                return;
            }
            if (functionDefScope.callerRestriction === 'exclude') {
                _this.updateBlacklist(functionDefScope.callerRestrictionNode);
            }
            if (_this.isMapping && _this.addMappingKey(path).isMsgSender) {
                // if its unassigned, we assign true
                // if its true, it remains true
                msgSenderEverywhereMappingKey !== null && msgSenderEverywhereMappingKey !== void 0 ? msgSenderEverywhereMappingKey : (msgSenderEverywhereMappingKey = true);
            }
            else if (_this.isMapping &&
                path.isMsgSender(path.getCorrespondingRhsNode())) {
                msgSenderEverywhereMappingValue !== null && msgSenderEverywhereMappingValue !== void 0 ? msgSenderEverywhereMappingValue : (msgSenderEverywhereMappingValue = true);
            }
            else {
                // if we find a single non-msg sender mapping key, then msg sender can't be the owner
                msgSenderEverywhereMappingKey = false;
                msgSenderEverywhereMappingValue = false;
            }
        });
        if (msgSenderEverywhereMappingKey && !msgSenderEverywhereMappingValue) {
            // pass the msg.sender node to the updateOwnership method
            this.updateOwnership(this.addMappingKey(this.nullifyingPaths[0]).keyPath.node, 'key');
        }
        else if (msgSenderEverywhereMappingValue) {
            // pass the msg.sender node to the updateOwnership method
            var owner = this.nullifyingPaths[0].parent.rightHandSide ||
                this.nullifyingPaths[0].parentPath.parent.rightHandSide;
            this.updateOwnership(owner, 'value');
        }
    };
    VariableBinding.prototype.ownerSetToZeroCheck = function () {
        var _a;
        // TODO rename - this method also marks 'burn' statements
        var ownerNode = this.owner;
        var ownerBinding = this.path.getReferencedBinding(ownerNode);
        // mapping[msg.sender] is owned by msg.sender => look for mapping[0]
        if (ownerNode.name === 'msg' && ownerNode.mappingOwnershipType === 'key') {
            // the owner is represented by the mapping key - we look through the keys for 0
            var mappingKeys = Object.entries(this.mappingKeys);
            for (var _i = 0, mappingKeys_5 = mappingKeys; _i < mappingKeys_5.length; _i++) {
                var _b = mappingKeys_5[_i], mappingKey = _b[1];
                // TODO we can't yet set mappingKeys to anything not an identifier
                var keyNode = mappingKey.keyPath.node;
                if (keyNode.nodeType === 'FunctionCall' &&
                    ((_a = keyNode.arguments[0]) === null || _a === void 0 ? void 0 : _a.value) === '0') {
                    // we have found an owner set to hardcoded 0
                    this.ownerSetToZeroWarning(keyNode);
                    if (this.reinitialisable) {
                        var burnPath = mappingKey.keyPath.getAncestorOfType('ExpressionStatement');
                        burnPath.isBurnStatement = true;
                        // TODO call updateBurnStatement in indicator
                    }
                }
            }
        }
        // mapping[key] = msg.sender is owned by msg.sender => look for mapping[key] = 0
        // OR owner is some value (admin = address) => look for admin = 0
        if (ownerNode.name === 'msg' &&
            ownerNode.mappingOwnershipType === 'value') {
            // the owner is represented by the mapping value - we look through the modifyingPaths for 0
            this.searchModifyingPathsForZero();
        }
        else if (ownerBinding && ownerBinding instanceof VariableBinding) {
            ownerBinding.searchModifyingPathsForZero();
        }
        if (this.reinitialisable && !this.isBurned)
            throw new errors_js_1.SyntaxUsageError("The state ".concat(this.name, " has been marked as reinitialisable but we can't find anywhere to burn a commitment ready for reinitialisation."), this.node);
    };
    VariableBinding.prototype.searchModifyingPathsForZero = function () {
        var _a, _b;
        for (var _i = 0, _c = this.modifyingPaths; _i < _c.length; _i++) {
            var path = _c[_i];
            var assignmentNode = (_a = path.getAncestorOfType('Assignment')) === null || _a === void 0 ? void 0 : _a.node;
            if (!assignmentNode)
                continue;
            if (assignmentNode.rightHandSide.nodeType === 'FunctionCall' &&
                ((_b = assignmentNode.rightHandSide.arguments[0]) === null || _b === void 0 ? void 0 : _b.value) === '0' &&
                (assignmentNode.leftHandSide.id === path.node.id ||
                    assignmentNode.leftHandSide.baseExpression.id === path.node.id)) {
                // we have found an owner set to hardcoded 0
                this.ownerSetToZeroWarning(assignmentNode);
                if (this.reinitialisable) {
                    path.getAncestorOfType('ExpressionStatement').isBurnStatement = true;
                    path.scope.getReferencedIndicator(path.node).addBurningPath(path);
                }
            }
        }
    };
    VariableBinding.prototype.ownerSetToZeroWarning = function (node) {
        if (node === void 0) { node = this.node; }
        if (!this.reinitialisable) {
            logger_js_1["default"].warn("This line resets the public key inside the commitment (i.e. the owner) to 0. This means you relinquish ownership of the state and it can never be used again. \nIf you want the state to be burned and reset, mark the line where it is initialised as reinitialisable. Without doing so, you end up with a secret state of no owner which nobody can access.");
            backtrace_js_1["default"].getSourceCode(node.src);
        }
        else {
            logger_js_1["default"].debug("Found a statement which burns the secret state and allows it to be reinitialised. If this line isn't meant to do that, check why you are setting the address to 0.");
            if (config_1["default"].get('log_level') === 'debug')
                backtrace_js_1["default"].getSourceCode(node.src);
            this.isBurned = true;
            // TODO more useful indicators here
        }
    };
    return VariableBinding;
}(Binding));
exports.VariableBinding = VariableBinding;
// add common functions as methods to the classes:
// Object.assign(MappingKey.prototype, commonFunctions);
//
// Object.assign(Binding.prototype, commonFunctions);
/**
 * If a Binding/StateVarIndicator represents a mapping, it will contain a MappingKey class.
 */
var MappingKeyBinding = /** @class */ (function (_super) {
    __extends(MappingKeyBinding, _super);
    /**
     * A mappingKey can be contained within a binding or an indicator class.
     * @param { Binding || StateVarIndicator } container
     * @param { NodePath } keyPath
     */
    function MappingKeyBinding(container, keyPath) {
        var _this = _super.call(this, keyPath) || this;
        _this.container = container;
        // TODO: distinguish between if the key is a reference and if the key is not a reference - the prefix 'referenced' is misleading below:
        _this.referencedKeyId = keyPath.node.referencedDeclaration;
        _this.referencedKeyNodeType = keyPath.isMsg()
            ? 'msg.sender'
            : keyPath.getReferencedNode().nodeType;
        _this.referencedKeyIsParam = keyPath.isFunctionParameter(); // is a function parameter - used for finding owner
        _this.keyPath = keyPath;
        _this.isMsgSender = keyPath.isMsg(); // used for finding owner
        _this.isSecret = container.isSecret;
        _this.name = _this.isMsgSender
            ? "".concat(container.name, "[msg.sender]")
            : "".concat(container.name, "[").concat(keyPath.node.name, "]");
        _this.isReferenced = false;
        _this.referenceCount = 0;
        _this.referencingPaths = []; // paths which reference this variable
        _this.isModified = false;
        _this.modificationCount = 0;
        _this.modifyingPaths = []; // paths which reference this variable
        _this.isNullified = false;
        _this.nullificationCount = 0;
        _this.nullifyingPaths = []; // array of paths of `Identifier` nodes which nullify this binding
        return _this;
    }
    MappingKeyBinding.prototype.updateProperties = function (path) {
        var _a, _b, _c;
        this.addReferencingPath(path);
        (_a = this.isUnknown) !== null && _a !== void 0 ? _a : (this.isUnknown = path.node.isUnknown);
        (_b = this.isKnown) !== null && _b !== void 0 ? _b : (this.isKnown = path.node.isKnown);
        (_c = this.reinitialisable) !== null && _c !== void 0 ? _c : (this.reinitialisable = path.node.reinitialisable);
        if (path.isModification())
            this.addModifyingPath(path);
        this.container.updateProperties(path);
    };
    MappingKeyBinding.prototype.updateOwnership = function (ownerNode) {
        if (this.isOwned && this.owner.name !== ownerNode.name) {
            throw new errors_js_1.ZKPError("We found two distinct owners (".concat(this.owner.name, " and ").concat(ownerNode.name, ") of a secret state, which we can't allow because only one public key needs to be able to open/nullify the secret."), this.node);
        }
        this.owner = ownerNode;
        this.isOwned = true;
        if (this.owner.typeDescriptions.typeIdentifier.includes('address'))
            this.onChainKeyRegistry = true;
    };
    // TODO: move into commonFunctions (because it's the same function as included in the Binding class)
    MappingKeyBinding.prototype.addReferencingPath = function (path) {
        this.isReferenced = true;
        ++this.referenceCount;
        if (!this.referencingPaths.some(function (p) { return p.node.id === path.node.id; }))
            this.referencingPaths.push(path);
    };
    MappingKeyBinding.prototype.addModifyingPath = function (path) {
        this.isModified = true;
        ++this.modificationCount;
        if (!this.modifyingPaths.some(function (p) { return p.node.id === path.node.id; })) {
            this.modifyingPaths.push(path);
        }
    };
    MappingKeyBinding.prototype.addNullifyingPath = function (path) {
        this.isNullified = true;
        ++this.nullificationCount;
        this.nullifyingPaths.push(path);
    };
    MappingKeyBinding.prototype.prelimTraversalErrorChecks = function () {
        var _a, _b;
        // warning: state is clearly whole, don't need known decorator
        if (this.isKnown && this.isWhole) {
            logger_js_1["default"].warn("PEDANTIC: Unnecessary 'known' decorator. Secret state '".concat(this.name, "' is trivially 'known' because it is 'whole', due to: ").concat(this.isWholeReason));
            (_a = this.isWholeReason) === null || _a === void 0 ? void 0 : _a.forEach(function (reason) {
                console.log(reason[0]);
            });
        }
        // error: no known/unknown mark on any incrementation(s)
        if (this.isIncremented &&
            ((_b = this.isWhole) !== null && _b !== void 0 ? _b : true) &&
            !this.isDecremented &&
            !this.isKnown &&
            !this.isUnknown) {
            throw new errors_js_1.SyntaxUsageError("Secret state '".concat(this.name, "' incremented, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know."), this.container.node);
        }
        // error: conflicting unknown/whole state
        if (this.isUnknown && this.isWhole) {
            console.log('err 2');
            throw new errors_js_1.SyntaxUsageError("Can't mark a whole state as 'unknown'", this.node, this.isWholeReason);
        }
        // error: conflicting whole/partitioned state
        if (this.isWhole && this.isPartitioned) {
            throw new errors_js_1.SyntaxUsageError("State cannot be whole and partitioned. The following reasons conflict.", this.node, __spreadArray(__spreadArray([], this.isWholeReason, true), this.isPartitionedReason, true));
        }
    };
    MappingKeyBinding.prototype.isNullifiable = function () {
        // in some cases, it's fine for certain mapping keys to not be nullifiable, as a parameter key means that any key is nullifiable
        // so, we don't throw an error here
        return !!this.isNullified;
    };
    return MappingKeyBinding;
}(VariableBinding));
exports.MappingKeyBinding = MappingKeyBinding;
