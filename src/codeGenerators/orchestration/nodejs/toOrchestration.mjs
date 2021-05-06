/* eslint-disable import/no-cycle, no-param-reassign, consistent-return */
import fs from 'fs';
import path from 'path';
import { OrchestrationCodeBoilerPlate } from '../../../boilerplate/orchestration/javascript/raw/toOrchestration.mjs';
import fileGenerator from '../files/toOrchestration.mjs';

// newline / tab beautification for '.zok' files
// const beautify = code => {
//   // can't be bothered writing this yet
//   const lines = code.split('\n');
//   let newCode = '';
//   let tabCount = 0;
//   for (const line of lines) {
//     const chars = line.split('');
//     let newLine = '';
//     for (const char of chars) {
//       switch (char) {
//         case '[':
//           ++tabCount;
//           newLine += `${char}\\\n${'\t'.repeat(tabCount)}`;
//           break;
//         case ']':
//           --tabCount;
//           newLine += `\\\n${'\t'.repeat(tabCount)}${char}`;
//           break;
//         default:
//           newLine += char;
//       }
//     }
//     newCode += newLine;
//   }
//   return newCode;
// };

/**
 * @param {string} name - variable name
 * @returns {string} - code line which will extract an accessed value from the user db
 */
const getAccessedValue = name => {
  return `\nlet { ${name} } = ${name}_preimage;`;
};

/**
 * @param {Object} node - an orchestration AST node
 * @returns {Object} - { filepath: 'path/to/file.mjs', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
function codeGenerator(node) {
  // We do a special kind of traversal which outputs files and their contents
  // Separate files and folders are handled by fileGenerator
  // This codeGenerator deals with complex function code

  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'FunctionDefinition': {
      node.inputParameters = node.parameters.parameters.map(codeGenerator);
      node.returnParameters =
        node.returnParameters.parameters.map(codeGenerator) || [];
      const fn = OrchestrationCodeBoilerPlate(node);
      const statements = codeGenerator(node.body);
      fn.statements.push(statements);
      return `${fn.signature[0]}\n\t${fn.statements.join('')}\n${
        fn.signature[1]
      }`;
    }

    case 'ParameterList':
      return node.parameters.map(paramnode => paramnode.name);

    case 'VariableDeclaration': {
      return node.name;
    }

    case 'VariableDeclarationStatement': {
      // const declarations = node.declarations.map(codeGenerator).join(', ');
      // const initialValue = codeGenerator(node.initialValue);
      if (!node.modifiesSecretState) return;
      if (node.initialValue.nodeType === 'Assignment') {
        if (node.declarations[0].isAccessed) {
          return `${getAccessedValue(
            node.declarations[0].name,
          )}\n${codeGenerator(node.initialValue)};`;
        }
        return `\nlet ${codeGenerator(node.initialValue)};`;
      }

      if (
        node.initialValue.operator &&
        !node.initialValue.operator.includes('=')
      )
        return `\nlet ${node.declarations[0].name} = ${codeGenerator(
          node.initialValue,
        )};`;
      return `\nlet ${codeGenerator(node.initialValue)};`;
    }

    case 'ElementaryTypeName':
      return;

    case 'Block':
      return node.statements.map(codeGenerator).join(`\t`);

    case 'ExpressionStatement':
      if (!node.incrementsSecretState)
        return `\n${codeGenerator(node.expression)};`;
      return `\n// increment would go here but has been filtered out`;

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide)} ${
        node.operator
      } ${codeGenerator(node.rightHandSide)}`;

    case 'BinaryOperation':
      return `${codeGenerator(node.leftExpression)} ${
        node.operator
      } ${codeGenerator(node.rightExpression)}`;

    case 'Literal':
    case 'Identifier':
      return node.name;
    case 'Folder':
    case 'File':
    case 'EditableCommitmentCommonFilesBoilerplate':
    case 'SetupCommonFilesBoilerplate':
    case 'IntegrationTestBoilerplate':
      return fileGenerator(node);
    case 'InitialisePreimage':
    case 'ReadPreimage':
    case 'WritePreimage':
    case 'MembershipWitness':
    case 'CalculateNullifier':
    case 'CalculateCommitment':
    case 'GenerateProof':
    case 'SendTransaction':
    case 'Imports':
    case 'KeyRegistrationFunction':
      return `${OrchestrationCodeBoilerPlate(node).statements.join('')}`;
    // And if we haven't recognized the node, we'll throw an error.
    default:
      throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
