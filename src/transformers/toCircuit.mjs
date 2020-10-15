/* eslint-disable no-param-reassign */

import yargs from 'yargs';
// import fs from 'fs';
import logger from '../utils/logger.mjs';
import { readJsonFile } from '../utils/filing.mjs';
import traverse from '../traverse/traverse.mjs';
import explode from './visitors/explode.mjs';
import toCircuitVisitor from './visitors/toCircuitVisitor.mjs';

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

const { argv } = yargs.usage('Usage: $0 -i <input file>').demandOption(['i']);
const ast = readJsonFile(argv.i);

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
  traverse(oldAST, dummyParent, explode(toCircuitVisitor), state);

  logger.debug('NEW AST:', newAST);

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return newAST;
}

// A transformer function which will accept an ast.
function transformer() {
  logger.debug('ast', ast);

  const newAST = transformation1(ast);
  return newAST;
}

transformer();
