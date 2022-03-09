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
      const functionSignature = `${
        node.isConstructor ? 'constructor ' : 'function '
      }${node.name} (${codeGenerator(node.parameters)}) ${node.visibility} {`;
      const body = codeGenerator(node.body);
      return `
        ${functionSignature}

          ${body}

        }`;
    }

    case 'ParameterList':
      return node.parameters.flatMap(codeGenerator).filter(Boolean).join(', ');

    case 'VariableDeclaration': {
      if (node.isSecret) return '';
      let { typeString } = node.typeDescriptions;
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
      const initialValue = codeGenerator(node.initialValue);
      return `
          ${declarations} = ${initialValue};`;
    }

    case 'Block': {
      const preStatements: string = node.preStatements.flatMap(codeGenerator);
      const statements: string = node.statements.flatMap(codeGenerator);
      const postStatements: string = node.postStatements.flatMap(codeGenerator);
      return [...preStatements, ...statements, ...postStatements].join('\n');
    }
    case 'ExpressionStatement':
      return codeGenerator(node.expression);

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

    case 'UnaryOperation':
      return `${codeGenerator(node.subExpression)} ${node.operator};`;

    case 'FunctionCall': {
      const expression = codeGenerator(node.expression);
      const args = node.arguments.map(codeGenerator);
      const semicolon = expression === 'require' ? ';' : ''; // HACK. Semicolons get duplicated inserted sometimes, e.g. for nested functioncalls, we get `;,` or for VariableDeclarationStatements with a functioncall on the RHS, we get `;;`.
      return `${expression}(${args.join(', ')})${semicolon}`;
    }

    case 'ElementaryTypeNameExpression':
      return codeGenerator(node.typeName);

    case 'ElementaryTypeName':
      return node.typeDescriptions.typeString;

    case 'MsgSender':
      return 'msg.sender';

    case 'MemberAccess': {
      const expression = codeGenerator(node.expression);
      return `${expression}.${node.memberName}`;
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
