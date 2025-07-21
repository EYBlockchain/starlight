/* eslint-disable import/no-cycle, no-nested-ternary */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { collectImportFiles } from '../../common.js'
import CircuitBP from '../../../boilerplate/circuit/zokrates/raw/BoilerplateGenerator.js';
import NodePath from '../../../traverse/NodePath.js'
import {traversePathsFast} from '../../../traverse/traverse.js'
const Circuitbp = new CircuitBP();

const removeTrailingSemicolon = (code: string) => {
  return code.endsWith(';') ? code.slice(0, -1) : code;
};

const keepOneTrailingSemicolon = (code: string) => {
  return code.endsWith('}') ? code : code.replace(/;+$/, '') + ';';
};

function poseidonLibraryChooser(fileObj: string) {
  if (!fileObj.includes('poseidon')) return fileObj;
  let poseidonFieldCount = 0;
   var lines = fileObj.split('\n');
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
     if(poseidonFieldCount >4) break;
   }
     if(poseidonFieldCount <5) {
     var lines = fileObj.split('\n');
     for(var line = 0; line < lines.length; line++) {
       if(lines[line].includes('./common/hashes/poseidon/poseidon.zok')) {
         lines[line] = 'from "hashes/poseidon/poseidon.zok" import main as poseidon;';
       }
     }
     fileObj = lines.join('\n');
   }
   return fileObj;
 }
 

function codeGenerator(node: any, codeGeneratorState: any) {
  switch (node.nodeType) {
    case 'Folder':
      return CircuitBP.uniqueify(node.files.flatMap(e => codeGenerator(e, codeGeneratorState)));

    case 'File': {
      const filepath = path.join('./circuits', `${node.fileName}${node.fileExtension}`);
      const file = node.nodes.map(e => codeGenerator(e, codeGeneratorState)).join('\n\n');
      const thisFile = {
        filepath,
        file: poseidonLibraryChooser(file),
      };
      if (!file && node.fileName === `joinCommitments`) {
        thisFile.file = fs.readFileSync(path.resolve(fileURLToPath(import.meta.url), '../../../../../circuits/common/joinCommitments.zok'), 'utf8');
      }
      if (!file && node.fileName === `splitCommitments`) {
        thisFile.file = fs.readFileSync(path.resolve(fileURLToPath(import.meta.url), '../../../../../circuits/common/splitCommitments.zok'), 'utf8');
      }
      const importedFiles = collectImportFiles(thisFile.file, 'circuit');
      return [thisFile, ...importedFiles];
    }

    case 'ImportStatementList':
      return `${CircuitBP.uniqueify(node.imports.flatMap(codeGenerator)).join(';\n')};`;

    case 'FunctionDefinition': {
      let functionSignature : any;
      let returnType : any[] = [];
      let body = codeGenerator(node.body, codeGeneratorState);
      let returnStatement : string[] = [];
      let returnName : string[] = [];
      let nullifierRoot : string[] = [];
      if(node.returnParameters) {
        node.parameters.parameters.forEach(param => {
          if(param.bpType === 'newCommitment')
           returnName.push(param.name);      
        });

        node.returnParameters.parameters.forEach((node) => {
          if (node.typeName.name === 'bool')
          node.isPrivate? returnStatement.push(`${node.name}_newCommitment_commitment`): returnStatement.push(`${node.name}`);
          else if (node.typeName.name.includes('EncryptedMsgs') && node.isPartitioned)
            returnStatement.push( `${node.name}_0_cipherText`);
          else if (node.typeName.name.includes('EncryptedMsgs'))
            returnStatement.push( `${node.name}_cipherText`);
          else if (node.isPrivate === true){
              returnName.forEach( (name, index) => {
                if(name.includes(node.name))
                  returnStatement.push( `${returnName[index]}_newCommitment_commitment`);
              });
          }
      });
      }

      const functionName = node.parameters.functionName;
      const isInternalCall = node.isInternalFunctionCall;
      if (isInternalCall) {
        codeGeneratorState.internalFunctions.add(functionName);
      }

      const wrapperFunctionArguments = codeGenerator(node.parameters, codeGeneratorState);
      let innerFunctionArguments = wrapperFunctionArguments;
       // if function is in an internal function call, do not include public/private keywords
       if (isInternalCall) {
        innerFunctionArguments = innerFunctionArguments.replace(/public /g, '').replace(/private /g, '');
      }
      const functionArguments = isInternalCall ? innerFunctionArguments : wrapperFunctionArguments;
      const fnName = isInternalCall ? functionName : "main";
      functionSignature = `def main(\\\n\t${functionArguments}\\\n) -> `;
      node.returnParameters.parameters.forEach((node) => {
        if((node.isPrivate === true && node.typeName.name != 'bool') || node.typeName.name.includes('EncryptedMsgs'))
          returnType.push(node.typeName.name);
        if( node.typeName.name === 'bool') node.isPrivate === true? returnType.push('field') : returnType.push('bool');
      });
 
      if(returnStatement.length === 0){
        returnStatement.push('true');
        returnType.push('bool') ;
      }

      let args = innerFunctionArguments.split(',').map(arg => arg.split(' ').pop()?.trim()).join(', ');

      if (isInternalCall) {

        // TODO what about type aliases?
        let structImports: string[] = [];
        wrapperFunctionArguments.split(',\\').forEach(arg => {
            let type = arg.trim().split(/\s+/)[1];
            if (type[0] === type[0].toUpperCase()) {
              if (type.endsWith('>')) {
                type = type.replace(/<\d+>$/, '');
              }
            const structImport = `from "./${functionName}_internal.zok" import ${type} as ${type};`;
            if (!structImports.includes(structImport)) {
              structImports.push(structImport);
            }
          
          }
        });
        returnType.forEach((type: string) => {
          if (type[0] === type[0].toUpperCase()) {
            if (type.endsWith('>')) {
              type = type.replace(/<\d+>$/, '');
            }
            const structImport = `from "./${functionName}_internal.zok" import ${type} as ${type};`;
            if (!structImports.includes(structImport)) {
              structImports.push(structImport);
            }
          }
        });
        const wrapperFunction = `${structImports.join('\n')}\nfrom "./${functionName}_internal.zok" import main as ${functionName}_internal;
        
def main(\\\n\t${wrapperFunctionArguments}\\\n) -> ${returnType.length > 1 ? `(${returnType})` : returnType} {
          ${returnType.length > 1 ? `(${returnType})` : returnType} res = ${functionName}_internal(${args});
          return res;
}`;
        
codeGeneratorState.wrapperFunctions.set(functionName, wrapperFunction);
      }

      
      return `${functionSignature}${returnType.length > 1 ? `(${returnType})` : returnType} {

      ${body}

         return ${returnStatement.length > 1 ? `(${returnStatement})` : returnStatement};
    }`;
    }

    case 'StructDefinition': {
      return `struct ${node.name} {
        ${node.members.map((mem: any) => mem.type + ' ' + mem.name + ';').join(`\n`)}
      }`;
    }

    case 'ParameterList': {
      let paramList = CircuitBP.uniqueify(node.parameters.flatMap(codeGenerator));
      // we also need to identify and remove duplicate params prefixed with conflicting 'public'/'private' keywords (prioritising 'public')
      const slicedParamList = paramList.map(p =>
        p.replace('public ', '').replace('private ', ''),
      );
      const linesToDelete: string[] = []; // we'll collect duplicate params here
      for (let i = 0; i < paramList.length; i++) {
        for (let j = i + 1; j < slicedParamList.length; j++) {
          if (slicedParamList[i] === slicedParamList[j]) {
            if (paramList[i].includes('private'))
              linesToDelete.push(paramList[i]);
            if (paramList[j].includes('private'))
              linesToDelete.push(paramList[j]);
          } else if (slicedParamList[i].replace('_oldCommitment_value', '') === slicedParamList[j]) {
            linesToDelete.push(paramList[j]);
          }
          if (`${slicedParamList[i]}_point` === slicedParamList[j].replace('[2]', '')) {
            // if we have public key in the form of a point, we can compress it inside the circuit - no need for two pub key inputs
            linesToDelete.push(paramList[i]);
          }
        }
      }
      for (let i = 0; i < linesToDelete.length; i++) {
        // remove duplicate params
        paramList.splice(paramList.indexOf(linesToDelete[i]), 1);
      }

      const uniqueParams = new Map<string, string>();

      paramList.forEach(param => {
        const paramName = param.split(' ').pop();
        if (paramName) {
          if (!uniqueParams.has(paramName) || param.includes('mut')) {
        uniqueParams.set(paramName, param);
          }
        }
      });

      paramList = Array.from(uniqueParams.values());

      return paramList.join(',\\\n\t');
    }

    case 'VariableDeclaration': {
      const visibility =
        node.declarationType === 'parameter'
          ? node.isPrivate
            ? 'private '
            : 'public '
          : '\t\t';
      return `${visibility}${codeGenerator(node.typeName, codeGeneratorState)} mut ${node.name}`;
    }

    case 'VariableDeclarationStatement': {
      const declarations = node.declarations.map(codeGenerator).join(', ');
      if (!node.initialValue) return `${declarations} = ${node.declarations.map(n => n.typeName.name === 'bool' ? 'false' : 0)};`;
      if(node.initialValue?.nodeType === 'InternalFunctionCall'){
        if(!declarations) return ;
        if(node.initialValue?.expression?.nodeType === 'BinaryOperation')
        return `${declarations} = ${codeGenerator(node.initialValue.expression, codeGeneratorState)};`;
        return `${declarations} = ${node.initialValue.name};`;
      } 
      const initialValue = codeGenerator(node.initialValue, codeGeneratorState);

      return `${declarations} = ${initialValue};`;
    }

    case 'ElementaryTypeName':
      return node.name;

    case 'Block': {
      const preStatements = CircuitBP.uniqueify(node.preStatements.flatMap(codeGenerator));
      // TO DO: We don't remove duplicate statements below because of duplicate statements in the contract. This could cause issues.
      const statements = node.statements.flatMap(codeGenerator);
      const postStatements = CircuitBP.uniqueify(node.postStatements.flatMap(codeGenerator));
      return [...preStatements, ...statements, ...postStatements].join('\n\n');
    }

    case 'ExpressionStatement': {
      if (node.isVarDec) {
        if (node.expression?.leftHandSide?.typeName === 'bool'){
          return `
          bool mut ${codeGenerator(node.expression, codeGeneratorState)}`;
        }
        return `
        field mut ${codeGenerator(node.expression, codeGeneratorState)}`;
      }
      return codeGenerator(node.expression, codeGeneratorState);
    }
    case 'InternalFunctionCall': {
     if(node.internalFunctionInteractsWithSecret) {
      let returnPara  = ' ';
      if(node.CircuitReturn.length){
       node.CircuitReturn.forEach((para) =>{
        if(para.typeName.name == 'EncryptedMsgs<3>')
         returnPara = `  EncryptedMsgs<3> ${para.name}_0_cipherText = `;
       })
       return `${returnPara} ${node.name}_internal(${(node.CircuitArguments).join(',\\\n \t')});`
      }
      else if(node.CircuitArguments.length)
       return `assert(${node.name}_internal(${(node.CircuitArguments).join(',\\\n \t')}));` ;
      else
       return `//`;
      }
    }
    case 'JoinCommitmentFunctionDefinition' :
    return `${CircuitBP.uniqueify(node.body.statements.flatMap(codeGenerator)).join('\n')}`;
    case 'SplitCommitmentFunctionDefinition' :
      return `${CircuitBP.uniqueify(node.body.statements.flatMap(codeGenerator)).join('\n')}`;
    case 'Return':
      return  ` ` ;

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide, codeGeneratorState)} ${node.operator} ${codeGenerator(node.rightHandSide, codeGeneratorState)};`;

    case 'UnaryOperation':
      if (node.subExpression?.typeName?.name === 'bool' && node.operator === '!'){
        return `${node.operator}${node.subExpression.name};`;
      }
      return `${codeGenerator(node.initialValue, codeGeneratorState)} = ${codeGenerator(node.subExpression, codeGeneratorState)} ${node.operator[0]} 1;`;

    case 'BinaryOperation':
      if (node.operator === '/') {
        let leftExpression: string;
        let rightExpression: string;
        if (node.leftExpression.nodeType === 'Literal') {
          leftExpression = `${codeGenerator(
            node.leftExpression,
            codeGeneratorState,
          )}u64`;
        } else {
          leftExpression = `field_to_u64(${codeGenerator(
            node.leftExpression,
            codeGeneratorState,
          )})`;
        }
        if (node.rightExpression.nodeType === 'Literal') {
          rightExpression = `${codeGenerator(
            node.rightExpression,
            codeGeneratorState,
          )}u64`;
        } else {
          rightExpression = `field_to_u64(${codeGenerator(
            node.rightExpression,
            codeGeneratorState,
          )})`;
        }
        return `u64_to_field(${leftExpression} ${node.operator} ${rightExpression})`;
      }
      return `${codeGenerator(node.leftExpression, codeGeneratorState)} ${
        node.operator
      } ${codeGenerator(node.rightExpression, codeGeneratorState)}`;

    case 'Identifier':
      return node.name;

    case 'Literal':
      return node.value;

    case 'IndexAccess':
      if (node.isConstantArray) return `${codeGenerator(node.baseExpression, codeGeneratorState)}[${codeGenerator(node.indexExpression, codeGeneratorState).replace('.', 'dot')}]`;
      return `${codeGenerator(node.baseExpression, codeGeneratorState)}_${codeGenerator(node.indexExpression, codeGeneratorState).replace('.', 'dot')}`;

    case 'MemberAccess':
      if (node.isStruct) return `${codeGenerator(node.expression, codeGeneratorState)}.${node.memberName}`;
      return `${codeGenerator(node.expression, codeGeneratorState)}_${node.memberName}`;

    case 'TupleExpression':
      return `(${node.components.map((comp) => codeGenerator(comp, codeGeneratorState)).join(` `)})`;

    case 'IfStatement':
      let trueStatements: any = ``;
      let falseStatements: any= ``;
      let initialStatements: any= ``;
      if(node.isRevert) {
        if(node.condition.rightExpression.nodeType == 'Identifier')
        node.condition.rightExpression.name = node.condition.rightExpression.name.replace('_temp','');
        if(node.condition.leftExpression.nodeType == 'Identifier')
        node.condition.leftExpression.name = node.condition.leftExpression.name.replace('_temp','');
      initialStatements+= `
      assert(!(${codeGenerator(node.condition, codeGeneratorState)}));`;
      return initialStatements;
      }
      // we use our list of condition vars to init temp variables. 
      node.conditionVars.forEach(elt => {
        if (elt.nodeType !== 'IndexAccess' || (elt.indexExpression && elt.indexExpression.nodeType === 'MsgSender')){
          let varDec = elt.typeName?.name && (!elt.typeName.name.includes('=> uint256') && elt.typeName.name !== 'uint256') ? elt.typeName.name : 'field';
          if (elt.isVarDec === false) varDec = '';
          initialStatements += `
        ${varDec} ${codeGenerator(elt, codeGeneratorState)}_temp = ${codeGenerator(elt, codeGeneratorState)};`;
        }
      });
      for (let i =0; i<node.trueBody.length; i++) {
        // We may have a statement that is not within the If statement but included due to the ordering (e.g. b_1 =b)
        if (node.trueBody[i].outsideIf) {
          trueStatements += `${codeGenerator(node.trueBody[i], codeGeneratorState)}`;
        } else {
          if (node.trueBody[i].expression.nodeType === 'UnaryOperation'){
            trueStatements+= `
            ${codeGenerator(node.trueBody[i].expression.subExpression, codeGeneratorState)} = if (${removeTrailingSemicolon(codeGenerator(node.condition, codeGeneratorState))}) { ${removeTrailingSemicolon(codeGenerator(node.trueBody[i].expression.subExpression, codeGeneratorState))} ${node.trueBody[i].expression.operator[0]} 1 } else { ${removeTrailingSemicolon(codeGenerator(node.trueBody[i].expression.subExpression, codeGeneratorState))} };`
          } else {
            trueStatements+= `
            ${codeGenerator(node.trueBody[i].expression.leftHandSide, codeGeneratorState)} = if (${removeTrailingSemicolon(codeGenerator(node.condition, codeGeneratorState))}) { ${removeTrailingSemicolon(codeGenerator(node.trueBody[i].expression.rightHandSide, codeGeneratorState))} } else { ${removeTrailingSemicolon(codeGenerator(node.trueBody[i].expression.leftHandSide, codeGeneratorState))} };`
          }
        }
      }
      for (let j =0; j<node.falseBody.length; j++) {
        if (node.falseBody[j].outsideIf) {
          falseStatements += `${codeGenerator(node.falseBody[j], codeGeneratorState)}`;
        } else {
          if (node.falseBody[j].expression.nodeType === 'UnaryOperation'){
            falseStatements+= `
            ${codeGenerator(node.falseBody[j].expression.subExpression, codeGeneratorState)} = if (${removeTrailingSemicolon(codeGenerator(node.condition, codeGeneratorState))}) { ${removeTrailingSemicolon(codeGenerator(node.falseBody[j].expression.subExpression, codeGeneratorState))} }  else  { ${codeGenerator(node.falseBody[j].expression.subExpression, codeGeneratorState)} ${node.falseBody[j].expression.operator[0]} 1 };`;
          } else {
            falseStatements+= `
            ${codeGenerator(node.falseBody[j].expression.leftHandSide, codeGeneratorState)} = if (${removeTrailingSemicolon(codeGenerator(node.condition, codeGeneratorState))}) { ${removeTrailingSemicolon(codeGenerator(node.falseBody[j].expression.leftHandSide, codeGeneratorState))} } else { ${removeTrailingSemicolon(codeGenerator(node.falseBody[j].expression.rightHandSide, codeGeneratorState))} };`;
          }
        }
      }
      return initialStatements + trueStatements + falseStatements;

      case 'Conditional':
        return `(${codeGenerator(node.condition, codeGeneratorState)}) ? ${codeGenerator(node.trueExpression[0], codeGeneratorState)} : ${codeGenerator(node.falseExpression[0], codeGeneratorState)}`

      case 'ForStatement':
        switch (node.initializationExpression.nodeType) {
          case 'ExpressionStatement':
            return `for u32 ${codeGenerator(node.condition.leftExpression, codeGeneratorState)} in ${codeGenerator(node.initializationExpression.expression.rightHandSide, codeGeneratorState)}..${node.condition.rightExpression.value} {
            ${keepOneTrailingSemicolon(codeGenerator(node.body, codeGeneratorState))}
            }`;
          case 'VariableDeclarationStatement':
            return `for u32 ${codeGenerator(node.condition.leftExpression, codeGeneratorState)} in ${codeGenerator(node.initializationExpression.initialValue, codeGeneratorState)}..${node.condition.rightExpression.value} {
            ${keepOneTrailingSemicolon(codeGenerator(node.body, codeGeneratorState))}
            }`;
          default:
            break;
        }


    case 'TypeConversion':
      return `${codeGenerator(node.arguments, codeGeneratorState)}`;

    case 'MsgSender':
      return node.name || 'msgSender';

      case 'MsgValue':
        return node.name || 'msgValue';

    case 'Assert':
      // only happens if we have a single bool identifier which is a struct property
      // these get converted to fields so we need to assert == 1 rather than true
      if (node.arguments[0].isStruct && node.arguments[0].nodeType === "MemberAccess") return `
        assert(${node.arguments.flatMap(codeGenerator)} == 1);`;
      return `
        assert(${node.arguments.flatMap(codeGenerator)});`;

    case 'Boilerplate':
      return Circuitbp.generateBoilerplate(node);

    case 'BoilerplateStatement': {
      let newComValue = '';
      if (node.bpType === 'incrementation') newComValue  = codeGenerator(node.addend, codeGeneratorState);
      if (node.bpType === 'decrementation') newComValue  = codeGenerator(node.subtrahend, codeGeneratorState);
      node.newCommitmentValue = newComValue;
      return Circuitbp.generateBoilerplate(node);
    }

    // And if we haven't recognized the node, we'll throw an error.
    default:
      if (!Object.keys(node).length) return '';// we have empty nodes when subnodes are skipped
      throw new TypeError(node.nodeType); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
