/* eslint-disable no-param-reassign */

import logger from '../utils/logger.mjs';
import { readJsonFile } from '../utils/filing.mjs';
import traverse from './traverser.mjs';
import commitmentVisitor from './visitors/circuit/commitmentVisitor.mjs';

/**
 * Edited from the Super Tiny compiler (updating for our use case):
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

/**
 * ============================================================================
 *                                   ⁽(◍˃̵͈̑ᴗ˂̵͈̑)⁽
 *                              THE TRANSFORMER!!!
 * ============================================================================
 */

/**
 * Next up, the transformer. Our transformer is going to take the AST that we
 * have built and pass it to our traverser function with a visitor and will
 * create a new ast.
 *
 * ----------------------------------------------------------------------------
 *   Original AST                     |   Transformed AST
 * ----------------------------------------------------------------------------
 *   {                                |   {
 *     type: 'Program',               |     type: 'Program',
 *     body: [{                       |     body: [{
 *       type: 'CallExpression',      |       type: 'ExpressionStatement',
 *       name: 'add',                 |       expression: {
 *       params: [{                   |         type: 'CallExpression',
 *         type: 'NumberLiteral',     |         callee: {
 *         value: '2'                 |           type: 'Identifier',
 *       }, {                         |           name: 'add'
 *         type: 'CallExpression',    |         },
 *         name: 'subtract',          |         arguments: [{
 *         params: [{                 |           type: 'NumberLiteral',
 *           type: 'NumberLiteral',   |           value: '2'
 *           value: '4'               |         }, {
 *         }, {                       |           type: 'CallExpression',
 *           type: 'NumberLiteral',   |           callee: {
 *           value: '2'               |             type: 'Identifier',
 *         }]                         |             name: 'subtract'
 *       }]                           |           },
 *     }]                             |           arguments: [{
 *   }                                |             type: 'NumberLiteral',
 *                                    |             value: '4'
 * ---------------------------------- |           }, {
 *                                    |             type: 'NumberLiteral',
 *                                    |             value: '2'
 *                                    |           }]
 *  (sorry the other one is longer.)  |         }
 *                                    |       }
 *                                    |     }]
 *                                    |   }
 * ----------------------------------------------------------------------------
 */

// function getStateVariables(ast) {
//   const contractDefinition = ast.nodes.filter(node => node.nodeType === 'ContractDefinition');
//   const stateVariables = contractDefinition.nodes.filter(node => {
//     node.nodeType === ''
//   )
// }

// So we have our transformer function which will accept the old ast.
function transformer() {
  const ast = readJsonFile('./sprinkled_ast.json');
  logger.debug('ast', ast);

  // We'll create a `newAst` which like our previous AST will have a SourceUnit
  // node (although that's just Solidity, so we might want a different root type for the circuit/orchestrator/smart-contract 'newAST's)
  const newAST = {
    type: 'SourceUnit',
    body: [],
  };

  // Next I'm going to cheat a little and create a bit of a hack. We're going to
  // use a property named `context` on our parent nodes that we're going to push
  // nodes to their parent's `context`. Normally you would have a better
  // abstraction than this, but for our purposes this keeps things simple.
  //
  // Just take note that the context is a reference *from* the old ast *to* the
  // new ast.
  // ast._context = newAst.body;

  // We'll start by calling the traverser function with our ast and a visitor.
  traverse(ast, null, commitmentVisitor, newAST.body);

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return newAST;
}

export default transformer;
