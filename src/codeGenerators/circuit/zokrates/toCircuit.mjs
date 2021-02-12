/* eslint-disable import/no-cycle, no-nested-ternary */
import fs from 'fs';
import path from 'path';
import logger from '../../../utils/logger.mjs';
import BP from '../../../boilerplate/circuit/zokrates/raw/BoilerplateGenerator.mjs';

const bp = new BP();

const boilerplateCircuitsDir = './circuits'; // relative to process.cwd() // TODO: move to a config?

/**
 * @param {string} file - a stringified file
 * @param {string} contextDirPath - the import statements of the `file` will be
 * relative to this dir. This path itself is relative to process.cwd().
 * @returns {Object} - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
const collectImportFiles = (file, contextDirPath = boilerplateCircuitsDir) => {
  const lines = file.split('\n');
  const ImportStatementList = lines.filter(line => line.startsWith('from'));
  let localFiles = [];
  // parse for imports of local (non-zokrates-stdlib) files:
  const localFilePaths = ImportStatementList.reduce((acc, line) => {
    let importFilePath = line.match(/"(.*?)"/g)[0].replace(/"/g, ''); // get text between quotes; i.e. the import filepaths
    importFilePath += path.extname(importFilePath) === '.zok' ? '' : '.zok'; // ensure file extension.
    // We need to provide common files which _aren't_ included in the zokrates stdlib. Stdlib filepaths start with the following:
    if (
      !(
        importFilePath.startsWith('utils') ||
        importFilePath.startsWith('ecc') ||
        importFilePath.startsWith('hashes') ||
        importFilePath.startsWith('signatures')
      )
    )
      acc.push(importFilePath);
    return acc;
  }, []);

  // collect the import files and their paths:
  for (const p of localFilePaths) {
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
  switch (node.nodeType) {
    case 'Folder':
      return BP.uniqueify(node.files.flatMap(codeGenerator));

    case 'File': {
      const filepath = path.join(boilerplateCircuitsDir, `${node.fileName}${node.fileExtension}`);
      const file = node.nodes.map(codeGenerator).join('\n\n');
      const thisFile = {
        filepath,
        file,
      };
      const importedFiles = collectImportFiles(file);
      return [thisFile, ...importedFiles];
    }

    case 'ImportStatementList':
      return `${BP.uniqueify(node.imports.flatMap(codeGenerator)).join('\n')}`;

    case 'FunctionDefinition': {
      const functionSignature = `def main(\\\n\t${codeGenerator(node.parameters)}\\\n) -> ():`;
      const body = codeGenerator(node.body);
      return `${functionSignature}

        ${body}

        return
        `;
    }

    case 'ParameterList':
      return BP.uniqueify(node.parameters.flatMap(codeGenerator)).join(',\\\n\t');

    case 'VariableDeclaration': {
      const visibility =
        node.declarationType === 'parameter' ? (node.isPrivate ? 'private ' : 'public ') : '\t\t';
      return `${visibility}${codeGenerator(node.typeName)} ${node.name}`;
    }

    case 'VariableDeclarationStatement': {
      const declarations = node.declarations.map(codeGenerator).join(', ');
      const initialValue = codeGenerator(node.initialValue);
      return `${declarations} = ${initialValue}`;
    }

    case 'ElementaryTypeName':
      return node.name;

    case 'Block': {
      const preStatements = BP.uniqueify(node.preStatements.flatMap(codeGenerator));
      const statements = BP.uniqueify(node.statements.flatMap(codeGenerator));
      const postStatements = BP.uniqueify(node.postStatements.flatMap(codeGenerator));
      return [...preStatements, ...statements, ...postStatements].join('\n\n');
    }

    case 'ExpressionStatement':
      return codeGenerator(node.expression);

    case 'Assignment':
      return `
        ${codeGenerator(node.leftHandSide)} ${node.operator} ${codeGenerator(node.rightHandSide)}`;

    case 'BinaryOperation':
      return `${codeGenerator(node.leftExpression)} ${node.operator} ${codeGenerator(
        node.rightExpression,
      )}`;

    case 'Identifier':
      return node.name;

    case 'Literal':
      return node.value;

    case 'Assert':
      return `
        assert(${node.args.flatMap(codeGenerator)})`;

    case 'Boilerplate':
      return bp.generateBoilerplate(node);

    case 'BoilerplateStatement': {
      return bp.generateBoilerplate(node);
    }

    // And if we haven't recognized the node, we'll throw an error.
    default:
      return;
    // throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
