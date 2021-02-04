/* eslint-disable import/no-cycle */

// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.

import codeGenerator from '../../../../codeGenerators/circuit/zokrates/toCircuit.mjs';

class BoilerplateGenerator {
  bpSections = {
    static: ['importStatements', 'parameters', 'preStatements', 'postStatements'],
    dynamic: ['statements'],
  };

  generateBoilerplate(node) {
    const { bpSection, bpType, ...otherParams } = node;
    // console.log('bpType', bpType)
    // console.log('bpSection', bpSection)
    // console.log('this[bpType]', this[bpType])
    // console.log('this[bpType][bpSection]', this[bpType][bpSection])
    return this[bpType][bpSection] ? this[bpType][bpSection](otherParams) : [];
  }

  static uniqueify(arr) {
    return Array.from(new Set(arr));
  }

  PoKoSK = {
    importStatements() {
      return [`from "./common/hashes/sha256/pad256ThenHash.zok" import main as sha256of256`];
    },

    parameters({ name: x }) {
      return [`private u32[8] ${x}_oldCommitment_owner_secretKey`];
    },

    postStatements({ name: x }) {
      // default nullification lines (for partitioned & whole states)
      return [
        `
          // ${x}_oldCommitment - PoKoSK:
          // The correctness of this secret key will be constrained within the oldCommitment existence check.

          u32[8] ${x}_oldCommitment_owner_publicKey = sha256of256([...${x}_oldCommitment_owner_secretKey])`,
      ];
    },
  };

  nullification = {
    importStatements() {
      return [
        `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
        `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
        `from "./common/hashes/sha256/pad768ThenHash.zok" import main as sha256of768`,
      ];
    },

    parameters({ name: x }) {
      return [
        `private u32[8] ${x}_oldCommitment_owner_secretKey`,
        `public field ${x}_oldCommitment_nullifier`,
      ];
    },

    postStatements({ name: x }) {
      // default nullification lines (for partitioned & whole states)
      const lines = [
        `
          // Nullify ${x}:

          u32[8] ${x}_oldCommitment_nullifier_check = sha256of768([\\
            ...${x}_stateVarId,\\
            ...${x}_oldCommitment_owner_secretKey,\\
            ...${x}_oldCommitment_salt\\
          ])

          assert(\\
            field_to_bool_256(${x}_oldCommitment_nullifier)[8..256] == u32_8_to_bool_256(${x}_oldCommitment_nullifier_check)[8..256]\\
          )`,
      ];

      if (this.isWhole) {
        // whole states also need to handle the case of a dummy nullifier
        const newLines = [
          `
            ${x}_oldCommitment_owner_secretKey = if ${x}_oldCommitment_isDummy then [0x00000000; 8] else ${x}_oldCommitment_owner_secretKey fi

            ${x}_oldCommitment_salt = if ${x}_oldCommitment_isDummy then [0x00000000; 8] else ${x}_oldCommitment_salt fi`,
        ];
        newLines.concat(lines);
      }

      return lines;
    },
  };

  mapping = {
    importStatments() {
      return [
        `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
        `from "./common/hashes/mimc/altbn254/mimc2.zok" import main as mimc2`,
      ];
    },

    parameters({ mappingName: m, mappingKeyName: k }) {
      return [
        `private field ${m}_mappingId`,
        `private field ${k}`, // must be a field, in case we need to do arithmetic on it.
      ];
    },

    postStatements({ mappingName: m, mappingKeyName: k }) {
      const x = `${m}_${k}`;
      return [
        `field ${x}_stateVarId_field = mimc2(${m}_mappingId, ${k})`,

        `u32[8] ${x}_stateVarId = field_to_u32_8(${x}_stateVarId_field)`, // convert to u32[8], for later sha256 hashing
      ];
    },
  };

  oldCommitmentPreimage = {
    importStatements() {
      return [
        `from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024`,
        `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
      ];
    },

    parameters({ name: x }) {
      // prettier-ignore
      return [
        `private u32[8] ${x}_stateVarId`,
        `private field ${x}_oldCommitment_value`,
        `private u32[8] ${x}_oldCommitment_salt`,
      ];
    },

    preStatements({ name: x }) {
      // For a state variable, we'll have passed in `${x}_oldCommitment_value` as a parameter. But our AST nodes will be using `${x}`. This line resolves the two.
      return [
        `
          field ${x} = ${x}_oldCommitment_value`,
      ];
    },

    postStatements({ name: x }) {
      return [
        `
          // ${x}_oldCommitment_commitment: preimage check

          u32[8] ${x}_oldCommitment_commitment = sha256of1024([\\
            ...${x}_stateVarId,\\
            ...field_to_u32_8(${x}_oldCommitment_value),\\
            ...${x}_oldCommitment_owner_publicKey,\\
            ...${x}_oldCommitment_salt\\
          ])`,
      ];
    },
  };

  oldCommitmentExistence = {
    importStatements() {
      return [
        `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
        `from "utils/pack/bool/pack256.zok" import main as bool_256_to_field`,
        `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
        `from "./common/merkle-tree/mimc/altbn254/verify-membership/height32.zok" import main as checkRoot`,
      ];
    },

    parameters({ name: x, isWhole }) {
      const lines = [
        `public field commitmentRoot`,
        `private field ${x}_oldCommitment_membershipWitness_index`,
        `private field[32] ${x}_oldCommitment_membershipWitness_siblingPath`,
      ];
      if (isWhole) {
        lines.unshift(`private bool ${x}_oldCommitment_isDummy`);
      }
      return lines;
    },

    postStatements({ name: x, isWhole }) {
      const lines = [
        `
          // ${x}_oldCommitment_commitment: existence check`,

        `
          field ${x}_oldCommitment_commitment_truncated = bool_256_to_field([...[false; 8], ...u32_8_to_bool_256(${x}_oldCommitment_commitment)[8..256]])`,

        `
          field ${x}_commitmentRoot_check = checkRoot(\\
            ${x}_oldCommitment_membershipWitness_siblingPath,\\
            ${x}_oldCommitment_commitment_truncated,\\
            ${x}_oldCommitment_membershipWitness_index\\
          )`,

        `
          assert(\\
            field_to_bool_256(commitmentRoot)[8..256] == field_to_bool_256(${x}_commitmentRoot_check)[8..256]\\
          )`,
      ];

      if (isWhole) {
        // initialisation of whole states requires a dummy oldCommitment to be ignored.
        lines.splice(
          -1,
          0,
          `
            // Note: Don't bother actually asserting existence, if the oldCommitment is a dummy:
            ${x}_commitmentRoot_check = if ${x}_oldCommitment_isDummy == true then commitmentRoot else ${x}_commitmentRoot_check fi`,
        );
      }
      return lines;
    },
  };

  newCommitment = {
    importStatements() {
      return [
        `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
        `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
        `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
        `from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024`,
      ];
    },

    parameters({ name: x }) {
      return [
        `private u32[8] ${x}_stateVarId`,
        `private u32[8] ${x}_newCommitment_owner_publicKey`,
        `private u32[8] ${x}_newCommitment_salt`,
        `public field ${x}_newCommitment_commitment`,
      ];
    },

    postStatements({ name: x }) {
      return [
        `
          // prepare secret state '${x}' for commitment

          u32[8] ${x}_newCommitment_value = field_to_u32_8(${x})

          // ${x}_newCommitment_commitment - preimage check

          u32[8] ${x}_newCommitment_commitment_check = sha256of1024([\\
            ...${x}_stateVarId,\\
            ...${x}_newCommitment_value,\\
            ...${x}_newCommitment_owner_publicKey,\\
            ...${x}_newCommitment_salt\\
          ])

          assert(\\
            field_to_bool_256(${x}_newCommitment_commitment)[8..256] == u32_8_to_bool_256(${x}_newCommitment_commitment_check)[8..256]\\
          )`,
      ];
    },
  };

  incrementation = {
    importStatements() {
      return []; // TODO: we might eventually import some underflow/overflow functions.
    },

    statements({ name: x, startIndex: i, addend }) {
      const y = codeGenerator(addend);
      return [
        `
          // The below represents the incrementation '${x} = ${x} + ${y}':

          field ${x}_${i} = ${y}`,
      ];
    },
  };

  /** Partitioned states need boilerplate for a decrementation, because it's so weird and different from `a = a - b`. Whole states inherit directly from the AST, so don't need boilerplate here. */
  decrementation = {
    importStatements() {
      return []; // TODO: we might eventually import some underflow/overflow functions.
    },

    statements({ name: x, startIndex, subtrahend }) {
      const y = codeGenerator(subtrahend);
      let i = startIndex;
      const x0 = `${x}_${i++}`;
      const x1 = `${x}_${i++}`;
      const x2 = `${x}_${i++}`;
      const x3 = `${x}_${i}`;

      return [
        `
          // The below represents the decrementation '${x} = ${x} - ${y}':

          field ${x2} = ${y}

          assert(${x0} + ${x1} > ${x2})
          // TODO: assert no under/overflows

          field ${x3} = (${x0} + ${x1}) - ${x2}`,
      ];
    },
  };
}

export default BoilerplateGenerator;
