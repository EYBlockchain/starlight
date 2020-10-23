import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.mjs';

// TODO: move to a config?
const boilerplateCircuitsDir = './circuits'; // relative to process.cwd()

const EditableCommitmentImportsBoilerplate = [
  'from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256',
  'from "utils/pack/bool/pack256.zok" import main as bool_256_to_field',
  'from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8',
  'from "utils/pack/u32/pack256.zok" import main as u32_8_to_field',
  'from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256',
  'from "./common/merkle-tree/mimc/bn254/verify-membership/height32.zok" import main as checkRoot',
  'from "./common/hashes/sha256/pad256ThenHash.zok" import main as sha256of256',
  'from "./common/hashes/sha256/pad512ThenHash.zok" import main as sha256of512',
];

/**
 * @param {string} file - a stringified file
 * @param {string} contextDirPath - the import statements of the `file` will be
 * relative to this dir. This path itself is relative to process.cwd().
 * @returns {Object} - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
const collectImportFiles = (file, contextDirPath = boilerplateCircuitsDir) => {
  const lines = file.split('\n');
  const importStatements = lines.filter(line => line.startsWith('from'));
  let localFiles = [];
  // parse for imports of local (non-zokrates-stdlib) files:
  const localFilePaths = importStatements.reduce((acc, line) => {
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

/**
 * Parses the boilerplate import statements, and grabs any common files.
 * @return {Object} - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
const editableCommitmentCommonFilesBoilerplate = () => {
  return collectImportFiles(EditableCommitmentImportsBoilerplate.join('\n'));
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

/**
 * @returns {Array[string]} boilerplate lines of code, named w.r.t. the private state
 */
const EditableCommitmentStatementsBoilerplate = privateStateName => {
  const x = privateStateName;
  return `// prepare secret states for commitment\n\n\t${x}_newCommitment_privateState = field_to_u32_8(a)\n\n\t// distinguish between the first and subsequent commitments\n\n\tbool skipNullification = if ${x}_oldCommitment_nullifier == 0 && commitmentRoot == 0 then true else false fi\n\n\t// old commitments - nullify\n\n\tu32[8] ${x}_oldCommitment_nullifier_check = if skipNullification == true then [0x00000000; 8] else sha256of256(${x}_oldCommitment_salt) fi\n\n\tassert(\\\n\t\tfield_to_bool_256(${x}_oldCommitment_nullifier)[8..256] == u32_8_to_bool_256(${x}_oldCommitment_nullifier_check)[8..256]\\\n\t)\n\n\t// old commitments - preimage checks\n\n\tu32[8] ${x}_oldCommitment_commitment = if skipNullification == true then [0x00000000; 8] else sha256of512([...${x}_oldCommitment_privateState, ...${x}_oldCommitment_salt]) fi\n\n\t// old commitments - existence checks\n\n\tfield ${x}_oldCommitment_commitment_truncated = bool_256_to_field([...[false; 8], ...u32_8_to_bool_256(${x}_oldCommitment_commitment)[8..256]])\n\n\tfield commitmentRoot_check = if skipNullification == true then 0 else  checkRoot(${x}_oldCommitment_membershipWitness_siblingPath, ${x}_oldCommitment_commitment_truncated, ${x}_oldCommitment_membershipWitness_index) fi\n\n\tassert(\\\n\t\tfield_to_bool_256(commitmentRoot)[8..256] == field_to_bool_256(commitmentRoot_check)[8..256]\\\n\t)\n\n\t// new commitments - preimage checks\n\n\tu32[8] ${x}_newCommitment_commitment_check = sha256of512([...${x}_newCommitment_privateState, ...${x}_newCommitment_salt])\n\n\tassert(\\\n\t\tfield_to_bool_256(${x}_newCommitment_commitment)[8..256] == u32_8_to_bool_256(${x}_newCommitment_commitment_check)[8..256]\\\n\t)`;
};

function codeGenerator(node) {
  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'Folder':
      return node.files.flatMap(codeGenerator);

    case 'File':
      return [
        {
          filepath: path.join(boilerplateCircuitsDir, `${node.name}.zok`),
          file: node.nodes.map(codeGenerator).join('\n\n'),
        },
      ];

    case 'EditableCommitmentCommonFilesBoilerplate':
      return editableCommitmentCommonFilesBoilerplate();

    case 'ImportStatements':
      return `${node.imports.map(codeGenerator).join('\n')}`;

    case 'EditableCommitmentImportsBoilerplate':
      return EditableCommitmentImportsBoilerplate.join('\n');

    case 'FunctionDefinition': {
      const functionSignature = `def main(\\\n\t${codeGenerator(node.parameters)}\\\n) -> ():`;
      const body = codeGenerator(node.body);
      return `${functionSignature}\n\n\t${body}\n\n\treturn`;
    }

    case 'ParameterList':
      return node.parameters.map(codeGenerator).join(',\\\n\t');

    case 'VariableDeclaration': {
      const isPrivate = node.isPrivate ? 'private ' : '';
      return `${isPrivate}${codeGenerator(node.typeName)} ${node.name}`;
    }

    case 'VariableDeclarationStatement': {
      const declarations = node.declarations.map(codeGenerator).join(', ');
      const initialValue = codeGenerator(node.initialValue);
      return `${declarations} = ${initialValue}`;
    }

    case 'ElementaryTypeName':
      return node.name;

    case 'Block':
      return node.statements.map(codeGenerator).join('\n\n\t');

    case 'ExpressionStatement':
      return codeGenerator(node.expression);

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide)} ${node.operator} ${codeGenerator(
        node.rightHandSide,
      )}`;

    case 'Identifier':
      return node.name;

    case 'EditableCommitmentStatementsBoilerplate':
      return EditableCommitmentStatementsBoilerplate(node.privateStateName);

    // And if we haven't recognized the node, we'll throw an error.
    default:
      return;
      // throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
