/* eslint-disable import/no-cycle, no-param-reassign, consistent-return */
import {OrchestrationCodeBoilerPlate}  from '../../../boilerplate/orchestration/javascript/raw/toOrchestration.js';
import fileGenerator from '../files/toOrchestration.js';

/**
 * @desc:
 * Code generator for the output function e.g. myFunction.mjs
 * Creates the .mjs file which extracts commitment data and communicates with
 * Zokrates and Ethereum.
 */

/**
 * @param {string} name - variable name
 * @returns string - code line which will extract an accessed value from the user db
 */
const getAccessedValue = (name: string) => {
  return `\nlet ${name} = generalise(${name}_preimage.value);`;
};

/**
 * @param {Object} node - variable node
 * @returns string - code line which will extract an accessed value from the user db
 */
const getPublicValue = (node: any) => {
  if (node.nodeType !== 'IndexAccess')
    // In the _init variable we save the initial value of the variable for use later. 
    return `\nlet ${node.name} = generalise(await instance.methods.${codeGenerator(node)}().call());\n let ${node.name}_init = ${node.name};`;
  return `\nconst ${node.name} = generalise(await instance.methods.${codeGenerator(node.baseExpression, { lhs: true} )}(${codeGenerator(node.indexExpression, { contractCall: true })}).call());`;
};

/**
 * @param {Object} node - an orchestration AST node
 * @returns {Object} - { filepath: 'path/to/file.mjs', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
export default function codeGenerator(node: any, options: any = {}): any {
  // We do a special kind of traversal which outputs files and their contents
  // Separate files and folders are handled by fileGenerator
  // This codeGenerator deals with complex function code

  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'FunctionDefinition': {
      node.inputParameters = node.parameters.parameters.map(codeGenerator);
      node.inputParameters = node.inputParameters.filter(para => para !== undefined);
      let returnIsSecret: string[] = [];
      const decStates = node.decrementedSecretStates;
      if(node.returnParameters.parameters) {
      node.returnParameters.parameters.forEach( node => {
         returnIsSecret.push(node.isSecret);
       })
     }
        node.returnParameters = node.returnParameters.parameters.filter((paramnode: any) => (paramnode.isSecret || paramnode.typeName.name === 'bool')).map(paramnode => (paramnode.name)) || [];
        node.returnParameters.forEach( (param, index) => {
          if(decStates) {
           if(decStates?.includes(param)){
            node.returnParameters[index] = node.returnParameters[index]+'_change';
          }
        } else if(returnIsSecret[index])
            node.returnParameters[index] = node.returnParameters[index];
        })
        const fn = OrchestrationCodeBoilerPlate(node);
        const statements = codeGenerator(node.body);
        fn.statements.push(statements);
        return `${fn.signature[0]}\n\t${fn.statements.join('')}\n${
          fn.signature[1]
      }`;
    }

    case 'ParameterList':
      return node.parameters.map((paramnode: any) => paramnode.name);
   
    case 'VariableDeclaration': 
      return node.name;
     
    case 'VariableDeclarationStatement': {
      if (!node.interactsWithSecret)
        return `\n// non-secret line would go here but has been filtered out`;
      if (node.initialValue?.nodeType === 'Assignment') {
        if (node.declarations[0].isAccessed && node.declarations[0].isSecret) {
          let varName = node.initialValue.leftHandSide?.name ? node.initialValue.leftHandSide.name : node.declarations[0].name;
          return `${getAccessedValue(
            varName,
          )}\n${codeGenerator(node.initialValue)};`;
        }
        if (node.declarations[0].isStruct) return `\n let ${codeGenerator(node.declarations[0])} = {}; \n${codeGenerator(node.initialValue)};`;
        return `\nlet ${codeGenerator(node.initialValue)};`;
      } else if (node.declarations[0].isAccessed && !node.declarations[0].isSecret) { 
        return `${getPublicValue(node.declarations[0])}`
      } else if (node.declarations[0].isAccessed) {
        return `${getAccessedValue(node.declarations[0].name)}`;
      }

      if (!node.initialValue && !node.declarations[0].isAccessed) return `\nlet ${codeGenerator(node.declarations[0])};`;
      if (node.initialValue &&
        node.initialValue.operator &&
        !node.initialValue.operator.includes('=')
      )
        return `\nlet ${node.declarations[0].name} = generalise(${codeGenerator(
          node.initialValue,
        )});`;
      if (!node.initialValue.operator) {
        if (!node.initialValue.nodeType) return `\nlet ${codeGenerator(node.declarations[0])};`
        // local var dec
        if (node.initialValue.nodeType === 'Literal' && !node.isInitializationExpression) return `\nlet ${codeGenerator(node.declarations[0])} = generalise(${codeGenerator(node.initialValue)});`;
        return `\nlet ${codeGenerator(node.declarations[0])} = generalise(${codeGenerator(node.initialValue)});`;
      } 
      return `\nlet ${codeGenerator(node.initialValue)};`;
    }

    case 'ElementaryTypeName':
      return;

      case 'Block': {
        const preStatements: string = (node.preStatements.flatMap(codeGenerator));
        const statements:string = (node.statements.flatMap(codeGenerator));
        const postStatements: string = (node.postStatements.flatMap(codeGenerator));
        return [...preStatements, ...statements, ...postStatements].join('\n\n');
      }

    case 'ExpressionStatement':
      if (!node.incrementsSecretState && (node.interactsWithSecret || node.expression?.internalFunctionInteractsWithSecret)){
        return `\n${codeGenerator(node.expression)};`;
      }
      if (!node.interactsWithSecret)
        return `\n// non-secret line would go here but has been filtered out`;
      return `\n// increment would go here but has been filtered out`;

    case 'InternalFunctionCall':
     return " ";

    case 'Assignment':
      // To ensure the left hand side is always a general number, we generalise it here (excluding the initialisation in a for loop). 
      if (!node.isInitializationAssignment && node.rightHandSide.subType !== 'generalNumber'){
        if (['+=', '-=', '*='].includes(node.operator)) {
          return `${codeGenerator(node.leftHandSide, {
            lhs: true,
          })} = generalise(${codeGenerator(node.leftHandSide)} ${node.operator.charAt(
            0,
          )} ${codeGenerator(node.rightHandSide)})`;
        }
        return `${codeGenerator(node.leftHandSide, { lhs: true })} ${
          node.operator
        } generalise(${codeGenerator(node.rightHandSide)})`;
      } else {
        if (['+=', '-=', '*='].includes(node.operator)) {
          return `${codeGenerator(node.leftHandSide, {
            lhs: true,
          })} = ${codeGenerator(node.leftHandSide)} ${node.operator.charAt(
            0,
          )} ${codeGenerator(node.rightHandSide)}`;
        }
        return `${codeGenerator(node.leftHandSide, { lhs: true })} ${
          node.operator
        } ${codeGenerator(node.rightHandSide)}`;
      }
      

    case 'BinaryOperation':
      return `${codeGenerator(node.leftExpression, { lhs: options.condition })} ${
        node.operator
      } ${codeGenerator(node.rightExpression)}`;

    case 'TupleExpression':
      if(node.components.length !== 0)
      return `(${node.components.map(codeGenerator).join(` `)})`;
      return ` `;

      case 'IfStatement': {
        if(node.falseBody.length)
        return `if (${codeGenerator(node.condition)}) {
            ${node.trueBody.flatMap(codeGenerator).join('\n')}
          } else {
            ${node.falseBody.flatMap(codeGenerator).join('\n')}
          }`
          else
          return `if (${codeGenerator(node.condition)}) {
              ${node.trueBody.flatMap(codeGenerator).join('\n')}
            }`
        }

        case 'Conditional': {
            return ` ${codeGenerator(node.condition)} ?
            ${node.trueExpression.flatMap(codeGenerator).join('\n')} : ${node.falseExpression.flatMap(codeGenerator).join('\n')}`
        }

      case 'ForStatement': {
        if(node.interactsWithSecret) {
          let initializationExpression = `${codeGenerator(node.initializationExpression).trim()}`;
          let condition = `${codeGenerator(node.condition, { condition: true })};`;
          let loopExpression = ` ${node.loopExpression.expression.rightHandSide.subExpression.name} ${node.loopExpression.expression.rightHandSide.operator}`;
          return `for( ${node.initializationExpression.nodeType === 'VariableDeclarationStatement' ? `` : `let`} ${initializationExpression} ${condition} ${loopExpression}) {
          ${codeGenerator(node.body)}
        }`
        }
        else
        return '';
      }

    case 'MsgSender':
      // if we need to convert an owner's address to a zkp PK, it will not appear here
      // below is when we need to extract the eth address to use as a param
      if (options?.contractCall) return `msgSender.hex(20)`;
      return `msgSender.integer`;

    case 'MsgValue':
        return `msgValue`;

    case 'TypeConversion':
      return `${codeGenerator(node.arguments)}`;

    case 'UnaryOperation':
      // ++ or -- on a parseInt() does not work
      if (node.subExpression.subType === 'bool' && node.operator === '!'){
        return `${node.operator}(parseInt(${node.subExpression.name}.integer, 10) === 1)`;
      }
      return `parseInt(${node.subExpression.name}.integer,10)${node.operator[0]}1`;

    case 'Literal':
      return node.value;

    case 'Identifier':
      if (options?.lhs) return node.name;
      switch (node.subType) {
        default:
        case 'uint256':
          return `parseInt(${node.name}.integer, 10)`;
        case 'bool':
          //return `parseInt(${node.name}.integer, 10) === 0 ? false : true`;
          return `!(parseInt(${node.name}.integer, 10) === 0)`;
        case 'address':
          if (options?.contractCall) return `${node.name}.hex(20)`
          return `${node.name}.integer`;
        case 'generalNumber':
          return `generalise(${node.name})`;
      }

    case 'MemberAccess':
      if (options?.lhs) return `${node.name}.${node.memberName}`;
      return codeGenerator({ nodeType: 'Identifier', name: `${node.name}.${node.memberName}`, subType: node.subType });

    case 'RequireStatement':
      if (!node.message[0]){
        return `if(!(${codeGenerator(node.condition[0])})){
          throw new Error(
          "Require statement not satisfied."
        );}\n`;
      }
      return `if(!(${codeGenerator(node.condition[0])})){
        throw new Error(
        "Require statement not satisfied: ${node.message[0].value}"
      );}\n`;

    case 'Folder':
    case 'File':
    case 'EditableCommitmentCommonFilesBoilerplate':
    case 'SetupCommonFilesBoilerplate':
    case 'IntegrationTestBoilerplate':
      // Separate files are handled by the fileGenerator
      return fileGenerator(node);
    case 'IntegrationApiServicesBoilerplate':
      // Separate files are handled by the fileGenerator
      return fileGenerator(node);
    case 'IntegrationApiRoutesBoilerplate':
      // Separate files are handled by the fileGenerator
      return fileGenerator(node);
    case 'BackupDataRetrieverBoilerplate':
      // Separate files are handled by the fileGenerator
      return fileGenerator(node);
    case 'IntegrationEncryptedListenerBoilerplate':  
    return fileGenerator(node);
    case 'InitialisePreimage':
    case 'InitialiseKeys':
    case 'ReadPreimage':
    case 'WritePreimage':
    case 'MembershipWitness':
    case 'CalculateNullifier':
    case 'CalculateCommitment':
    case 'GenerateProof':
    case 'EncryptBackupPreimage':
    case 'SendTransaction':
    case 'Imports':
    case 'KeyRegistrationFunction':
      return `${OrchestrationCodeBoilerPlate(node).statements.join('')}`;
    // And if we haven't recognized the node, we'll throw an error.
    default:
      throw new TypeError(node.nodeType);
  }
}
