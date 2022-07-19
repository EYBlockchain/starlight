/* eslint-disable no-param-reassign */

import fs from 'fs';
import pathjs from 'path';
import logger from '../utils/logger.js';
import visitor from './visitors/toCircuitVisitor.js';
import codeGenerator from '../codeGenerators/circuit/zokrates/toCircuit.js';
import { transformation1 } from './visitors/common.js';

// A transformer function which will accept an ast.
export default function toCircuit(ast: any, options: any) {
  // transpile to a circuit AST:
    const state = {
    stopTraversal: false,
    skipSubNodes: false,
  };
  logger.verbose('Transforming the .zol AST to a contract AST...');
  const newAST = transformation1('circuit' ,ast , state , visitor);
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
        const newfile = fs.readFileSync('circuits/common/joinCommitments.zok', 'utf8');
        const newfilepath = pathjs.join(options.outputDirPath, 'circuits/joinCommitments.zok');
        fs.writeFileSync(newfilepath, newfile);
    }
    const dir = pathjs.dirname(filepath);
    logger.debug(`About to save to ${filepath}...`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    fs.writeFileSync(filepath, fileObj.file);
  }
  logger.info('Circuit transpilation complete.');

  return newAST;
 }
