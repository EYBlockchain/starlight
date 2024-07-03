/* eslint-disable import/no-cycle */

import path from 'path';
import { collectImportFiles } from '../../common.js'
import ContractBP from '../../../boilerplate/contract/solidity/raw/ContractBoilerplateGenerator.js';
import FunctionBP from '../../../boilerplate/contract/solidity/raw/FunctionBoilerplateGenerator.js';

const contractBP = new ContractBP();
const functionBP = new FunctionBP();


function codeGenerator(node: any) {
  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'Folder': {
      const files: string = node.files.flatMap(codeGenerator);
      return files;
    }

    case 'SourceUnit': {
      const license = node.license
        ? `// SPDX-License-Identifier: ${node.license}`
        : '';
      const file = `${license}\n\n${node.nodes
        .map(codeGenerator)
        .join('\n\n')}`;
      const filepath = path.join(
        './contracts',
        `${node.name}Shield.sol`,
      );

      const fileData = [
        {
          filepath,
          file,
        },
      ];

      const importFileData = collectImportFiles(file, 'contract');
      return fileData.concat(importFileData);
    }

    case 'PragmaDirective':
      return `pragma ${node.literals[0]} ${node.literals.slice(1).join('')};`;

    case 'ImportDirective':
      return `import "${node.file}";`;

    case 'ContractDefinition': {
      const name = `${node.name}Shield`;
      const contractDeclaration = `contract ${name}`;
      // TODO: an InheritanceSpecifier is a nodeType in itself, so should be recursed into as its own 'case' in this 'switch' statement.
      const inheritanceSpecifiers = node.baseContracts
        ? ` is ${node.baseContracts
            .reduce((acc: string[], cur: any) => {
              if (cur.nodeType === 'InheritanceSpecifier') {
                acc.push(cur.baseName.name);
              }
              return acc;
            }, [])
            .join(', ')}`
        : '';
      const nodes = node.nodes.map(codeGenerator).join('\n\n');
      return `${contractDeclaration}${inheritanceSpecifiers} {\n\n${nodes}\n}`;
    }

    case 'FunctionDefinition': {
      // prettier-ignore
      let functionType: string = ``;
      let returnType: string[] = [];
      let returnParams: string[] = [];
      switch (node.kind)
      {
        case 'fallback':
        case 'receive':
          functionType = node.kind;
          break;
        case 'constructor':
          functionType = 'constructor ';
          break;
        case 'function':
          functionType = `function ${node.name}`;
          break;

      }

      // add any public return here,
      node.returnParameters.parameters.forEach(params => {
        // We check that params.name is defined because otherwise this is a commitment 
        if(!params.isSecret && params.name != undefined && params.typeDescriptions.typeString != 'bool') {
          returnType.push(params.typeDescriptions.typeString);
          returnParams.push(params.name);
        }
      })
      const functionSignature = `${functionType} (${codeGenerator(node.parameters)}) ${node.visibility} ${node.stateMutability} ${returnType.length > 0 ? `returns (${returnType})`: ``}{`;
      let body = codeGenerator(node.body);
      let msgSigCheck = body.slice(body.indexOf('bytes4 sig'), body.indexOf('verify') )
      if(!node.msgSigRequired)
        body = body.replace(msgSigCheck, ' ');
    return `
      ${functionSignature}

        ${body}
        ${returnType.length == 1 ? `return ${returnParams};` : returnType.length > 1  ? `return (${returnParams});` : `` }
      }`;
    }

    case 'EventDefinition': {
      const functionSignature = ` \t \t \t \tevent ${node.name}(${codeGenerator(node.parameters)});`;
    return functionSignature;
    }

    case 'ParameterList':
      return node.parameters.flatMap(codeGenerator).filter(Boolean).join(', ');

    case 'VariableDeclaration': {
      if (node.isSecret) return '';
      let { typeString } = node.typeDescriptions;
      if (!node.declarationType && !!node._newASTPointer?.declarationType)
      node.declarationType = node._newASTPointer.declarationType;
      // we crop 'struct ContractName.structname' to just 'structname'
      if (typeString.includes('struct ')) typeString = typeString.substring(typeString.indexOf(".") + 1);
      typeString = typeString.replace('contract ', ''); // pesky userdefined type 'contract' keword needs to be removed in some cases.
      const constant = node.constant ? ' constant' : '';
      const visibility = node.visibility ? ` ${node.visibility}` : '';
      const storageLocation =
        !node.storageLocation || node.storageLocation === 'default'
          ? ''
          : ` ${node.storageLocation}`;
      const name = ` ${node.name}`;

      if (node.declarationType === 'parameter') {
        return `${typeString}${constant}${storageLocation}${name}`;
      }
      if (node.declarationType === 'localStack') {
        return `${typeString}${constant}${storageLocation}${name}`; // no semicolon
      }
      return `
        ${typeString}${constant}${storageLocation}${visibility}${name};`;
    }

    case 'VariableDeclarationStatement': {
      const declarations: string = node.declarations.map(codeGenerator).join(', ');
      if (declarations === '') return declarations; // when all are secret, we ignore them
      let initialValue;
       if(node.initialValue)
       initialValue = codeGenerator(node.initialValue);
      if (!initialValue || initialValue === '') return `${declarations};`;
      return `
          ${declarations} = ${initialValue};`;
    }

    case 'Block': {
      const preStatements: string = node.preStatements.flatMap(codeGenerator);
      const statements: string = node.statements.flatMap(codeGenerator);
      const postStatements: string = node.postStatements.flatMap(codeGenerator);
      //We have changed the order here so that statements is after poststatements because we need the statements to appear after proof generation. This could cause issues. 
      return [...preStatements, ...postStatements, ...statements].join('\n');
    }
    case 'ExpressionStatement':{
      return codeGenerator(node.expression);
    }

    case 'Return':

      return ` `;

    case 'Break': 
      return `break;`;

    case 'Continue':
      return 'continue;';

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide)} ${
        node.operator
      } ${codeGenerator(node.rightHandSide)};`;

    case 'BinaryOperation':
      return `${codeGenerator(node.leftExpression)} ${
        node.operator
      } ${codeGenerator(node.rightExpression)}`;

    case 'Identifier':
      return node.name;

    case 'Literal':
      return node.kind === 'string' ? `"${node.value}"` : node.value;

    case 'TupleExpression':
      return `(${node.components.map(codeGenerator).join(` `)})`;

    case 'TypeConversion':
      return `${codeGenerator(node.expression)}(${codeGenerator(node.arguments)})`;

    case 'UnaryOperation':
      return `${codeGenerator(node.subExpression)} ${node.operator};`;

    case 'EmitStatement':
        return `\t \t \t \temit ${codeGenerator(node.eventCall)};`;

    case 'FunctionCall': {
      const expression = codeGenerator(node.expression);
      const args = node.arguments.map(codeGenerator);
      const semicolon = expression === 'require' || expression === 'revert' || expression.includes(`push`) ? ';' : ''; // HACK. Semicolons get duplicated inserted sometimes, e.g. for nested functioncalls, we get `;,` or for VariableDeclarationStatements with a functioncall on the RHS, we get `;;`.
      return `${expression}(${args.join(', ')})${semicolon}`;

    }
    case 'InternalFunctionCall' :{
      if(node.parameters ){
        if(node.internalFunctionInteractsWithSecret)
         return `\t \t \t \t ${node.name} (${node.parameters});`
        return  `\t \t \t \t ${node.name} (${node.parameters.map(codeGenerator)});`
      } else {
         const args = node.arguments.map(codeGenerator);
         return `\t \t \t \t${node.name} (${args.join(', ')});`
      }
    }


    case 'IfStatement':
      {
        let trueStatements: any = ``;
        let falseStatements: any= ``;
        let initialStatements: any= codeGenerator(node.condition);
        for (let i =0; i<node.trueBody.statements.length; i++) {
          trueStatements+= `
          ${codeGenerator(node.trueBody.statements[i])}`
        }
        if(node.falseBody.statements) {
        for (let j =0; j<node.falseBody.statements.length; j++) {
          falseStatements+= `
          ${codeGenerator(node.falseBody.statements[j])}`
          }
        }
        if(node.falseBody.condition) {
          falseStatements+= `${codeGenerator(node.falseBody)}`;
        }
        if(falseStatements!==``)
        return `if (${initialStatements}) {
          ${trueStatements}
        }
          else {
          ${falseStatements} 
          }`;
          else
          return `if (${initialStatements}) {
          ${trueStatements} 
        }`;
      }
    case 'ForStatement': {
      const initializationExpression = codeGenerator(node.initializationExpression);
      const condition = codeGenerator(node.condition);
      const loopExpression = codeGenerator(node.loopExpression).replaceAll(";", "");
      const body = codeGenerator(node.body);

            return `for (${initializationExpression} ${condition}; ${loopExpression}) {
              ${body}
                  }`
                }

    case 'WhileStatement':
      return `while(${codeGenerator(node.condition)}) {
        ${codeGenerator(node.body)}
      }`

      case 'DoWhileStatement':
        return ` do { 
          ${codeGenerator(node.body)}
        } while(${codeGenerator(node.condition)});`

    case 'ElementaryTypeNameExpression':
      return codeGenerator(node.typeName);

    case 'ElementaryTypeName':
      return node.typeDescriptions.typeString;

    case 'MsgSender':
      return 'msg.sender';

      case 'MsgValue':
        return 'msg.value';

    case 'MemberAccess': {
      const expression = codeGenerator(node.expression);
      return `${expression}.${node.memberName}`;
    }

    case 'IndexAccess': {
      const baseExpression = codeGenerator(node.baseExpression);
      const indexExpression = codeGenerator(node.indexExpression);
      return `${baseExpression}[${indexExpression}]`;
    }

    case 'StructDefinition': {
      node.members.forEach((member: any) => delete member.visibility);
      return `struct ${node.name} {
        ${node.members.map(codeGenerator).join('\n')}
      }`
    }

    case 'ContractBoilerplate':
      return contractBP.generateBoilerplate(node).join('\n');

    case 'FunctionBoilerplate':
      return functionBP.generateBoilerplate(node);

    // And if we haven't recognized the node, we'll throw an error.
    default:
      return;
      // throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
