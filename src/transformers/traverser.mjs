/* eslint-disable no-use-before-define, no-shadow */

import logger from '../utils/logger.mjs';

/**
 * Edited from the Super Tiny compiler (updating it to traverse a Solidity ast):
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

/**
 * ============================================================================
 *                                 ⌒(❀>◞౪◟<❀)⌒
 *                               THE TRAVERSER!!!
 * ============================================================================
 */

/**
 * So now we have our AST, and we want to be able to visit different nodes with
 * a visitor. We need to be able to call the methods on the visitor whenever we
 * encounter a node with a matching type.
 *
 *   traverse(ast, visitor)... e.g.:
 *
 *   traverse(ast, {
 *     Program: {
 *       enter(node, parent) {
 *         // ...
 *       },
 *       exit(node, parent) {
 *         // ...
 *       },
 *     },
 *
 *     CallExpression: {
 *       enter(node, parent) {
 *         // ...
 *       },
 *       exit(node, parent) {
 *         // ...
 *       },
 *     },
 *
 *     NumberLiteral: {
 *       enter(node, parent) {
 *         // ...
 *       },
 *       exit(node, parent) {
 *         // ...
 *       },
 *     },
 *   });
 */

// So we define a traverser function which accepts an AST and a
// visitor. Inside we're going to define two functions...
function traverse(ast, parent, visitor, state) {
  // A `traverseArray` function that will allow us to iterate over an array and
  // call the next function that we will define: `traverseNode`.
  function traverseArray(array, parent) {
    if (!array) return;
    array.forEach(child => {
      traverseNode(child, parent);
    });
  }

  // `traverseNode` will accept a `node` and its `parent` node. So that it can
  // pass both to our visitor methods.
  function traverseNode(node, parent) {
    // We start by testing for the existence of a method on the visitor with a
    // matching `nodeType`.
    console.log(`\n${node.nodeType}`);
    const methods = visitor[node.nodeType];

    // If there is an `enter` method for this node type we'll call it with the
    // `node` and its `parent`.
    if (methods && methods.enter) {
      // logger.debug('\n\n\n\n************************************************');
      // logger.debug(`${node.nodeType} before enter`);
      // logger.debug('node._context:', node._context);
      // if (parent) logger.debug('parent._context:', parent._context);
      // logger.debug('state:', state);

      methods.enter(node, parent, state);

      // logger.debug(`\n\n\n\n${node.nodeType} after enter`);
      // logger.debug('node._context:', node._context);
      // if (parent) logger.debug('parent._context:', parent._context);
      // logger.debug('state:', state);
      // logger.debug('*************************************************');
    }

    // Next we are going to split things up by the current nodeType.
    switch (node.nodeType) {
      // We'll start with our top level `SourceUnit`. Since SourceUnit nodes have a property named `nodes` that has an array of nodes, we will call `traverseArray` to traverse down into them.
      // (Remember that `traverseArray` will in turn call `traverseNode` so we are causing the tree to be traversed recursively)
      case 'SourceUnit':
        traverseArray(node.nodes, node);
        break;

      case 'ContractDefinition':
        traverseArray(node.nodes, node);
        break;

      // A FunctionDefinition contains several subtrees: parameters, returnParameters, and body (the body of the function). We explore them in that order, because this aligns with the `id` ordering of the AST.
      case 'FunctionDefinition':
        traverseNode(node.parameters, node);
        traverseNode(node.returnParameters, node);
        traverseNode(node.body, node);
        break;

      // A ParameterList - top level when traversing `parameters` or `returnParameters` of a FunctionDefinition
      case 'ParameterList':
        traverseArray(node.parameters, node);
        break;

      // A Block - top level when traversing the `body` of a FunctionDefinition
      case 'Block':
        traverseArray(node.statements, node);
        break;

      // A VariableDeclarationStatement - a type of statement within a function body
      case 'VariableDeclarationStatement':
        traverseArray(node.declarations, node);
        traverseNode(node.initialValue, node);
        break;

      // An ExpressionStatement - a type of statement within a function body
      case 'ExpressionStatement':
        traverseNode(node.expression, node);
        break;

      // An Assignment
      case 'Assignment':
        traverseNode(node.leftHandSide, node);
        traverseNode(node.rightHandSide, node);
        break;

      // A BinaryOperation
      case 'BinaryOperation':
        traverseNode(node.leftExpression, node);
        traverseNode(node.rightExpression, node);
        break;

      // A VariableDeclaration doesn't _contain_ an array of nodes, but its 'typeName' (e.g. uint256) is a node in itself
      case 'VariableDeclaration':
        traverseNode(node.typeName, node);
        break;

      // In the cases of the below nodeTypes, we don't have any
      // child nodes to visit, so we'll just break.
      case 'PragmaDirective':
      case 'ElementaryTypeName':
      case 'Identifier':
      case 'Literal':
        break;

      // And again, if we haven't recognized the nodeType then we'll throw an
      // error.
      default:
        throw new TypeError(node.nodeType);
    }

    // If there is an `exit` method for this node type we'll call it with the
    // `node` and its `parent`.
    if (methods && methods.exit) {
      // logger.debug('\n\n\n\n*************************************************');
      // logger.debug(`${node.nodeType} before exit`);
      // logger.debug('node._context:', node._context);
      // if (parent) logger.debug('parent._context:', parent._context);
      // logger.debug('state:', state);
      // logger.debug('*************************************************');

      methods.exit(node, parent, state);

      // logger.debug(`\n\n\n\n${node.nodeType} after exit`);
      // logger.debug('node._context:', node._context);
      // if (parent) logger.debug('parent._context:', parent._context);
      // logger.debug('state:', state);
      // logger.debug('*************************************************');
    }
  }

  // Finally we kickstart the traverser by calling `traverseNode` with our ast
  // with no `parent` because the top level of the AST doesn't have a parent.
  traverseNode(ast, parent);
}

export default traverse;
