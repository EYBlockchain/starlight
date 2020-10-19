/* eslint-disable no-param-reassign */

import fs from 'fs';
import logger from '../utils/logger.mjs';
import traverse from '../traverse/traverse.mjs';
import explode from './visitors/explode.mjs';
import visitor from './visitors/toCircuitVisitor.mjs';
import codeGenerator from '../codeGenerators/toCircuit.mjs';

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

function transformation1(oldAST) {
  // We'll create a `newAst` which like our previous AST will have a SourceUnit
  // node at the top.
  const newAST = {
    nodeType: 'Folder',
    files: [],
  };

  const state = {
    scope: {},
    stopTraversal: false,
  };

  oldAST._context = newAST.files;
  const dummyParent = {};
  dummyParent._context = newAST;

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  traverse(oldAST, dummyParent, explode(visitor), state);

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return newAST;
}

// A transformer function which will accept an ast.
export default function toCircuit(ast, options) {
  // logger.debug('ast', ast);

  const newAST = transformation1(ast);
  const newASTFilePath = `${options.circuitsDirPath}/${options.inputFileName}_ast.json`;
  fs.writeFileSync(newASTFilePath, JSON.stringify(newAST, null, 4));

  const circuitCode = codeGenerator(newAST);
  console.log('Circuit code:');
  console.log(circuitCode); // don't use the logger, because it outputs escape characters
  const circuitCodeFilePath = `${options.circuitsDirPath}/${options.inputFileName}.zok`;
  fs.writeFileSync(circuitCodeFilePath, circuitCode);
}
