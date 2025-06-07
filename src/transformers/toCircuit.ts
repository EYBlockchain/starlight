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
    let state = {
    stopTraversal: false,
    skipSubNodes: false,
    internalFunctions: new Map(),
    wrapperFunctions: new Map(),
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
  let circuitFileData = codeGenerator(newAST, state);

  if (state.internalFunctions && state.internalFunctions instanceof Map) {
    circuitFileData = circuitFileData.map(fileObj => {
        for (let func of state.internalFunctions.keys()) {
            if (fileObj.filepath.includes(func)) {
                if (!fileObj.filepath.startsWith('circuits/common/')) {
                  return {
                  ...fileObj,
                  filepath: fileObj.filepath.replace(/\.zok$/, '_internal.zok')
                  };
                }
                return fileObj;
            }
        }
        return fileObj;
    });
  }

  if (state.wrapperFunctions && state.wrapperFunctions instanceof Map) {
    for (let [key, value] of state.wrapperFunctions.entries()) {
      circuitFileData.push({
        filepath: `circuits/${key}.zok`,
        file: value,
      });
    }
  }

  // save the circuit files to the output dir:
  logger.verbose(
    `Saving .zok files to the zApp output directory ${options.circuitsDirPath}...`,
  );

  for (let fileObj of circuitFileData) {
    let filepath = pathjs.join(options.outputDirPath, fileObj.filepath);
    const dir = pathjs.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    fs.writeFileSync(filepath, fileObj.file);
  }
  logger.info('Circuit transpilation complete.');

  return newAST;
 }
