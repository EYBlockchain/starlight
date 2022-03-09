import sha256 from 'crypto-js/sha256.js';
import logger from './utils/logger.js';
import fs from "fs";
import changesets from 'json-diff-ts';
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
      {
      changesets.applyChangeset(PreGeneratedASTJsonObject, VariyingData);
      fs.writeFileSync('./truezapps/'+options.inputFileName+'/'+ASTType+'/'+options.inputFileName+'_ast.json', JSON.stringify(PreGeneratedASTJsonObject, null, 4), 'utf8');
      logger.info('AST file modified');
      }
      return 'false';    
    }
    else
      return 'true';
  }
  else
    return 'true';
} 
else
  return 'false';
}
catch (err) {
  console.error(err)
} 
}


export function checktestASTExists(options: any, ASTType: string) {
  if (!fs.existsSync('./truezapps/'+options.inputFileName+'/'+ASTType+'/'+options.inputFileName+'_ast.json'))
  {
    fs.mkdirSync('./truezapps/'+options.inputFileName);
    fse.copySync(`./zapps/`+options.inputFileName+'/circuits', `./truezapps/`+options.inputFileName+'/circuits');
    fse.copySync(`./zapps/`+options.inputFileName+'/contracts', `./truezapps/`+options.inputFileName+'/contracts');
    fse.copySync(`./zapps/`+options.inputFileName+'/orchestration', `./truezapps/`+options.inputFileName+'/orchestration');
    return false;
  }
  else
  return true;
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