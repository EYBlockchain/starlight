/* eslint-disable no-param-reassign */

import fs from 'fs';
import pathjs from 'path';
import logger from '../utils/logger.js';
import visitor from './visitors/toCircuitVisitor.js';
import codeGenerator from '../codeGenerators/circuit/zokrates/toCircuit.js';
import { transformation1 } from './visitors/common.js';

function poseidonLibraryChooser(fileObj:any ) {
 let  poseidonFieldCount = 0;
  var lines = fileObj.file.split('\n');
  for(var line = 0; line < lines.length; line++) {
    if(lines[line].includes('poseidon(')) {
    poseidonFieldCount = 0;
    for(var i = line+1; i<lines.length ; i++) {
    if(lines[i].includes(',')) {
    poseidonFieldCount++;
      }
    else
    break;
        }
      }
      if(poseidonFieldCount >4)
      break;
    }
    if(poseidonFieldCount <5) {
    var lines = fileObj.file.split('\n');
    for(var line = 0; line < lines.length; line++) {
      if(lines[line].includes('./common/hashes/poseidon/poseidon.zok')) {
        lines[line] = 'from "hashes/poseidon/poseidon.zok" import main as poseidon';
      }
    }
    fileObj.file = lines.join('\n');
  }
  return fileObj;
}

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
  for (let fileObj of circuitFileData) {
    let filepath = pathjs.join(options.outputDirPath, fileObj.filepath);
    const dir = pathjs.dirname(filepath);
    if(!filepath.includes('circuits/common/')) {
    fileObj = poseidonLibraryChooser(fileObj);
  }
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // required to create the nested folders for common import files.
    fs.writeFileSync(filepath, fileObj.file);
  }
  logger.info('Circuit transpilation complete.');

  return newAST;
 }
