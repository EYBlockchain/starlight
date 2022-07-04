/* eslint-disable no-param-reassign */

import fs from 'fs';
import pathjs from 'path';
import NodePath from '../traverse/NodePath.js';
import logger from '../utils/logger.js';
import { traversePathsFast } from '../traverse/traverse.js';
import explode from './visitors/explode.js';
import visitor from './visitors/toCircuitVisitor.js';
import codeGenerator from '../codeGenerators/circuit/zokrates/toCircuit.js';

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

function transformation1(oldAST: any) {
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
    parentPath: null,
    parent: dummyParent,
    key: 'ast', // since parent.ast = node
    container: oldAST,
    index: null,
    node: oldAST,
  }); // This won't actually get initialised with the info we're providing if the `node` already exists in the NodePath cache. That's ok, as long as all transformers use the same dummyParent layout.

  // Delete (reset) the `._newASTPointer` subobject of each node (which collectively represent the new AST). It's important to do this if we want to start transforming to a new AST.
  traversePathsFast(path, (p: typeof path) => delete p.node._newASTPointer);

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
export default function toCircuit(ast: any, options: any) {
  // transpile to a circuit AST:
  logger.verbose('Transforming the .zol AST to a contract AST...');
  const newAST = transformation1(ast);
  const newASTFilePath = pathjs.join(
    options.circuitsDirPath,
    `${options.inputFileName}_ast.json`,
  );

  fs.writeFileSync(newASTFilePath, JSON.stringify(newAST, null, 4));

 //generate the circuit files from the newly created circuit AST:
  logger.verbose('Generating files from the .zok AST...');
  const circuitFileData = codeGenerator(newAST);

  // save the circuit files to the output dir:
  logger.verbose(
    `Saving .zok files to the zApp output directory ${options.circuitsDirPath}...`,
  );
  for (const fileObj of circuitFileData) {
    let filepath = pathjs.join(options.outputDirPath, fileObj.filepath);
    if(fileObj.file.includes('0_oldCommitment_nullifier') && fileObj.file.includes('1_oldCommitment_nullifier')){
      if(fileObj.file.includes('stateVarId_field')){
        const newfile = fs.readFileSync('circuits/common/joinMappingCommitments.zok', 'utf8');
        const newfilepath = pathjs.join(options.outputDirPath, 'circuits/joinMappingCommitments.zok');
        fs.writeFileSync(newfilepath, newfile);
      } if(!fileObj.file.includes('stateVarId_field') && fileObj.file.includes('stateVarId')){
        const newfile = fs.readFileSync('circuits/common/joinCommitments.zok', 'utf8');
        const newfilepath = pathjs.join(options.outputDirPath, 'circuits/joinCommitments.zok');
        fs.writeFileSync(newfilepath, newfile);
      }

    }
    const dir = pathjs.dirname(filepath);
    logger.debug(`About to save to ${filepath}...`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    fs.writeFileSync(filepath, fileObj.file);
  }
  logger.info('Circuit transpilation complete.');

  return newAST;
 }
