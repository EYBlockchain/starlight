export const boilerplateCircuitsDir = './circuits'; // relative to process.cwd() // TODO: move to a config?

export const EditableCommitmentImportsBoilerplate = [
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
 * @returns {Array} boilerplate lines of code, named w.r.t. the private state
 */
export const EditableCommitmentStatementsBoilerplate = privateStateName => {
  const x = privateStateName;
  return `// prepare secret states for commitment\n\n\t${x}_newCommitment_privateState = field_to_u32_8(a)\n\n\t// distinguish between the first and subsequent commitments\n\n\tbool skipNullification = if ${x}_oldCommitment_nullifier == 0 && commitmentRoot == 0 then true else false fi\n\n\t// old commitments - nullify\n\n\tu32[8] ${x}_oldCommitment_nullifier_check = if skipNullification == true then [0x00000000; 8] else sha256of256(${x}_oldCommitment_salt) fi\n\n\tassert(\\\n\t\tfield_to_bool_256(${x}_oldCommitment_nullifier)[8..256] == u32_8_to_bool_256(${x}_oldCommitment_nullifier_check)[8..256]\\\n\t)\n\n\t// old commitments - preimage checks\n\n\tu32[8] ${x}_oldCommitment_commitment = if skipNullification == true then [0x00000000; 8] else sha256of512([...${x}_oldCommitment_privateState, ...${x}_oldCommitment_salt]) fi\n\n\t// old commitments - existence checks\n\n\tfield ${x}_oldCommitment_commitment_truncated = bool_256_to_field([...[false; 8], ...u32_8_to_bool_256(${x}_oldCommitment_commitment)[8..256]])\n\n\tfield commitmentRoot_check = if skipNullification == true then 0 else  checkRoot(${x}_oldCommitment_membershipWitness_siblingPath, ${x}_oldCommitment_commitment_truncated, ${x}_oldCommitment_membershipWitness_index) fi\n\n\tassert(\\\n\t\tfield_to_bool_256(commitmentRoot)[8..256] == field_to_bool_256(commitmentRoot_check)[8..256]\\\n\t)\n\n\t// new commitments - preimage checks\n\n\tu32[8] ${x}_newCommitment_commitment_check = sha256of512([...${x}_newCommitment_privateState, ...${x}_newCommitment_salt])\n\n\tassert(\\\n\t\tfield_to_bool_256(${x}_newCommitment_commitment)[8..256] == u32_8_to_bool_256(${x}_newCommitment_commitment_check)[8..256]\\\n\t)`;
};
