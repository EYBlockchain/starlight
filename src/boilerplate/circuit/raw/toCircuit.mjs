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
