import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.mjs';
import OrchestrationCodeBoilerPlate from '../boilerplate/orchestration/javascript/raw/toOrchestration.mjs';

const boilerplateNodeDir = './src/boilerplate/';

/**
 * @param {string} file - a stringified file
 * @param {string} contextDirPath - the import statements of the `file` will be
 * relative to this dir. This path itself is relative to process.cwd().
 * @returns {Object} - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
const collectImportFiles = (file, contextDirPath = boilerplateNodeDir) => {
  const lines = file.split('\n');
  const importStatements = lines.filter(
    line => (line.includes(`.mjs`) || line.includes(`.json`)) && !line.includes('return'),
  );
  let localFiles = [];
  // parse for imports of local (non-zokrates-stdlib) files:
  const localFilePaths = importStatements.reduce((acc, line) => {
    const importFilePath = line.match(/'(.*?)'/g)[0].replace(/'/g, ''); // get text between quotes; i.e. the import filepaths
    acc.push(importFilePath);
    return acc;
  }, []);

  // collect the import files and their paths:
  for (const p of localFilePaths) {
    const absPath = path.resolve(contextDirPath, p);
    const relPath = path.relative('.', absPath);
    const writePath = path.join('orchestration', path.relative('./src/boilerplate', relPath));
    const f = fs.readFileSync(relPath, 'utf8');
    localFiles.push({
      filepath: writePath, // the path to which we'll copy the file.
      file: f,
    });

    localFiles = localFiles.concat(collectImportFiles(f, path.dirname(relPath)));
  }

  const uniqueLocalFiles = [];
  const uniquePaths = [];
  localFiles.forEach(obj => {
    if (!uniquePaths.includes(obj.filepath)) {
      uniqueLocalFiles.push(obj);
      uniquePaths.push(obj.filepath);
    }
  });
  return uniqueLocalFiles;
};

/**
 * Parses the boilerplate import statements, and grabs any common files.
 * @return {Object} - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
const editableCommitmentCommonFilesBoilerplate = () => {
  return collectImportFiles(OrchestrationCodeBoilerPlate({ nodeType: 'Imports' }).statements.join(''));
};

// newline / tab beautification for '.zok' files
const beautify = code => {
  // can't be bothered writing this yet
  const lines = code.split('\n');
  let newCode = '';
  let tabCount = 0;
  for (const line of lines) {
    const chars = line.split('');
    let newLine = '';
    for (const char of chars) {
      switch (char) {
        case '[':
          ++tabCount;
          newLine += `${char}\\\n${'\t'.repeat(tabCount)}`;
          break;
        case ']':
          --tabCount;
          newLine += `\\\n${'\t'.repeat(tabCount)}${char}`;
          break;
        default:
          newLine += char;
      }
    }
    newCode += newLine;
  }
  return newCode;
};

function codeGenerator(node) {
  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'Folder':
      return node.files.flatMap(codeGenerator);

    case 'File':
      return [
        {
          filepath: path.join(`./orchestration`, `${node.name}${node.fileExtension}`),
          file: node.nodes.map(codeGenerator).join(''),
        },
      ];

    case 'EditableCommitmentCommonFilesBoilerplate':
      return editableCommitmentCommonFilesBoilerplate();

    case 'FunctionDefinition': {
      node.parameters = node.parameters.parameters.map(codeGenerator);
      const fn = OrchestrationCodeBoilerPlate(node);
      const statements = codeGenerator(node.body);
      fn.statements.push(statements);
      return `${fn.signature[0]}\n\t${fn.statements.join('')}\n${fn.signature[1]}`;
    }

    case 'ParameterList':
      return node.parameters.map(paramnode => paramnode.name);

    case 'VariableDeclaration': {
      // const isPrivate = node.isPrivate ? 'private ' : '';
      return node.name;
    }

    case 'VariableDeclarationStatement': {
      const declarations = node.declarations.map(codeGenerator).join(', ');
      const initialValue = codeGenerator(node.initialValue);
      return `\nlet ${declarations} = ${initialValue};`;
    }

    case 'ElementaryTypeName':
      return;

    case 'Block':
      return node.statements.map(codeGenerator).join('  ');

    case 'ExpressionStatement':
      return codeGenerator(node.expression);

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide)} ${node.operator} ${codeGenerator(
        node.rightHandSide,
      )}`;

    case 'Identifier':
      return node.name;

    case 'ReadPreimage':
    case 'WritePreimage':
    case 'MembershipWitness':
    case 'CalculateNullifier':
    case 'CalculateCommitment':
    case 'GenerateProof':
    case 'SendTransaction':
    case 'Imports':
      return `${OrchestrationCodeBoilerPlate(node).statements.join('')}`;
    // And if we haven't recognized the node, we'll throw an error.
    default:
      return;
    // throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
