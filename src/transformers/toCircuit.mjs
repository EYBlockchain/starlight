/* eslint-disable no-param-reassign */

import fs from 'fs';
import pathjs from 'path';
import NodePath from '../traverse/NodePath.mjs';
import logger from '../utils/logger.mjs';
import { traversePathsFast } from '../traverse/traverse.mjs';
import explode from './visitors/explode.mjs';
import visitor from './visitors/toCircuitVisitor.mjs';
import codeGenerator from '../codeGenerators/circuit/zokrates/toCircuit.mjs';

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

function transformation1(oldAST) {
  const newAST = {
    nodeType: 'Folder',
    files: [],
  };

  const state = {
    stopTraversal: false,
    skipSubnodes: false,
  };

  const dummyParent = {
    ast: oldAST,
  };

  const path = new NodePath({
    parent: dummyParent,
    key: 'ast', // since parent.ast = node
    container: oldAST,
    node: oldAST,
  }); // This won't actually get initialised with the info we're providing if the `node` already exists in the NodePath cache. That's ok, as long as all transformers use the same dummyParent layout.

  // Delete (reset) the `._newASTPointer` subobject of each node (which collectively represent the new AST). It's important to do this if we want to start transforming to a new AST.
  traversePathsFast(path, p => delete p.node._newASTPointer);

  path.parent._newASTPointer = newAST;
  path.node._newASTPointer = newAST.files;

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  path.traverse(explode(visitor), state);

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return newAST;
}

// A transformer function which will accept an ast.
export default function toCircuit(ast, options) {
  // transpile to a circuit AST:
  logger.verbose('Transforming the .zsol AST to a contract AST...');
  const newAST = transformation1(ast);
  const newASTFilePath = pathjs.join(options.circuitsDirPath, `${options.inputFileName}_ast.json`);
  console.log('\n\n\nNEWAST:')
  console.dir(newAST, { depth: 10 });
  fs.writeFileSync(newASTFilePath, JSON.stringify(newAST, null, 4));

  // generate the circuit files from the newly created circuit AST:
  logger.verbose('Generating files from the .zok AST...');
  const circuitFileData = codeGenerator(newAST);

  // save the circuit files to the output dir:
  logger.verbose(`Saving .zok files to the zApp output directory ${options.circuitsDirPath}...`);
  for (const fileObj of circuitFileData) {
    const filepath = pathjs.join(options.outputDirPath, fileObj.filepath);
    const dir = pathjs.dirname(filepath);
    logger.debug(`About to save to ${filepath}...`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    fs.writeFileSync(filepath, fileObj.file);
  }
  logger.info('Circuit transpilation complete.');
}
