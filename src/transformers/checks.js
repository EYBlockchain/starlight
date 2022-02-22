"use strict";
/* eslint-disable no-param-reassign */
exports.__esModule = true;
var NodePath_js_1 = require("../traverse/NodePath.js");
// import { traverseNodesFastVisitor } from '../traverse/traverse.js';
var logger_js_1 = require("../utils/logger.js");
var explode_js_1 = require("./visitors/explode.js");
// import unsupportedVisitor from './visitors/checks/unsupportedVisitor.mjs';
// import externalCallVisitor from './visitors/checks/externalCallVisitor.mjs';
// import decoratorVisitor from './visitors/checks/decoratorVisitor.mjs';
// import incrementedVisitor from './visitors/checks/incrementedVisitor.js';
//import accessedVisitor from './visitors/checks/accessedVisitor.js';
var requireStatementVisitor_js_1 = require("./visitors/checks/requireStatementVisitor.js");
// import localDeclarationsVisitor from './visitors/checks/localDeclarationsVisitor.mjs';
// import msgSenderParam from './visitors/checks/msgSenderParam.mjs';
// import interactsWithSecretVisitor from './visitors/checks/interactsWithSecretVisitor.mjs';
/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */
function transformation1(oldAST) {
    var state = {
        stopTraversal: false,
        skipSubNodes: false
    };
    // TODO move this back into path traversals
    // it's here to catch the internal calls error which scope can't handle right now
    // traverseNodesFastVisitor(oldAST, explode(unsupportedVisitor), state);
    // logger.verbose('No unsupported Solidity');
    var newAST = {
        nodeType: 'Folder',
        files: []
    };
    oldAST._newASTPointer = newAST.files;
    var dummyParent = {
        ast: oldAST
    };
    dummyParent._newASTPointer = newAST;
    var path = new NodePath_js_1["default"]({
        parentPath: null,
        parent: dummyParent,
        key: 'ast',
        index: null,
        container: oldAST,
        node: oldAST
    });
    // We'll start by calling the traverser function with our ast and a visitor.
    // The newAST will be mutated through this traversal process.
    // Hari
    // path.traverse(explode(externalCallVisitor), state);
    // logger.verbose('No unsupported external calls');
    // path.traverse(explode(decoratorVisitor), state);
    // logger.verbose('No conflicting known/unknown decorators');
    // path.traverse(explode(interactsWithSecretVisitor), state);
    // logger.verbose('Secret interacts marked');
    // path.traverse(explode(incrementedVisitor), state); // M
    // logger.verbose('Incrementations marked');
    // Swati:
    // path.traverse(explode(accessedVisitor), state);
    // logger.verbose('Accessed values marked');
    path.traverse((0, explode_js_1["default"])(requireStatementVisitor_js_1["default"]), state);
    logger_js_1["default"].verbose('Require statements labelled public / private');
    // path.traverse(explode(localDeclarationsVisitor), state);
    // logger.verbose('Checked for unsupported local variable declarations');
    // path.traverse(explode(msgSenderParam), state);
    // At the end of our transformer function we'll return the new ast that we
    // just created.
    return path;
}
// A transformer function which will accept an ast.
function checks(ast) {
    logger_js_1["default"].verbose('Performing checks on the zol AST...');
    var path = transformation1(ast);
    logger_js_1["default"].verbose('Checks complete.');
    return path;
}
exports["default"] = checks;
