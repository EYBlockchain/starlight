/* eslint-disable no-param-reassign */

import fs from 'fs';
import pathjs from 'path';
import NodePath from '../traverse/NodePath.mjs';
import logger from '../utils/logger.mjs';
import { traverseNodesFast, traversePathsFast } from '../traverse/traverse.mjs';
import { pathCache } from '../traverse/cache.mjs';
import explode from './visitors/explode.mjs';
import visitor from './visitors/toContractVisitor.mjs';
import codeGenerator from '../codeGenerators/contract/solidity/toContract.mjs';

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
    skipSubNodes: false,
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

  path.parent._newASTPointer = newAST.files;

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  path.traverse(explode(visitor), state);

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return newAST;
}

// A transformer function which will accept an ast.
export default function toContract(ast, options) {
  // transpile to a contract AST:
  logger.debug('Transforming the .zol AST to a solidity AST...');
  const newAST = transformation1(ast);
  // logger.debug('new solidity ast:', newAST);
  const newASTFilePath = pathjs.join(options.contractsDirPath, `${options.inputFileName}_ast.json`);
  fs.writeFileSync(newASTFilePath, JSON.stringify(newAST, null, 4));

  console.log('\n\n\nNEW AST:')
  console.dir(newAST, { depth: 14 })

  // generate the contract files from the newly created contract AST:
  logger.verbose('Generating files from the .sol AST...');
  const contractFileData = codeGenerator(newAST);

  // logger.debug('contract file data:', contractFileData)

  // save the contract files to the output dir:
  logger.verbose(`Saving .sol files to the zApp output directory ${options.contractsDirPath}...`);
  for (const fileObj of contractFileData) {
    const filepath = pathjs.join(options.outputDirPath, fileObj.filepath);
    const dir = pathjs.dirname(filepath);
    logger.debug(`About to save to ${filepath}...`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    fs.writeFileSync(filepath, fileObj.file);
  }
  logger.info('Contract transpilation complete.');
}
