"use strict";
/* eslint-disable import/no-cycle, no-use-before-define, no-continue, no-shadow, no-param-reassign */
exports.__esModule = true;
exports.traversePathsFast = exports.traverseNodesFastVisitor = exports.traverseNodesFast = exports.traverse = void 0;
/**
This file contains portions of code from Babel (https://github.com/babel/babel). All such code has been modified for use in this repository. See below for Babel's MIT license and copyright notice:

MIT License

Copyright (c) 2014-present Sebastian McKenzie and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
/**
 * Traversers inspired by the Traverser in:
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */
var logger_js_1 = require("../utils/logger.js");
var NodePath_js_1 = require("./NodePath.js");
var solidity_types_js_1 = require("../types/solidity-types.js");
// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...
function traverse(path, visitor, state) {
    logger_js_1["default"].debug('pathLocation:', "".concat(path.getLocation(), " = ").concat(path.node.nodeType, " ").concat(path.node.name || ''));
    if ((state === null || state === void 0 ? void 0 : state.stopTraversal) || (state === null || state === void 0 ? void 0 : state.skipSubNodes))
        return;
    var node = path.node;
    var keys = (0, solidity_types_js_1.getVisitableKeys)(node.nodeType);
    if (!keys)
        return;
    var methods = visitor[node.nodeType];
    if (methods === null || methods === void 0 ? void 0 : methods.enter) {
        methods.enter(path, state);
        if (state === null || state === void 0 ? void 0 : state.stopTraversal)
            return;
    }
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        if (Array.isArray(node[key])) {
            var subNodes = node[key];
            for (var _a = 0, _b = subNodes.entries(); _a < _b.length; _a++) {
                var _c = _b[_a], index = _c[0], subNode = _c[1];
                if (!subNode)
                    continue;
                var subNodePath = new NodePath_js_1["default"]({
                    parent: node,
                    key: key,
                    container: subNodes,
                    index: index,
                    node: subNode,
                    parentPath: path
                });
                subNodePath.traverse(visitor, state);
            }
        }
        else if (node[key]) {
            var subNode = node[key];
            var subNodePath = new NodePath_js_1["default"]({
                parent: node,
                key: key,
                container: subNode,
                index: null,
                node: subNode,
                parentPath: path
            });
            subNodePath.traverse(visitor, state);
        }
    }
    if ((methods === null || methods === void 0 ? void 0 : methods.exit) && !(state === null || state === void 0 ? void 0 : state.skipSubNodes))
        methods.exit(path, state);
    if (state === null || state === void 0 ? void 0 : state.skipSubNodes)
        state.skipSubNodes = false;
}
exports.traverse = traverse;
/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs.
 * @param {function} enter - a visitor function.
 */
function traverseNodesFast(node, enter, state) {
    if (!node)
        return;
    if ((state === null || state === void 0 ? void 0 : state.stopTraversal) || (state === null || state === void 0 ? void 0 : state.skipSubNodes))
        return;
    var keys = (0, solidity_types_js_1.getVisitableKeys)(node.nodeType);
    if (!keys)
        return;
    enter(node, state);
    for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
        var key = keys_2[_i];
        if (Array.isArray(node[key])) {
            var subNodes = node[key];
            for (var _a = 0, subNodes_1 = subNodes; _a < subNodes_1.length; _a++) {
                var subNode = subNodes_1[_a];
                traverseNodesFast(subNode, enter, state);
            }
        }
        else if (node[key]) {
            var subNode = node[key];
            traverseNodesFast(subNode, enter, state);
        }
    }
    if (state === null || state === void 0 ? void 0 : state.skipSubNodes)
        state.skipSubNodes = false;
}
exports.traverseNodesFast = traverseNodesFast;
/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs. Allows seperate enter() methods per node type.
 * @param {function} enter - a visitor function.
 */
function traverseNodesFastVisitor(node, visitor, state) {
    if (!node)
        return;
    if ((state === null || state === void 0 ? void 0 : state.stopTraversal) || (state === null || state === void 0 ? void 0 : state.skipSubNodes))
        return;
    var keys = (0, solidity_types_js_1.getVisitableKeys)(node.nodeType);
    if (!keys)
        return;
    var methods = visitor[node.nodeType];
    if (methods === null || methods === void 0 ? void 0 : methods.enter) {
        methods.enter(node, state);
        if (state === null || state === void 0 ? void 0 : state.stopTraversal)
            return;
    }
    for (var _i = 0, keys_3 = keys; _i < keys_3.length; _i++) {
        var key = keys_3[_i];
        if (Array.isArray(node[key])) {
            var subNodes = node[key];
            for (var _a = 0, subNodes_2 = subNodes; _a < subNodes_2.length; _a++) {
                var subNode = subNodes_2[_a];
                traverseNodesFastVisitor(subNode, visitor, state);
            }
        }
        else if (node[key]) {
            var subNode = node[key];
            traverseNodesFastVisitor(subNode, visitor, state);
        }
    }
    if (state === null || state === void 0 ? void 0 : state.skipSubNodes)
        state.skipSubNodes = false;
}
exports.traverseNodesFastVisitor = traverseNodesFastVisitor;
/**
 * Fast traversal function for quick searching of a subtree. No scoping calcs.
 * @param {function} enter - a visitor function.
 */
function traversePathsFast(path, enter, state) {
    if (!path)
        return;
    if ((state === null || state === void 0 ? void 0 : state.stopTraversal) || (state === null || state === void 0 ? void 0 : state.skipSubNodes))
        return;
    var keys = (0, solidity_types_js_1.getVisitableKeys)(path.node.nodeType);
    if (!keys)
        return;
    enter(path, state);
    var node = path.node;
    for (var _i = 0, keys_4 = keys; _i < keys_4.length; _i++) {
        var key = keys_4[_i];
        if (Array.isArray(node[key])) {
            var subNodes = node[key];
            for (var _a = 0, _b = subNodes.entries(); _a < _b.length; _a++) {
                var _c = _b[_a], index = _c[0], subNode = _c[1];
                if (!subNode)
                    continue;
                var subNodePath = new NodePath_js_1["default"]({
                    parent: node,
                    key: key,
                    container: subNodes,
                    index: index,
                    node: subNode,
                    parentPath: path
                });
                traversePathsFast(subNodePath, enter, state);
            }
        }
        else if (node[key]) {
            var subNode = node[key];
            var subNodePath = new NodePath_js_1["default"]({
                parent: node,
                key: key,
                container: subNode,
                index: null,
                node: subNode,
                parentPath: path
            });
            traversePathsFast(subNodePath, enter, state);
        }
    }
    if (state === null || state === void 0 ? void 0 : state.skipSubNodes)
        state.skipSubNodes = false;
}
exports.traversePathsFast = traversePathsFast;
