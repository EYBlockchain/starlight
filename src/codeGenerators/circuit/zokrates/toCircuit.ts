/* eslint-disable import/no-cycle, no-nested-ternary */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { collectImportFiles } from '../../common.js'
import CircuitBP from '../../../boilerplate/circuit/zokrates/raw/BoilerplateGenerator.js';
import NodePath from '../../../traverse/NodePath.js'
import {traversePathsFast} from '../../../traverse/traverse.js'
const Circuitbp = new CircuitBP();

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
         lines[line] = 'from "hashes/poseidon/poseidon.zok" import main as poseidon';
       }
     }
     fileObj = lines.join('\n');
   }
   return fileObj;
 }
 

function codeGenerator(node: any) {
  switch (node.nodeType) {
    case 'Folder':
      return CircuitBP.uniqueify(node.files.flatMap(codeGenerator));

    case 'File': {
      const filepath = path.join('./circuits', `${node.fileName}${node.fileExtension}`);
      const file = node.nodes.map(codeGenerator).join('\n\n');
      const thisFile = {
        filepath,
        file: poseidonLibraryChooser(file),
      };
      if (!file && node.fileName === `joinCommitments`) {
        thisFile.file = fs.readFileSync(path.resolve(fileURLToPath(import.meta.url), '../../../../../circuits/common/joinCommitments.zok'), 'utf8');
      }
      const importedFiles = collectImportFiles(thisFile.file, 'circuit');
      return [thisFile, ...importedFiles];
    }

    case 'ImportStatementList':
      return `${CircuitBP.uniqueify(node.imports.flatMap(codeGenerator)).join('\n')}`;

    case 'FunctionDefinition': {
      let functionSignature : any;
      let returnType : any[] = [];
      let body = codeGenerator(node.body);
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
            returnStatement.push(`${node.name}`);
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

      functionSignature  = `def main(\\\n\t${codeGenerator(node.parameters)}\\\n) -> `;
      node.returnParameters.parameters.forEach((node) => {
        if((node.isPrivate === true || node.typeName.name === 'bool') || node.typeName.name.includes('EncryptedMsgs'))
          returnType.push(node.typeName.name);
      });
 
      if(returnStatement.length === 0){
        returnStatement.push('true');
        returnType.push('bool') ;
      }
      
      return `${functionSignature}(${returnType}):

        ${body}

         return ${returnStatement}`;
    }

    case 'StructDefinition': {
      return `struct ${node.name} {
        ${node.members.map((mem: any) => mem.type + ' ' + mem.name).join(`\n`)}
      }`;
    }

    case 'ParameterList': {
      const paramList = CircuitBP.uniqueify(node.parameters.flatMap(codeGenerator));

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

      return paramList.join(',\\\n\t');
    }

    case 'VariableDeclaration': {
      const visibility =
        node.declarationType === 'parameter'
          ? node.isPrivate
            ? 'private '
            : 'public '
          : '\t\t';
      return `${visibility}${codeGenerator(node.typeName)} ${node.name}`;
    }

    case 'VariableDeclarationStatement': {
      const declarations = node.declarations.map(codeGenerator).join(', ');
      if (!node.initialValue) return `${declarations} = ${node.declarations.map(n => n.typeName.name === 'bool' ? 'false' : 0)}`;
      const initialValue = codeGenerator(node.initialValue);
      return `${declarations} = ${initialValue}`;
    }

    case 'ElementaryTypeName':
      return node.name;

    case 'Block': {
      const preStatements = CircuitBP.uniqueify(node.preStatements.flatMap(codeGenerator));
      const statements = CircuitBP.uniqueify(node.statements.flatMap(codeGenerator));
      const postStatements = CircuitBP.uniqueify(node.postStatements.flatMap(codeGenerator));
      return [...preStatements, ...statements, ...postStatements].join('\n\n');
    }

    case 'ExpressionStatement': {
      if (node.isVarDec) {
        return `
        field ${codeGenerator(node.expression)}`;
      }
      return codeGenerator(node.expression);
    }
    case 'InternalFunctionCall': {
     if(node.internalFunctionInteractsWithSecret) {
      let returnPara  = ' ';
      if(node.CircuitReturn.length){
       node.CircuitReturn.forEach((para) =>{
        if(para.typeName.name == 'EncryptedMsgs<3>')
         returnPara = `  EncryptedMsgs<3> ${para.name}_0_cipherText = `;
       })
       return `${returnPara} ${node.name}(${(node.CircuitArguments).join(',\\\n \t')})`
      }
      else if(node.CircuitArguments.length)
       return `assert(${node.name}(${(node.CircuitArguments).join(',\\\n \t')})) ` ;
      else
       return ``;
      }
    }
    case 'JoinCommitmentFunctionDefinition' :
    return `${CircuitBP.uniqueify(node.body.statements.flatMap(codeGenerator)).join('\n')}`;
    case 'Return':
      return  ` ` ;

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide)} ${node.operator} ${codeGenerator(node.rightHandSide)}`;

    case 'UnaryOperation':
      return `${codeGenerator(node.initialValue)} = ${codeGenerator(node.subExpression)} ${node.operator[0]} 1`

    case 'BinaryOperation':
      return `${codeGenerator(node.leftExpression)} ${node.operator} ${codeGenerator(
        node.rightExpression,
      )}`;

    case 'Identifier':
      return node.name;

    case 'Literal':
      return node.value;

    case 'IndexAccess':
      if (node.isConstantArray) return `${codeGenerator(node.baseExpression)}[${codeGenerator(node.indexExpression).replace('.', 'dot')}]`;
      return `${codeGenerator(node.baseExpression)}_${codeGenerator(node.indexExpression).replace('.', 'dot')}`;

    case 'MemberAccess':
      if (node.isStruct) return `${codeGenerator(node.expression)}.${node.memberName}`;
      return `${codeGenerator(node.expression)}_${node.memberName}`;

    case 'TupleExpression':
      return `(${node.components.map(codeGenerator).join(` `)})`;

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
      assert(${codeGenerator(node.condition)})`;
      return initialStatements;
      }
      // we use our list of condition vars to init temp variables
      node.conditionVars.forEach(elt => {
        initialStatements += `
        ${elt.typeName?.name && (!elt.typeName.name.includes('=> uint256') && elt.typeName.name !== 'uint256') ? elt.typeName.name : 'field'} ${codeGenerator(elt)}_temp = ${codeGenerator(elt)}`;
      });
      for (let i =0; i<node.trueBody.length; i++) {
        trueStatements+= `
        ${codeGenerator(node.trueBody[i].expression.leftHandSide)} = if ${codeGenerator(node.condition)} then ${codeGenerator(node.trueBody[i].expression.rightHandSide)} else ${codeGenerator(node.trueBody[i].expression.leftHandSide)} fi`
      }
      for (let j =0; j<node.falseBody.length; j++) {
        falseStatements+= `
        ${codeGenerator(node.falseBody[j].expression.leftHandSide)} = if ${codeGenerator(node.condition)} then ${codeGenerator(node.falseBody[j].expression.leftHandSide)} else ${codeGenerator(node.falseBody[j].expression.rightHandSide)} fi`
      }
      return initialStatements + trueStatements + falseStatements;

      case 'Conditional':
        return `(${codeGenerator(node.condition)}) ? ${codeGenerator(node.trueExpression[0])} : ${codeGenerator(node.falseExpression[0])}`

      case 'ForStatement':
        switch (node.initializationExpression.nodeType) {
          case 'ExpressionStatement':
            return `for u32 ${codeGenerator(node.condition.leftExpression)} in ${codeGenerator(node.initializationExpression.expression.rightHandSide)}..${node.condition.rightExpression.value} do
            ${codeGenerator(node.body)}
            endfor`;
          case 'VariableDeclarationStatement':
            return `for u32 ${codeGenerator(node.condition.leftExpression)} in ${codeGenerator(node.initializationExpression.initialValue)}..${node.condition.rightExpression.value} do
            ${codeGenerator(node.body)}
            endfor`;
          default:
            break;
        }


    case 'TypeConversion':
      return `${codeGenerator(node.arguments)}`;

    case 'MsgSender':
      return node.name || 'msgSender';

      case 'MsgValue':
        return node.name || 'msgValue';

    case 'Assert':
      // only happens if we have a single bool identifier which is a struct property
      // these get converted to fields so we need to assert == 1 rather than true
      if (node.arguments[0].isStruct && node.arguments[0].nodeType === "MemberAccess") return `
        assert(${node.arguments.flatMap(codeGenerator)} == 1)`;
      return `
        assert(${node.arguments.flatMap(codeGenerator)})`;

    case 'Boilerplate':
      return Circuitbp.generateBoilerplate(node);

    case 'BoilerplateStatement': {
      return Circuitbp.generateBoilerplate(node);
    }

    // And if we haven't recognized the node, we'll throw an error.
    default:
      if (!Object.keys(node).length) return '';// we have empty nodes when subnodes are skipped
      throw new TypeError(node.nodeType); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
