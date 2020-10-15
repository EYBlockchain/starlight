import logger from '../utils/logger.mjs';

const EditableCommitmentImportsBoilerplate = [
  'from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256',
  'from "utils/pack/bool/pack256.zok" import main as bool_256_to_field',
  'from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256',
  'from "utils/pack/u32/pack256.zok"  import main as u32_8_to_field',
  'from "./common/merkle-tree/mimc/bn254/verify-membership/height32.zok" import main as checkRoot',
  'from "./common/hashes/sha256/pad256ThenHash.zok" import main as sha256of256',
  'from "./common/hashes/sha256/pad512ThenHash.zok" import main as sha256of512',
];

const EditableCommitmentStatementsBoilerplate = privateStateName => {
  const x = privateStateName;
  return [
    `assert(\\
    \t\ta == ${x}_oldCommitment_privateState\\
    \t)`,
    `assert(\\
    \t\t${x}_oldCommitment_commitment == sha256of512(\\
    \t\t\t[\\
    \t\t\t\t...${x}_oldCommitment_privateState,\\
    \t\t\t\t...${x}_oldCommitment_salt\\
    \t\t\t]\\
    \t\t)\\
    \t)`,
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
      return node.files.map(codeGenerator).join('\n\n');

    case 'File':
      return node.nodes.map(codeGenerator).join('\n\n');

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
      const isPrivate = node.isPrivate ? 'private' : '';
      return `${isPrivate} ${codeGenerator(node.typeName)} ${node.name}`;
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
      return EditableCommitmentStatementsBoilerplate(node.privateStateName).join('\n\t');

    // And if we haven't recognized the node, we'll throw an error.
    default:
      return;
      // throw new TypeError(node.type);
  }
}

export { codeGenerator as default };
