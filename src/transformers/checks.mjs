/* eslint-disable no-param-reassign */

import fs from 'fs';
import pathjs from 'path';
import NodePath from '../traverse/NodePath.mjs';
import logger from '../utils/logger.mjs';
import { traverse } from '../traverse/traverse.mjs';
import explode from './visitors/explode.mjs';
import unsupportedVisitor from './visitors/miranda-new/unsupportedVisitor.mjs';
import externalCallVisitor from './visitors/miranda-new/externalCallVisitor.mjs';
import decoratorVisitor from './visitors/miranda-new/decoratorVisitor.mjs';
import incrementedVisitor from './visitors/miranda-new/incrementedVisitor.mjs';
import referencedVisitor from './visitors/miranda-new/referencedVisitor.mjs';
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

  const scope = {};

  oldAST._context = newAST.files;
  const dummyParent = {
    id: 0,
    ast: oldAST,
  };
  dummyParent._context = newAST;

  const path = new NodePath({
    parent: dummyParent,
    key: 'ast', // since parent.ast = node
    container: oldAST,
    node: oldAST,
  });

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  // TODO - think about starting with a blank scope or using the prev one. Using the prev one could mean more efficient, but currently adds duplicates.
  path.traverse(explode(unsupportedVisitor), state, scope);
  logger.info('No unsupported Solidity');
  path.traverse(explode(externalCallVisitor), state, scope);
  logger.info('No unsupported external calls');
  path.traverse(explode(decoratorVisitor), state, scope);
  logger.info('No conflicting known/unknown decorators');
  path.traverse(explode(incrementedVisitor), state, scope);
  logger.info('Incrementations marked');
  // path.traverse(explode(referencedVisitor), state, scope);
  // logger.info('References marked');

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return newAST;
}

// A transformer function which will accept an ast.
export default function checks(ast, options) {
  logger.info('Performing checks on the zsol AST...');
  const newAST = transformation1(ast);
  const newASTFilePath = pathjs.join(options.circuitsDirPath, `${options.inputFileName}_ast.json`);
  fs.writeFileSync(newASTFilePath, JSON.stringify(newAST, null, 4));

  // generate the circuit files from the newly created circuit AST:
  // logger.info('Generating files from the .zok AST...');
  // const circuitFileData = codeGenerator(newAST);
  //
  // // save the circuit files to the output dir:
  // logger.info(`Saving .zok files to the zApp output directory ${options.circuitsDirPath}...`);
  // for (const fileObj of circuitFileData) {
  //   const filepath = pathjs.join(options.outputDirPath, fileObj.filepath);
  //   const dir = pathjs.dirname(filepath);
  //   console.log(`About to save to ${filepath}...`)
  //   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
  //   fs.writeFileSync(filepath, fileObj.file);
  // }
  logger.info('Circuit transpilation complete.');
}
