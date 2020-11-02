import fs from 'fs';
import path from 'path';
import logger from '../../../utils/logger.mjs';
import {
  ShieldContractConstructorBoilerplate,
  ShieldContractInsertLeavesBoilerplate,
  requireNewNullifiersNotInNullifiersThenAddThemBoilerplate,
  requireCommitmentRootInCommitmentRootsBoilerplate,
  inputsVariableDeclarationStatementBoilerplate,
  verifyBoilerplate,
  insertLeavesBoilerplate,
} from '../../../boilerplate/contract/solidity/raw/toContract.mjs';

export const boilerplateContractsDir = './contracts'; // relative to process.cwd() // TODO: move to a config?

/**
 * @param {string} file - a stringified file
 * @param {string} contextDirPath - the import statements of the `file` will be
 * relative to this dir. This path itself is relative to process.cwd().
 * @returns {Object} - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
const collectImportFiles = (file, contextDirPath = boilerplateContractsDir) => {
  const lines = file.split('\n');
  const importStatements = lines.filter(line => line.startsWith('import'));
  let localFiles = [];
  // parse for imports of local files:
  const localFilePaths = importStatements.reduce((acc, line) => {
    let importFilePath = line.match(/"(.*?)"/g)[0].replace(/"/g, ''); // get text between quotes; i.e. the import filepaths
    importFilePath += path.extname(importFilePath) === '.sol' ? '' : '.sol'; // ensure file extension.
    if (importFilePath) acc.push(importFilePath);
    return acc;
  }, []);

  // collect the import files and their paths:
  for (const p of localFilePaths) {
    if (p.includes('Verifier_Interface')) {
      localFilePaths.push('./verify/Verifier.sol');
      localFilePaths.push('./Migrations.sol'); // TODO fix bodge
    }
    const absPath = path.resolve(contextDirPath, p);
    const relPath = path.relative('.', absPath);
    const f = fs.readFileSync(relPath, 'utf8');
    localFiles.push({
      filepath: relPath, // the path to which we'll copy the file.
      file: f,
    });

    localFiles = localFiles.concat(collectImportFiles(f, path.dirname(relPath)));
  }

  // remove duplicate files after recursion:
  const uniqueLocalFiles = localFiles.filter((obj, i, self) => {
    return self.indexOf(obj) === i;
  });

  return uniqueLocalFiles;
};

function codeGenerator(node) {
  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'Folder': {
      const files = node.files.flatMap(codeGenerator);
      return files;
    }

    // case 'File':
    //   return [
    //     {
    //       filepath: path.join(boilerplateContractsDir, `${node.name}.sol`),
    //       file: codeGenerator(node.sourceUnit),
    //     },
    //   ];

    // case 'VerifierInterfaceFileBoilerplate':
    //   return collectImportFiles();
    //
    // case 'VerifierInterfaceFileBoilerplate':
    //   return verifierInterfaceFileBoilerplate();

    case 'SourceUnit': {
      const license = node.license ? `// SPDX-License-Identifier: ${node.license}` : '';
      const file = `${license}\n\n${node.nodes.map(codeGenerator).join('\n\n')}`;
      let filepath = path.join(boilerplateContractsDir, `${node.name}Shield.sol`);

      if (node.mainPrivateFunctionName) {
        filepath = path.join(
          boilerplateContractsDir,
          `${
            node.mainPrivateFunctionName.charAt(0).toUpperCase() +
            node.mainPrivateFunctionName.slice(1)
          }Shield.sol`,
        );
      }

      const fileData = [
        {
          filepath,
          file,
        },
      ];

      const importFileData = collectImportFiles(file);
      return fileData.concat(importFileData);
    }

    case 'PragmaDirective':
      return `pragma ${node.literals[0]} ${node.literals.slice(1).join('')};`;

    case 'ImportDirective':
      return `import "${node.file}";`;

    case 'ContractDefinition': {
      let name = `${node.name}Shield`;
      if (node.mainPrivateFunctionName) {
        name = `${
          node.mainPrivateFunctionName.charAt(0).toUpperCase() +
          node.mainPrivateFunctionName.slice(1)
        }Shield`;
      }
      const contractDeclaration = `contract ${name}`;
      const inheritanceSpecifiers = node.baseContracts
        ? ` is ${node.baseContracts
            .reduce((acc, cur) => {
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
      const functionSignature = `function ${node.name} (${codeGenerator(node.parameters)}) ${
        node.visibility
      } {`;
      const body = codeGenerator(node.body);
      return `${functionSignature}\n\n${body}\n\n}`;
    }

    case 'ParameterList':
      return node.parameters
        .map(codeGenerator)
        .map(decl => decl.slice(0, -1)) // remove semi-colon
        .join(', ');

    case 'VariableDeclaration': {
      const type = node.typeDescriptions.typeString;
      const constant = node.constant ? ' constant' : '';
      const visibility = node.visibility ? ` ${node.visibility}` : '';
      const storageLocation =
        !node.storageLocation || node.storageLocation === 'default'
          ? ''
          : ` ${node.storageLocation}`;
      const name = ` ${node.name}`;
      return `${type}${constant}${storageLocation}${visibility}${name};`;
    }

    case 'VariableDeclarationStatement': {
      const declarations = node.declarations.map(codeGenerator).join(', ');
      const initialValue = codeGenerator(node.initialValue);
      return `${declarations} = ${initialValue};`;
    }

    case 'Block':
      return node.statements.map(codeGenerator).join('\n\n');

    case 'ExpressionStatement':
      return codeGenerator(node.expression);

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide)} ${node.operator} ${codeGenerator(
        node.rightHandSide,
      )}`;

    case 'Identifier':
      return node.name;

    case 'ShieldContractVerifierInterfaceBoilerplate':
      return `Verifier_Interface private verifier;`;

    case 'ShieldContractMappingBoilerplate': {
      const { args } = node;
      return `mapping(${args[1]} => ${args[2]}) public ${args[0]};`;
    }

    case 'ShieldContractConstructorBoilerplate': {
      return ShieldContractConstructorBoilerplate.join('\n');
    }

    case 'ShieldContractInsertLeavesBoilerplate': {
      return ShieldContractInsertLeavesBoilerplate.join('\n');
    }

    case 'requireNewNullifiersNotInNullifiersThenAddThemBoilerplate': {
      return requireNewNullifiersNotInNullifiersThenAddThemBoilerplate.join('\n');
    }

    case 'requireCommitmentRootInCommitmentRootsBoilerplate': {
      return requireCommitmentRootInCommitmentRootsBoilerplate.join('\n');
    }

    case 'InputsVariableDeclarationStatementBoilerplate': {
      return inputsVariableDeclarationStatementBoilerplate(node).join('\n');
    }

    case 'verifyBoilerplate': {
      return verifyBoilerplate.join('\n');
    }

    case 'insertLeavesBoilerplate': {
      return insertLeavesBoilerplate.join('\n');
    }

    // And if we haven't recognized the node, we'll throw an error.
    default:
      return;
      // throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
