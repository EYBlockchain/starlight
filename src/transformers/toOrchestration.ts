/* eslint-disable no-param-reassign, no-continue */

import fs from 'fs';
import pathjs from 'path';
import prettier from 'prettier';
import logger from '../utils/logger.js';
import { traversePathsFast } from '../traverse/traverse.js';
import explode from './visitors/explode.js';
import visitor from './visitors/toOrchestrationVisitor.js';
import codeGenerator from '../codeGenerators/orchestration/nodejs/toOrchestration.js';
import OrchestrationBP from '../boilerplate/orchestration/javascript/raw/boilerplate-generator.js';

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */
const Orchestrationbp = new OrchestrationBP();
function transformation1(oldAST: any) {
  // We'll create a `newAst`
  const newAST = {
    nodeType: 'Folder',
    files: [],
  };

  const state = {
    stopTraversal: false,
    skipSubNodes: false,
    snarkVerificationRequired: true,
    newCommitmentsRequired: true,
    nullifiersRequired: true,
  };

  const path = oldAST;

  // Delete (reset) the `._newASTPointer` subobject of each node (which collectively represent the new AST). It's important to do this if we want to start transforming to a new AST.
  traversePathsFast(path, (p: any) => delete p.node._newASTPointer);

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
export default function toOrchestration(ast: any, options: any) {
  // transpile to a node AST:
  logger.debug('Transforming the .zol AST to a .mjs AST...');
  const newAST = transformation1(ast);
  const newASTFilePath = pathjs.join(
    options.orchestrationDirPath,
    `${options.inputFileName}_ast.json`,
  );
  fs.writeFileSync(newASTFilePath, JSON.stringify(newAST, null, 4));

  // generate the new node files from the newly created orchestration AST:
  logger.verbose('Generating files from the .mjs AST...');
  const nodeFileData = codeGenerator(newAST);

  // save the new node files to the output dir:
  logger.verbose(
    `Saving .mjs files to the zApp output directory ${options.orchestrationDirPath}...`,
  );
  for (const fileObj of nodeFileData) {
    const filepath = pathjs.join(options.outputDirPath, fileObj.filepath);
    const dir = pathjs.dirname(filepath);
    logger.debug(`About to save to ${filepath}...`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    if (fileObj.filepath.includes('preimage.json')) continue;
    const prettyFile = fileObj.filepath.includes('.') ? prettier.format(fileObj.file, {
      useTabs: true,
      parser: 'babel',
    }) : fileObj.file;
    fs.writeFileSync(filepath, prettyFile);
  }

  // extract contractName
  const contractNode = ast.node.nodes.filter(
    (n: any) => n.nodeType === `ContractDefinition`,
  )[0];
  const contractName = `${
    contractNode.name.charAt(0).toUpperCase() + contractNode.name.slice(1)
  }Shield`;

  // copy over existing backend files to the output dir:
  logger.verbose(
    `Saving backend files to the zApp output directory ${options.outputDirPath}...`,
  );
  // TODO merge this process with above
  const zappFilesBP = Orchestrationbp.zappFilesBoilerplate();
  if (!(zappFilesBP instanceof Array)) throw new Error('Boilerplate files not read correctly!');
  let fileObj: any;
  // we go through the below process in the codeGenerator for other files
  for (fileObj of zappFilesBP) {
    let file = fs.readFileSync(fileObj.readPath, 'utf8');
    const filepath = pathjs.join(options.outputDirPath, fileObj.writePath);
    if (!fileObj.generic) {
      file = file.replace(/CONTRACT_NAME/g, contractName);
      file = file.replace(/FUNCTION_NAME/g, options.zappName);
    }
    const dir = pathjs.dirname(filepath);
    logger.debug(`About to save to ${filepath}...`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    fs.writeFileSync(filepath, file);
  }

  logger.info('Node transpilation complete.');
}
