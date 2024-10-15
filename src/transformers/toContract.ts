/* eslint-disable no-param-reassign */

import fs from 'fs';
import pathjs from 'path';
import logger from '../utils/logger.js';
import visitor from './visitors/toContractVisitor.js';
import codeGenerator from '../codeGenerators/contract/solidity/toContract.js';
import { transformation1 } from './visitors/common.js';

// A transformer function which will accept an ast.
export default function toContract(ast: object, options: any) {
  // transpile to a contract AST:
    const state = {
    stopTraversal: false,
    skipSubNodes: false,
    circuitAST:options.circuitAST
  };
  
  logger.debug('Transforming the .zol AST to a solidity AST...');
  const newAST = transformation1('contract', ast, state, visitor);
  // logger.debug('new solidity ast:', newAST);
  const newASTFilePath = pathjs.join(options.contractsDirPath, `${options.inputFileName}_ast.json`);
  fs.writeFileSync(newASTFilePath, JSON.stringify(newAST, null, 4));

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
  logger.info('Contract transpilation complete kahina.');
}
