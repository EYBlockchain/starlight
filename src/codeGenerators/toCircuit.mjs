import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.mjs';

// TODO: move to a config?
const boilerplateCircuitsDir = './circuits';

const EditableCommitmentImportsBoilerplate = [
  'from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256',
  'from "utils/pack/bool/pack256.zok" import main as bool_256_to_field',
  'from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256',
  'from "utils/pack/u32/pack256.zok"  import main as u32_8_to_field',
  'from "./common/merkle-tree/mimc/bn254/verify-membership/height32.zok" import main as checkRoot',
  'from "./common/hashes/sha256/pad256ThenHash.zok" import main as sha256of256',
  'from "./common/hashes/sha256/pad512ThenHash.zok" import main as sha256of512',
];

/**
 * Parses the boilerplate import statements, and grabs any common files.
 * @return {Object} - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
const editableCommitmentCommonFilesBoilerplate = () => {
  const localCommonFiles = [];
  const localCommonFilePaths = EditableCommitmentImportsBoilerplate.reduce((acc, line) => {
    const importFilePath = line.match(/"(.*?)"/g)[0].replace(/"/g, ''); // get text between quotes; i.e. the import filepaths
    // We need to provide common files which aren't included in the zokrates stdlib. These are identifiable by their relative filepaths (starting with './'):
    if (importFilePath.startsWith('./')) acc.push(importFilePath);
    return acc;
  }, []);
  for (const p of localCommonFilePaths) {
    const sourceFilePath = path.join(boilerplateCircuitsDir, p);
    localCommonFiles.push({
      filepath: p,
      file: fs.readFileSync(sourceFilePath, 'utf8'),
    });
  }
  return localCommonFiles;
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
 * @returns {Array} boilerplate lines of code, named w.r.t. the private state
 */
const EditableCommitmentStatementsBoilerplate = privateStateName => {
  const x = privateStateName;
  return [
    `assert(\\
    \ta == ${x}_oldCommitment_privateState\\
    )`,
    `assert(\\
    \t${x}_oldCommitment_commitment == sha256of512(\\
    \t\t[\\
    \t\t\t...${x}_oldCommitment_privateState,\\
    \t\t\t...${x}_oldCommitment_salt\\
    \t\t]\\
    \t)\\
    )`,
    `field ${x}_oldCommitment_commitment_truncated = bool_256_to_field([...[false; 8], ...u32_8_to_bool_256(${x}_oldCommitment_commitment)[8..256]])`,
    `field rootCheck = checkRoot(${x}_oldCommitment_membershipWitness_siblingPath, ${x}_oldCommitment_commitment_truncated, ${x}_oldCommitment_membershipWitness_index)`,
    'assert(field_to_bool_256(nullifier)[8..256] == u32_8_to_bool_256(nullifierCheck)[8..256])',
    'assert(field_to_bool_256(root)[8..256] == field_to_bool_256(rootCheck)[8..256])',
    'u32[8] commitmentCheck = sha256of512([...newCommitmentPreimage.a, ...newCommitmentPreimage.salt])',
    'assert(field_to_bool_256(commitment)[8..256] == u32_8_to_bool_256(commitmentCheck)[8..256])',
  ];
};

function codeGenerator(node) {
  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'Folder':
      return node.files.flatMap(codeGenerator);

    case 'File':
      return [
        {
          filepath: `${node.name}.zok`,
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
      return EditableCommitmentStatementsBoilerplate(node.privateStateName).join('\n\n\t');

    // And if we haven't recognized the node, we'll throw an error.
    default:
      return;
      // throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
