/* eslint-disable no-param-reassign */

import yargs from 'yargs';
// import fs from 'fs';
import logger from '../utils/logger.mjs';
import { readJsonFile } from '../utils/filing.mjs';
import traverse from '../traverse/traverse.mjs';
import explode from './visitors/explode.mjs';
import exampleVisitor from './visitors/exampleVisitor.mjs';

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
    nodeType: 'SourceUnit',
    nodes: [], // so-called to match the original ast.
  };

  // Next I'm going to cheat a little and create a bit of a hack. We're going to
  // use a property named `context` on our parent nodes that we're going to push
  // nodes to their parent's `context`. Normally you would have a better
  // abstraction than this, but for our purposes this keeps things simple.
  //
  // Just take note that the context is a reference *from* the old ast *to* the
  // new ast.
  oldAST._newASTPointer = newAST.nodes;
  const dummyParent = {};
  dummyParent._newASTPointer = newAST;

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  traverse(oldAST, dummyParent, explode(exampleVisitor));

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
