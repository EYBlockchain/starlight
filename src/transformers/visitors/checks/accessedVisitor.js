"use strict";
exports.__esModule = true;
/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */
var config_1 = require("config");
var logger_js_1 = require("../../../utils/logger.js");
var backtrace_js_1 = require("../../../error/backtrace.js");
var errors_js_1 = require("../../../error/errors.js");
/**
 * @desc:
 * Visitor checks whether a secret state is 'accessed'.
 * This means that we need to know the value (and open a commitment) to use it here.
 * An accessed state must be whole, because we can't open a dynamic number of commitments.
 */
exports["default"] = {
    ExpressionStatement: {
        enter: function (path, state) {
            var _a;
            if (path.isIncremented &&
                ((_a = path.scope.getReferencedBinding({
                    nodeType: 'Identifier',
                    referencedDeclaration: path.incrementedDeclaration
                })) === null || _a === void 0 ? void 0 : _a.isPartitioned) // if it's not partitioned, then its an overwrite, so we dont mark an incrementedDeclaration for this visitor
            ) {
                state.inIncrementation = true;
                state.incrementedDeclaration = path.incrementedDeclaration;
            }
        },
        exit: function (path, state) {
            state.inIncrementation = false;
            state.incrementedDeclaration = null;
        }
    },
    Identifier: {
        enter: function (path, state) {
            var _a, _b, _c, _d;
            // Here, if secret:
            // 1) Check if in a 'RHS' container
            // 2) Check if NOT incrementing or WHOLE
            // e.g. a = 2b --> b accessed
            // e.g. a = a + b --> b accessed
            // e.g. a += 10, a whole --> a accessed
            // e.g. myMapping[a] = x --> a accessed
            var node = path.node, scope = path.scope;
            if (path.isMsg())
                return; // the node represents the special 'msg' type in solidity
            if (path.isThis())
                return; // the node represents the special 'this' type in solidity
            if (path.isExportedSymbol())
                return; // the node represents an external contract name
            if (path.isRequireStatement())
                return; // a require statement
            // setup - we get the left and right ancestors for error checking before anything else
            var referencedBinding = scope.getReferencedBinding(node);
            var rightAncestor = path.getRhsAncestor();
            var lhsNode = path.getCorrespondingLhsNode();
            // TODO getReferencedBinding should return the VariableDeclaration binding if the input is a VariableDeclaration
            var lhsBinding = (lhsNode === null || lhsNode === void 0 ? void 0 : lhsNode.nodeType) === 'Identifier' ||
                (lhsNode === null || lhsNode === void 0 ? void 0 : lhsNode.nodeType) === 'IndexAccess'
                ? scope.getReferencedBinding(lhsNode) ||
                    scope.getReferencedBinding({
                        nodeType: 'Identifier',
                        referencedDeclaration: lhsNode.id
                    })
                : scope.bindings[lhsNode === null || lhsNode === void 0 ? void 0 : lhsNode.id];
            // Check: is this a nonsecret param being used to edit a secret state?
            if (!(referencedBinding === null || referencedBinding === void 0 ? void 0 : referencedBinding.isSecret)) {
                // non-secret...
                if (rightAncestor &&
                    (lhsBinding === null || lhsBinding === void 0 ? void 0 : lhsBinding.isSecret) &&
                    !referencedBinding.stateVariable) {
                    // ...param which is used to assign a secret state
                    logger_js_1["default"].warn("Non-secret parameter '".concat(node.name, "' used when assigning to a secret variable '").concat(lhsBinding.name, "'. Blockchain observers might be able to infer the value of '").concat(lhsBinding.name, "' from this. I.e. although you've labelled '").concat(lhsBinding.name, "' as 'secret', it might not be secret."));
                    backtrace_js_1["default"].getSourceCode(node.src);
                }
                // if its non-secret, no accessing occurs, we exit
                return;
            }
            // Now we look for accessed states
            // if this state is on the rhs AND isn't incremented OR is in an incrementation, but its not being incremented:
            if (rightAncestor &&
                (!state.inIncrementation ||
                    (state.inIncrementation &&
                        node.referencedDeclaration !== state.incrementedDeclaration))) {
                // BELOW - error checking - extract?
                // ------
                if (lhsNode === null)
                    // null is bad
                    throw new errors_js_1.TODOError("We couldn't find a node on the LHS of this RHS node. Please create an issue.", node);
                if (lhsNode !== false && !path.isInType('FunctionCall')) {
                    // false is ok - we have something without a LHS, like a conditional
                    if (!referencedBinding.stateVariable) {
                        // we have a secret parameter on the RHS
                        if (!lhsBinding.isSecret)
                            // non-secret param assigning a secret state is ok, but we warn the user
                            // however a secret param being used to assign a non-secret state is bad:
                            throw new errors_js_1.SyntaxUsageError("A secret parameter (".concat(node.name, ") should not be used to assign to a non-secret variable (").concat(lhsNode.name, "). The secret could be deduced by observing how the non-secret variable changes."), node);
                        if (!lhsBinding.stateVariable)
                            // we have secret param1 = param2 (e.g.) - this is weird
                            logger_js_1["default"].warn("Secret parameter ".concat(node.name, " is being used to assign a non-global state. Is this intended?"));
                        return; // we stop, because we never have to access parameters
                    }
                    if (!lhsBinding.isSecret) {
                        // Henceforth `node` must be a stateVariable on the RHS
                        throw new errors_js_1.SyntaxUsageError("Secret state ".concat(node.name, " should not be used to assign to a non-secret variable (").concat(lhsNode.name, "). The secret could be deduced by observing how the non-secret variable changes."), node);
                    }
                }
                else if (rightAncestor.parent.nodeType === 'IndexAccess') {
                    // we still want to check params used as mapping keys here
                    if (!referencedBinding.stateVariable)
                        return;
                    // TODO: consider errors for when we access a secret state to use it as a mappingKey
                    // e.g. should we allow this for public mappings? (probably not)
                }
                // end of error checking
                // ------
                logger_js_1["default"].debug("Found an accessed secret state ".concat(node.name));
                if (config_1["default"].log_level === 'debug')
                    backtrace_js_1["default"].getSourceCode(node.src);
                (_a = scope.getReferencedBinding(node)) === null || _a === void 0 ? void 0 : _a.updateAccessed(path);
                (_b = scope.getReferencedIndicator(node)) === null || _b === void 0 ? void 0 : _b.updateAccessed(path);
                // @Node new property
                node.accessedSecretState = true;
                return;
            }
            // below: check if the identifier is on the LHS and is NOT partitioned AND requires the LHS value e.g. a *= b
            // we don't check all the types of LHS container, because a +=,*=,-= b is always an Assignment with a .leftHandSide
            var leftAncestor = path.getAncestorContainedWithin('leftHandSide');
            if (leftAncestor &&
                !referencedBinding.isPartitioned && // if this is a partitioned incremented, it would have been marked already
                ['*=', '+=', '-='].includes(leftAncestor.parent.operator)) {
                if (!referencedBinding.isWhole &&
                    !referencedBinding.isKnown &&
                    !referencedBinding.isUnknown)
                    logger_js_1["default"].warn("We don't know whether this state ".concat(node.name, " is whole or partitioned - but since there are no known/unknown decorators, we assume its a whole state which nobody but the owner can edit."));
                logger_js_1["default"].debug("Found an accessed secret state ".concat(node.name, " (accessed in ").concat(leftAncestor.parent.operator, " operation)"));
                (_c = scope.getReferencedBinding(node)) === null || _c === void 0 ? void 0 : _c.updateAccessed(path);
                (_d = scope.getReferencedIndicator(node)) === null || _d === void 0 ? void 0 : _d.updateAccessed(path);
            }
        },
        exit: function (path, state) { }
    }
};
