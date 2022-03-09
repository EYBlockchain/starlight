import sha256 from 'crypto-js/sha256.js';
import logger from './utils/logger.js';
import fs from "fs";
import changesets from 'json-diff-ts';
import path from 'path';
import fse  from 'fs-extra';

export function checkASThashes(options: any, ASTType: string) {

try {
  let outputAST = fs.readFileSync('./zapps/'+options.inputFileName+'/'+ASTType+'/'+options.inputFileName+'_ast.json', 'utf8')
  let outputASTJsonObject = JSON.parse(outputAST);
  let outputASTHash = sha256(outputAST);
  if (fs.existsSync('./truezapps/'+options.inputFileName+'/'+ASTType+'/'+options.inputFileName+'_ast.json')) 
  {
  let PreGeneratedAST = fs.readFileSync('./truezapps/'+options.inputFileName+'/'+ASTType+'/'+options.inputFileName+'_ast.json', 'utf8')
  let PreGeneratedASTJsonObject = JSON.parse(PreGeneratedAST);
  let PreGeneratedASTHash = sha256(PreGeneratedAST);
  if(PreGeneratedASTHash.toString() !== outputASTHash.toString())
  {
    PreGeneratedASTHash = sha256(JSON.stringify(PreGeneratedASTJsonObject));
    outputASTHash = sha256(JSON.stringify(outputASTJsonObject));
    if(PreGeneratedASTHash.toString() !== outputASTHash.toString())
    {
      const VariyingData= changesets.diff(PreGeneratedASTJsonObject, outputASTJsonObject);
      if(options.modifyAST == 'y')
      changesets.applyChangeset(PreGeneratedASTJsonObject, VariyingData);
      return 'false';    
    }
    else
      return 'false';
  }
  else
    return 'true';
} 
else                             
  fse.copySync(`./zapps/`+options.inputFileName, `./truezapps/`+options.inputFileName);
  return 'true';
}
catch (err) {
  console.error(err)
} 
}


export function checktestASTExists(options: any, ASTType: string) {
  if (!fs.existsSync('./truezapps/'+options.inputFileName+'/'+ASTType+'/'+options.inputFileName+'_ast.json'))
  fse.copySync(`./zapps/`+options.inputFileName, `./truezapps/`+options.inputFileName);
  return true;
}

export function getHashOfASTString(options: any, ASTType: string) {
  let outputAST = fs.readFileSync('./zapps/'+options.inputFileName+'/'+ASTType+'/'+options.inputFileName+'_ast.json', 'utf8')
  let outputASTHash = sha256(outputAST);
  return outputASTHash.toString;
}

export function checkCodeGen(options: any, codeType: string) {
let outputAST = fs.readFileSync('./zapps/'+options.inputFileName+'/'+codeType+'/'+options.inputFileName+'_ast.json', 'utf8')
let outputASTJsonObject = JSON.parse(outputAST);
let codeGenFunctionsCount = 0;
let filesinAST = JSON.parse(JSON.stringify(outputASTJsonObject.files));
for (var j = 0; j < filesinAST.length; j++) {
    if (filesinAST[j].nodeType == 'File') {
      codeGenFunctionsCount++;
    }
}
return codeGenFunctionsCount;
}