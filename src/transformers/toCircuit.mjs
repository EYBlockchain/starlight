/* eslint-disable no-param-reassign */

import fs from 'fs';
import path from 'path';
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
  // transpile to a circuit AST:
  logger.info('Transforming the .zsol AST to a .zok AST...');
  const newAST = transformation1(ast);
  const newASTFilePath = path.join(options.circuitsDirPath, `${options.inputFileName}_ast.json`);
  fs.writeFileSync(newASTFilePath, JSON.stringify(newAST, null, 4));

  // generate the circuit files from the newly created circuit AST:
  logger.info('Generating files from the .zok AST...');
  const circuitFileData = codeGenerator(newAST);

  // save the circuit files to the output dir:
  logger.info(`Saving .zok files to the zApp output directory ${options.circuitsDirPath}...`);
  for (const fileObj of circuitFileData) {
    const filepath = path.join(options.circuitsDirPath, fileObj.filepath);
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    fs.writeFileSync(filepath, fileObj.file);
  }
  logger.info('Circuit transpilation complete.');
}
