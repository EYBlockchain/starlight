export const EditableCommitmentImportStatementsBoilerplate = [0];
//   'from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256',
//   'from "utils/pack/bool/pack256.zok" import main as bool_256_to_field',
//   'from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8',
//   'from "utils/pack/u32/pack256.zok" import main as u32_8_to_field',
//   'from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256',
//   'from "./common/merkle-tree/mimc/altbn254/verify-membership/height32.zok" import main as checkRoot',
//   'from "./common/hashes/sha256/pad768ThenHash.zok" import main as sha256of768',
//   'from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024',
// ];

export const editableCommitmentParametersBoilerplate = [0]; //= privateStateName => {
//   const x = privateStateName;
//   return [
//     `private bool ${x}_oldCommitment_isDummy`,
//     `private u32[8] ${x}_stateVarId`,
//     `private u32[8] ${x}_oldCommitment_value`,
//     `private u32[8] ${x}_oldCommitment_owner_publicKey`,
//     `private u32[8] ${x}_oldCommitment_salt`,
//     `private field ${x}_oldCommitment_membershipWitness_index`,
//     `private field[32] ${x}_oldCommitment_membershipWitness_siblingPath`,
//     `private u32[8] ${x}_oldCommitment_owner_secretKey`,
//     `public field ${x}_oldCommitment_nullifier`,
//     `private u32[8] ${x}_newCommitment_value`,
//     `private u32[8] ${x}_newCommitment_owner_publicKey`,
//     `private u32[8] ${x}_newCommitment_salt`,
//     `public field ${x}_newCommitment_commitment`,
//   ]; // TODO tree height config
// };

// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we simplify a mapping's commitment's preimage by not having the extra inner hash?

export const nullification = {
  importStatements: [
    `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
    `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
    `from "./common/hashes/sha256/pad768ThenHash.zok" import main as sha256of768`,
  ],

  parameters(privateStateName) {
    const x = privateStateName;
    return [
      `private u32[8] ${x}_oldCommitment_owner_secretKey`,
      `public field ${x}_oldCommitment_nullifier`,
    ];
  },

  statements(
    privateStateName,
    { isWhole, isPartitioned, isNullified, isConsulted, isMapping, isMerged },
  ) {
    const x = privateStateName;

    // default nullification lines (for partitioned & whole states)
    const lines = [
      `
        u32[8] ${x}_oldCommitment_nullifier_check = sha256of768([...${x}_stateVarId, ...${x}_oldCommitment_owner_secretKey, ...${x}_oldCommitment_salt])

        assert(\
          field_to_bool_256(${x}_oldCommitment_nullifier)[8..256] == u32_8_to_bool_256(${x}_oldCommitment_nullifier_check)[8..256]\
        )
      `,
    ];

    if (isWhole) {
      // whole states also need to handle the case of a dummy nullifier
      const newLines = [
        `
          ${x}_oldCommitment_owner_secretKey = if ${x}_oldCommitment_isDummy then [0x00000000; 8] else ${x}_oldCommitment_owner_secretKey fi

          ${x}_oldCommitment_salt = if ${x}_oldCommitment_isDummy then [0x00000000; 8] else ${x}_oldCommitment_salt fi
        `,
      ];
      newLines.concat(lines);
    }
  },
};

export const mapping = {
  importStatments: [
    `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
    `from "./common/hashes/mimc/altbn254/mimc2.zok" import main as mimc2`,
  ],

  parameters(mappingName, mappingKeyName) {
    const m = mappingName;
    const k = mappingKeyName;
    return [
      `private field ${m}_mappingId`,
      `private field ${k}`, // must be a field, in case we need to do arithmetic on it.
    ];
  },

  statements(mappingName, mappingKeyName) {
    const m = mappingName;
    const k = mappingKeyName;
    const privateStateName = `${m}_${k}`;
    const x = privateStateName;
    return [
      `field ${x}_stateVarId_field = mimc2(${m}_mappingId, ${k})`,

      `u32[8] ${x}_stateVarId = field_to_u32_8(${x}_stateVarId_field)`, // convert to u32[8], for later sha256 hashing
    ];
  },
};

export const oldCommitmentPreimage = {
  importStatements: [
    `from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024`,
  ],

  parameters(privateStateName) {
    const x = privateStateName;
    return [
      `private u32[8] ${x}_oldCommitment_value`,
      `private u32[8] ${x}_oldCommitment_owner_publicKey`,
      `private u32[8] ${x}_oldCommitment_salt`,
    ];
  },

  statements(privateStateName) {
    const x = privateStateName;
    return [
      `
        // old commitments - preimage checks

      	u32[8] ${x}_oldCommitment_commitment = sha256of1024([\
          ...${x}_stateVarId,\
          ...${x}_oldCommitment_value,\
          ...${x}_oldCommitment_owner_publicKey,\
          ...${x}_oldCommitment_salt
        ])
      `,
    ];
  },
};

export const oldCommitmentExistence = {
  importStatements: [
    `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
    `from "utils/pack/bool/pack256.zok" import main as bool_256_to_field`,
    `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
    `from "./common/merkle-tree/mimc/altbn254/verify-membership/height32.zok" import main as checkRoot`,
  ],

  parameters(privateStateName, { isWhole }) {
    const x = privateStateName;
    const lines = [
      `private u32[8] ${x}_oldCommitment_value`,
      `private u32[8] ${x}_oldCommitment_owner_publicKey`,
      `private u32[8] ${x}_oldCommitment_salt`,
      `public field commitmentRoot`,
    ];
    if (isWhole) [`private bool ${x}_oldCommitment_isDummy`].concat(lines);
    return lines;
  },

  statements(privateStateName, { isWhole }) {
    const x = privateStateName;
    const lines = [
      `// old commitments - existence checks`,

      `field ${x}_oldCommitment_commitment_truncated = bool_256_to_field([...[false; 8], ...u32_8_to_bool_256(${x}_oldCommitment_commitment)[8..256]])`,

      `
        field ${x}_commitmentRoot_check = checkRoot(\
          ${x}_oldCommitment_membershipWitness_siblingPath,\
          ${x}_oldCommitment_commitment_truncated,\
          ${x}_oldCommitment_membershipWitness_index\
        )
      `,

      `assert(\
    		field_to_bool_256(commitmentRoot)[8..256] == field_to_bool_256(${x}_commitmentRoot_check)[8..256]\
    	)`,
    ];

    if (isWhole)
      // initialisation of whole states requires a dummy oldCommitment to be ignored.
      lines.splice(
        -1,
        0,
        `
          // Note: Don't bother checking existence, if the oldCommitment is a dummy:
          field ${x}_commitmentRoot_check = if ${x}_oldCommitment_isDummy == true then commitmentRoot else ${x}_commitmentRoot_check fi
        `,
      );
  },
};

export const newCommitment = {
  importStatements: [
    `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
    `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
    `from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024`,
  ],

  parameters(privateStateName) {
    const x = privateStateName;
    return [
      `private u32[8] ${x}_newCommitment_value`,
      `private u32[8] ${x}_newCommitment_owner_publicKey`,
      `private u32[8] ${x}_newCommitment_salt`,
      `public field ${x}_newCommitment_commitment`,
    ];
  },

  statements(privateStateName) {
    const x = privateStateName;
    return [
      `
        // new commitments - preimage checks

      	u32[8] ${x}_newCommitment_commitment_check = sha256of1024([\
          ...${x}_stateVarId,\
          ...${x}_newCommitment_value,\
          ...${x}_newCommitment_owner_publicKey,\
          ...${x}_newCommitment_salt\
        ])

      	assert(\
      		field_to_bool_256(${x}_newCommitment_commitment)[8..256] == u32_8_to_bool_256(${x}_newCommitment_commitment_check)[8..256]\
      	)
      `,
    ];
  },
};

export const editableCommitmentStatementsBoilerplate = [0]; // (privateStateName, indicators) => {
//   const { isWhole, isPartitioned, isNullified, isConsulted, isMapping, isMerged } = indicators;
// }
