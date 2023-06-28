/* eslint-disable import/no-cycle */

// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.

class BoilerplateGenerator {
  generateBoilerplate(node: any) {
    const { bpSection, bpType, ...otherParams } = node;
    return this?.[bpType]?.[bpSection]?.(otherParams) ?? [];
  }

  static uniqueify(arr: any[]) {
    return Array.from(new Set(arr));
  }

  PoKoSK = {
    importStatements(): string[] {
      return [
      `from "ecc/babyjubjubParams" import main as curveParams`,
      `from "ecc/edwardsScalarMult" import main as scalarMult`,
      `from "ecc/edwardsCompress" import main as edwardsCompress`,
      `from "utils/pack/bool/pack256.zok" import main as bool_256_to_field`,
      `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
      ];
    },

    parameters({ name: x }): string[] {
      return [`private field ${x}_oldCommitment_owner_secretKey`];
    },

    postStatements({ name: x }): string[] {
      // default nullification lines (for partitioned & whole states)
      return [
        `
        // ${x}_oldCommitment - PoKoSK:
        // The correctness of this secret key will be constrained within the oldCommitment existence check.

        field[2] ${x}_oldCommitment_owner_publicKey_point = scalarMult(field_to_bool_256(${x}_oldCommitment_owner_secretKey), [curveParams().Gu, curveParams().Gv], curveParams())

        bool ${x}_oldCommitment_owner_publicKey_sign = edwardsCompress(${x}_oldCommitment_owner_publicKey_point)[0]

        bool[254] ${x}_oldCommitment_yBits = field_to_bool_256(${x}_oldCommitment_owner_publicKey_point[1])[2..256]
        ${x}_oldCommitment_yBits[0] = ${x}_oldCommitment_owner_publicKey_sign

        field ${x}_oldCommitment_owner_publicKey = bool_256_to_field([false, false, ...${x}_oldCommitment_yBits])`,
      ];
    },
  };

  nullification = {
    importStatements(): string[] {
      return [
        `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
        `from "./common/hashes/poseidon/poseidon.zok" import main as poseidon`,
        `from "./common/merkle-tree/sparse-merkle-tree/checkproof.zok" import main as checkproof`,
        `from "./common/merkle-tree/sparse-merkle-tree/checkproof.zok" import checkUpdatedPath as checkUpdatedPath`,
      ];
    },

    parameters({ name: x, isAccessed, isNullified }): string[] {
      let para = [
        `private field ${x}_oldCommitment_owner_secretKey`,
        `public field nullifierRoot`,
        `public field newNullifierRoot`,
        `public field ${x}_oldCommitment_nullifier`,
        `private field[32] ${x}_nullifier_nonmembershipWitness_siblingPath`,
        `private field[32] ${x}_nullifier_nonmembershipWitness_newsiblingPath`,
        
      ]
      if(isAccessed && !isNullified) 
       para = [
        `private field ${x}_oldCommitment_owner_secretKey`,
        `public field nullifierRoot`,
        `private field[32] ${x}_nullifier_nonmembershipWitness_siblingPath`,
      ]

      return para;
    },

    preStatements({ name: x, id, isMapping }): string[] {
      if (isMapping) return [];
      return [
        `
        // We need to hard-code each stateVarId into the circuit:
        field ${x}_stateVarId_field = ${id}`
         // TODO: this results in unnecessary unpacking constraints, but simplifies transpilation effort, for now.
      ];
    },

    postStatements({ name: x , isAccessed, isNullified}): string[] {
      // default nullification lines (for partitioned & whole states)
      let lines = [
        `
        // Nullify ${x}:

        field ${x}_oldCommitment_nullifier_check_field = poseidon([\\
          ${x}_stateVarId_field,\\
          ${x}_oldCommitment_owner_secretKey,\\
          ${x}_oldCommitment_salt\\
        ])

        assert(\\
        field_to_bool_256(${x}_oldCommitment_nullifier)[8..256] == field_to_bool_256(${x}_oldCommitment_nullifier_check_field)[8..256]\\
        )
        // ${x}_oldCommitment_nullifier : non-existence check
        
        assert(\\
          nullifierRoot == checkproof(\\
            ${x}_nullifier_nonmembershipWitness_siblingPath,\\
            ${x}_oldCommitment_nullifier\\
           )\
       )

       assert(\\
        newNullifierRoot == checkUpdatedPath(\\
          ${x}_nullifier_nonmembershipWitness_newsiblingPath,\\
          ${x}_oldCommitment_nullifier\\
        )\
        )

        `,
      ];

      if(isAccessed && !isNullified) 
      lines = [
        `
        // Create the Nullifier  for ${x} and no need to nnullify it as its accessed only:

        field ${x}_oldCommitment_nullifier = poseidon([\\
          ${x}_stateVarId_field,\\
          ${x}_oldCommitment_owner_secretKey,\\
          ${x}_oldCommitment_salt\\
        ])

        // ${x}_oldCommitment_nullifier : non-existence check
        
        assert(\\
          nullifierRoot == checkproof(\\
            ${x}_nullifier_nonmembershipWitness_siblingPath,\\
            ${x}_oldCommitment_nullifier\\
           )\
       )
        `,
      ];

     
      if (this.initialisationRequired && this.isWhole) {
        // whole states also need to handle the case of a dummy nullifier
        const newLines = [
          `
          ${x}_oldCommitment_owner_secretKey = if ${x}_oldCommitment_isDummy then 0 else ${x}_oldCommitment_owner_secretKey fi

          ${x}_oldCommitment_salt = if ${x}_oldCommitment_isDummy then 0 else ${x}_oldCommitment_salt fi`,
        ];
        newLines.concat(lines);
      }

      return lines;
    },
  };

  oldCommitmentPreimage = {
    importStatements(): string[] {
      return [
        `from "./common/hashes/poseidon/poseidon.zok" import main as poseidon`,
      ];
    },

    parameters({ name: x, typeName }): string[] {
      // prettier-ignore
      return [
        `private  ${typeName ? typeName : 'field'} ${x}_oldCommitment_value`,
        `private field ${x}_oldCommitment_salt`,
      ];
    },

    preStatements({ name: x, typeName }): string[] {
      // For a state variable, we'll have passed in `${x}_oldCommitment_value` as a parameter. But our AST nodes will be using `${x}`. This line resolves the two.
      return [
        `
        ${typeName ? typeName : 'field'} ${x} = ${x}_oldCommitment_value`,
      ];
    },

    postStatements({ name: x, structProperties }): string[] {
      if (structProperties)
        return [
          `
          // ${x}_oldCommitment_commitment: preimage check

          field ${x}_oldCommitment_commitment_field = poseidon([\\
            ${x}_stateVarId_field,\\
            ${structProperties.map(p => `\t ${x}_oldCommitment_value.${p},\\`).join('\n')}
            ${x}_oldCommitment_owner_publicKey,\\
            ${x}_oldCommitment_salt\\
          ])`,
        ];
      return [
        `
        // ${x}_oldCommitment_commitment: preimage check


        field ${x}_oldCommitment_commitment_field = poseidon([\\
          ${x}_stateVarId_field,\\
          ${x}_oldCommitment_value,\\
          ${x}_oldCommitment_owner_publicKey,\\
          ${x}_oldCommitment_salt\
        ])`,
      ];
    },
  };

  oldCommitmentExistence = {
    importStatements(): string[] {
      return [
        `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
        `from "./common/merkle-tree/mimc/altbn254/verify-membership/height32.zok" import main as checkRoot`,
      ];
    },

    parameters({ name: x, initialisationRequired, isWhole }): string[] {
      const lines = [
        `public field commitmentRoot`,
        `private field ${x}_oldCommitment_membershipWitness_index`,
        `private field[32] ${x}_oldCommitment_membershipWitness_siblingPath`,
      ];
      if (isWhole && initialisationRequired) {
        lines.unshift(`private bool ${x}_oldCommitment_isDummy`);
      }
      return lines;
    },

    postStatements({ name: x, isWhole, isAccessed, isNullified, initialisationRequired }): string[] {
      const lines = [
        `
        // ${x}_oldCommitment_commitment: existence check`,

        `
        field ${x}_commitmentRoot_check = checkRoot(\\
          ${x}_oldCommitment_membershipWitness_siblingPath,\\
          ${x}_oldCommitment_commitment_field,\\
          ${x}_oldCommitment_membershipWitness_index\\
        )`,

        `
        assert(\\
          field_to_bool_256(commitmentRoot)[8..256] == field_to_bool_256(${x}_commitmentRoot_check)[8..256]\\
        )`
        ,
      ];

      if (isWhole && initialisationRequired) {
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
    importStatements(): string[] {
      return [
        `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
        `from "./common/hashes/poseidon/poseidon.zok" import main as poseidon`,
      ];
    },

    parameters({ name: x }): string[] {
      return [
        `private field ${x}_newCommitment_owner_publicKey`,
        `private field ${x}_newCommitment_salt`,
        `public field ${x}_newCommitment_commitment`,
      ];
    },

    preStatements({ name: x, id, isMapping }): string[] {
      if (isMapping) return [];
      return [
        `
        // We need to hard-code each stateVarId into the circuit:
        field ${x}_stateVarId_field = ${id}`,
        // TODO: this results in unnecessary unpacking constraints, but simplifies transpilation effort, for now.
      ];
    },

    postStatements({ name: x, isWhole, isNullified, newCommitmentValue, structProperties, typeName }): string[] {
      // if (!isWhole && !newCommitmentValue) throw new Error('PATH');
      const y = isWhole ? x : newCommitmentValue;
      const lines: string[] = [];
      if (!isWhole && isNullified) {
        // decrement
        const i = parseInt(x.slice(-1), 10);
        const x0 = x.slice(0, -1) + `${i-2}`;
        const x1 = x.slice(0, -1) + `${i-1}`;
        if (!structProperties) {
          lines.push(
            `assert(${x0} + ${x1} > ${y})
            // TODO: assert no under/overflows

            field ${x}_newCommitment_value_field = (${x0} + ${x1}) - (${y})`
          );
        } else {
          // TODO types for each structProperty
          lines.push(
            `${structProperties.map(p => newCommitmentValue[p] === '0' ? '' : `assert(${x0}.${p} + ${x1}.${p} >= ${y[p]})`).join('\n')}
            // TODO: assert no under/overflows

            ${typeName} ${x}_newCommitment_value = ${typeName} { ${structProperties.map(p => ` ${p}: (${x0}.${p} + ${x1}.${p}) - ${y[p]}`)} }`
          );
        }
      } else {
        if (!structProperties) lines.push(`field ${x}_newCommitment_value_field = ${y}`);
        else lines.push(`${typeName} ${x}_newCommitment_value = ${typeName} { ${structProperties.map(p => ` ${p}: ${isWhole ? `${y}.${p}` : `${y[p]}`}`)} }`)
      }

      if (structProperties)
        return [
          `
          // prepare secret state '${x}' for commitment

          ${lines}

          // ${x}_newCommitment_commitment - preimage check

          field ${x}_newCommitment_commitment_check_field = poseidon([\\
            ${x}_stateVarId_field,\\
            ${structProperties.map(p => `\t ${x}_newCommitment_value.${p},\\`).join('\n')}
            ${x}_newCommitment_owner_publicKey,\\
            ${x}_newCommitment_salt\\
          ])

          assert(\\
            field_to_bool_256(${x}_newCommitment_commitment)[8..256] == field_to_bool_256(${x}_newCommitment_commitment_check_field)[8..256]\\
          )`,
        ];

      return [
        `
        // prepare secret state '${x}' for commitment

        ${lines}

        // ${x}_newCommitment_commitment - preimage check

        field ${x}_newCommitment_commitment_check_field = poseidon([\\
          ${x}_stateVarId_field,\\
          ${x}_newCommitment_value_field,\\
          ${x}_newCommitment_owner_publicKey,\\
          ${x}_newCommitment_salt\\
        ])

        assert(\\
          field_to_bool_256(${x}_newCommitment_commitment)[8..256] == field_to_bool_256(${x}_newCommitment_commitment_check_field)[8..256]\\
        )`
        ,
      ];
    },
  };

  encryption = {
    importStatements(): string[] {
      return [
        `from "ecc/babyjubjubParams" import BabyJubJubParams`,
        `from "ecc/babyjubjubParams" import main as curveParams`,
        `from "ecc/edwardsScalarMult" import main as scalarMult`,
        `from "ecc/edwardsCompress" import main as edwardsCompress`,
        `from "utils/pack/bool/pack256.zok" import main as bool_256_to_field`,
        `from "utils/casts/u32_to_field" import main as u32_to_field`,
        `from "./common/hashes/poseidon/poseidon.zok" import main as poseidon`,
        `from "./common/encryption/kem-dem.zok" import main as enc`,
        `from "./common/encryption/kem-dem.zok" import EncryptedMsgs as EncryptedMsgs`,
      ];
    },

    parameters({ name: x }): string[] {
      return [
        `private field ${x}_newCommitment_ephSecretKey`,
        `private field[2] ${x}_newCommitment_owner_publicKey_point`,
      ];
    },

    preStatements({ name: x }): string[] {
      return [
        `
        // calculate ${x}_newCommitment_owner_publicKey from its point
        bool ${x}_newCommitment_owner_publicKey_sign = edwardsCompress(${x}_newCommitment_owner_publicKey_point)[0]

        bool[254] ${x}_newCommitment_yBits = field_to_bool_256(${x}_newCommitment_owner_publicKey_point[1])[2..256]
        ${x}_newCommitment_yBits[0] = ${x}_newCommitment_owner_publicKey_sign

        field ${x}_newCommitment_owner_publicKey = bool_256_to_field([false, false, ...${x}_newCommitment_yBits])`,
      ];
    },

    postStatements({ name: x, structProperties}): string[] {
      return [
        `
        // ${x}_newCommitment encryption for owner

        ${structProperties ?
          `EncryptedMsgs<${structProperties.length + 2}> ${x}_cipherText = enc(\\
            field_to_bool_256(${x}_newCommitment_ephSecretKey),\\
            ${x}_newCommitment_owner_publicKey_point,\\
            [\\
              ${x}_stateVarId_field,\\
              ${structProperties.map(p => `\t ${x}_newCommitment_value.${p},\\`).join('\n')}
              ${x}_newCommitment_salt\\
            ])`
          :
          `EncryptedMsgs<3> ${x}_cipherText = enc(\\
            field_to_bool_256(${x}_newCommitment_ephSecretKey),\\
            ${x}_newCommitment_owner_publicKey_point,\\
            [\\
              ${x}_stateVarId_field,\\
              ${x}_newCommitment_value_field,\\
              ${x}_newCommitment_salt\\
            ])`
        }`,
      ];
    },
  };

  mapping = {
    importStatements(): string[] {
      return [
        `from "./common/hashes/mimc/altbn254/mimc2.zok" import main as mimc2`,
      ];
    },

    parameters({ mappingKeyName: k, mappingKeyTypeName: t }): string[] {
      if (t === 'local') return [];
      return [
        `private ${t ? t : 'field'} ${k}`, // must be a field, in case we need to do arithmetic on it.
      ];
    },

    preStatements({ id: mappingId, mappingName: m }): string[] {
      return [
        `
        // We need to hard-code the mappingId's of mappings into the circuit:
        field ${m}_mappingId = ${mappingId}`,
      ];
    },

    postStatements({ name: x, mappingName: m, mappingKeyName: k }): string[] {
      // const x = `${m}_${k}`;
      return [
        `
        field ${x}_stateVarId_field = mimc2([${m}_mappingId, ${k}])`,
      ];
    },
  };

  incrementation = {
    importStatements(): string[] {
      return []; // TODO: we might eventually import some underflow/overflow functions.
    },

    statements({ name: x}): string[] {
      // let y = codeGenerator(addends[0]);
      //
      // for (const addend of addends) {
      //   if (addend !== addend[0])
      //     y += `${addend.precedingOperator} ${codeGenerator(addend)}`;
      // }


      return [
        `// Skipping incrementation of ${x}`
        // `
        // // The below represents the incrementation '${x} = ${x} + ${y}':
        //
        // field ${x}_${i} = ${y}`,
      ];
    },
  };

  /** Partitioned states need boilerplate for a decrementation, because it's so weird and different from `a = a - b`. Whole states inherit directly from the AST, so don't need boilerplate here. */
  decrementation = {
    importStatements(): string[] {
      return []; // TODO: we might eventually import some underflow/overflow functions.
    },

    statements({ name: x }): string[] {
      // const y = codeGenerator(subtrahend);
      // let i = startIndex;
      // const x0 = `${x}_${i++}`;
      // const x1 = `${x}_${i++}`;
      // const x2 = `${x}_${i}`;

      return [
        `// Moved decrementation of ${x}`
        // `
        // // The below represents the decrementation '${x} = ${x} - ${y}':
        //
        // assert(${x0} + ${x1} > ${y})
        // // TODO: assert no under/overflows
        //
        // field ${x2} = (${x0} + ${x1}) - ${y}`,
      ];
    },
  };
  internalFunctionCall = {
    importStatements( { name: x , circuitImport, structImport, structName: structName, isEncrypted} ): string[] {
      let internalFncImports = [];
      if(circuitImport)
      internalFncImports.push(`from "./${x}.zok" import main as ${x} `);
      if( structImport)
      internalFncImports.push(`from "./${x}.zok" import ${structName} as ${structName} `);
      if(isEncrypted)
      internalFncImports.push(`from "./common/encryption/kem-dem.zok" import EncryptedMsgs as EncryptedMsgs `);
      return internalFncImports;
    },
  };

}

export default BoilerplateGenerator;
