/* eslint-disable import/no-cycle */

// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const testReadPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../../src/boilerplate/common/generic-test.mjs');
const pathPrefix = path.resolve(fileURLToPath(import.meta.url), '../../../../../../src/boilerplate/common/');
const apiServiceReadPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../../src/boilerplate/common/services/generic-api_services.mjs');
const apiRoutesReadPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../../src/boilerplate/common/routes/generic-api_routes.mjs');
class BoilerplateGenerator {
  generateBoilerplate(node: any, fields: any = {}) {
    const { bpSection, bpType, ...otherParams } = node;
    return this?.[bpType]?.[bpSection]?.(otherParams) ?? [];
  }



  static uniqueify(arr: any[]) {
    return Array.from(new Set(arr));
  }


  initialisePreimage = {

    // once per state
    // only whole states
    // if not a mapping, mappingName = stateName, mappingKey = ''
    // If a mapping, mappingKey = `[keyValue]`

    preStatements( {stateName, accessedOnly, stateVarIds, mappingName, mappingKey, structProperties }): string[] {
      // once per state
      // only whole states
      // if not a mapping, mappingName = stateName, mappingKey = ''
      // If a mapping, mappingKey = `[keyValue]`
      switch (accessedOnly) {
        case true:
          return [`
          \n // Initialise commitment preimage of whole accessed state:
          ${stateVarIds.join('\n')}
          \nlet ${stateName}_commitmentExists = true;
          \nconst ${stateName}_commitment = await getCurrentWholeCommitment(${stateName}_stateVarId);
          \nconst ${stateName}_preimage = ${stateName}_commitment.preimage;
          \nconst ${stateName} = generalise(${stateName}_preimage.value);`];
        default:
          return [`
              \n // Initialise commitment preimage of whole state:
              ${stateVarIds.join('\n')}
              \nlet ${stateName}_commitmentExists = true;
              let ${stateName}_witnessRequired = true;
              \nconst ${stateName}_commitment = await getCurrentWholeCommitment(${stateName}_stateVarId);
              \nlet ${stateName}_preimage = {
              \tvalue: ${structProperties ? `{` + structProperties.map(p => `${p}: 0`) + `}` : `0`},
              \tsalt: 0,
              \tcommitment: 0,
              };
              if (!${stateName}_commitment) {
                  ${stateName}_commitmentExists = false;
                  ${stateName}_witnessRequired = false;
                } else {
                  ${stateName}_preimage = ${stateName}_commitment.preimage;
              }`];
        }
      },
    };



  initialiseKeys = {
    postStatements(contractName, onChainKeyRegistry): string[] {
      return [
        `
        \n\n// Read dbs for keys and previous commitment values:
        \nif (!fs.existsSync(keyDb)) await registerKey(utils.randomHex(31), '${contractName}', ${onChainKeyRegistry});
        const keys = JSON.parse(
                    fs.readFileSync(keyDb, 'utf-8', err => {
                      console.log(err);
                    }),
                  );
                const secretKey = generalise(keys.secretKey);
                const publicKey = generalise(keys.publicKey);`
      ];
    },

};

  readPreimage = {


    postStatements({ stateName,
      contractName,
      stateType,
      mappingName,
      mappingKey,
      increment,
      initialised,
      structProperties,
      newOwnerStatment,
      reinitialisedOnly,
      accessedOnly,
      stateVarIds
    }): string[] {
        const stateVarId: string[] = [];
      if(stateVarIds.length > 1){
        stateVarId.push((stateVarIds[0].split(" = ")[1]).split(";")[0]);
        stateVarId.push(`${stateName}_stateVarId_key`);
      } else
       stateVarId.push(`${stateName}_stateVarId`);

      switch (stateType) {
        case 'increment':
          if (structProperties)
            return [`
              \n\n// read preimage for incremented state
              ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
              ${stateVarIds.join('\n')}
              \nconst ${stateName}_newCommitmentValue = generalise([${Object.values(increment).map((inc) => `generalise(${inc})`)}]).all;
              \n
            `];
          return [`
            \n\n// read preimage for incremented state
            ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
            ${stateVarIds.join('\n')}
            \nconst ${stateName}_newCommitmentValue = generalise(${increment});
            \n`];
        case 'decrement':
          if (structProperties)
            return [`
              \n\n// read preimage for decremented state
              ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
              ${stateVarIds.join('\n')}
              \nlet ${stateName}_preimage = await getCommitmentsById(${stateName}_stateVarId);
              \nconst ${stateName}_newCommitmentValue = generalise([${Object.values(increment).map((inc) => `generalise(${inc})`)}]).all;

              \nlet [${stateName}_commitmentFlag, ${stateName}_0_oldCommitment, ${stateName}_1_oldCommitment] = getInputCommitments(
                publicKey.hex(32),
                ${stateName}_newCommitmentValue.integer,
                ${stateName}_preimage,
                true,
              );

              \nlet ${stateName}_witness_0;
              \nlet ${stateName}_witness_1;

              const ${stateName}_0_prevSalt = generalise(${stateName}_0_oldCommitment.preimage.salt);
              const ${stateName}_1_prevSalt = generalise(${stateName}_1_oldCommitment.preimage.salt);
              const ${stateName}_0_prev = generalise(${stateName}_0_oldCommitment.preimage.value);
              const ${stateName}_1_prev = generalise(${stateName}_1_oldCommitment.preimage.value);
              \n
            `];
          return [`
            \n\n// read preimage for decremented state
            \n${stateName}_newOwnerPublicKey = ${newOwnerStatment}
            ${stateVarIds.join('\n')}
            \nlet ${stateName}_preimage = await getCommitmentsById(${stateName}_stateVarId);
            \n const ${stateName}_newCommitmentValue = generalise(${increment});
            // First check if required commitments exist or not
            \nlet [${stateName}_commitmentFlag, ${stateName}_0_oldCommitment, ${stateName}_1_oldCommitment] = getInputCommitments(
              publicKey.hex(32),
              ${stateName}_newCommitmentValue.integer,
              ${stateName}_preimage,
            );
            \nlet ${stateName}_witness_0;
            \nlet ${stateName}_witness_1;

            while(${stateName}_commitmentFlag === false) {
                \n${stateName}_witness_0 = await getMembershipWitness('${contractName}', generalise(${stateName}_0_oldCommitment._id).integer);
                \n${stateName}_witness_1 = await getMembershipWitness('${contractName}', generalise(${stateName}_1_oldCommitment._id).integer);

                \n const tx = await joinCommitments('${contractName}', '${mappingName}', secretKey, publicKey, [${stateVarId.join(' , ')}], [${stateName}_0_oldCommitment, ${stateName}_1_oldCommitment], [${stateName}_witness_0, ${stateName}_witness_1], instance, contractAddr, web3);

                ${stateName}_preimage = await getCommitmentsById(${stateName}_stateVarId);

                [${stateName}_commitmentFlag, ${stateName}_0_oldCommitment, ${stateName}_1_oldCommitment] = getInputCommitments(
                  publicKey.hex(32),
                  ${stateName}_newCommitmentValue.integer,
                  ${stateName}_preimage,
                );
            }
            const ${stateName}_0_prevSalt = generalise(${stateName}_0_oldCommitment.preimage.salt);
            const ${stateName}_1_prevSalt = generalise(${stateName}_1_oldCommitment.preimage.salt);
            const ${stateName}_0_prev = generalise(${stateName}_0_oldCommitment.preimage.value);
            const ${stateName}_1_prev = generalise(${stateName}_1_oldCommitment.preimage.value);
            \n`  ];
        case 'whole':
          switch (reinitialisedOnly) {
            case true:
              return [`
                \n\n// read preimage for reinitialised state
                ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
                ${initialised ? `` : stateVarIds.join('\n')}
                \n`];
            default:
              switch (accessedOnly) {
                case true:
                  return [`
                    \n\n// read preimage for accessed state
                    ${initialised ? `` : stateVarIds.join('\n')}
                    const ${stateName}_currentCommitment = generalise(${stateName}_commitment._id);
                    const ${stateName}_prev = generalise(${stateName}_preimage.value);
                    const ${stateName}_prevSalt = generalise(${stateName}_preimage.salt);
                    \n`];
                default:
                  return [`
                    \n\n// read preimage for whole state
                    ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
                    ${initialised ? `` : stateVarIds.join('\n')}
                    const ${stateName}_currentCommitment = ${stateName}_commitmentExists ? generalise(${stateName}_commitment._id) : generalise(0);
                    const ${stateName}_prev = generalise(${stateName}_preimage.value);
                    const ${stateName}_prevSalt = generalise(${stateName}_preimage.salt);
                    \n`];
              }
          }
        default:
          throw new TypeError(stateType);
      }
    },
  };

  membershipWitness = {
    postStatements({ stateName,
      contractName,
      stateType }): string[] {
      switch (stateType) {
        case 'partitioned':
          return [`
            \n\n// generate witness for partitioned state
            ${stateName}_witness_0 = await getMembershipWitness('${contractName}', generalise(${stateName}_0_oldCommitment._id).integer);
            ${stateName}_witness_1 = await getMembershipWitness('${contractName}', generalise(${stateName}_1_oldCommitment._id).integer);
            const ${stateName}_0_index = generalise(${stateName}_witness_0.index);
            const ${stateName}_1_index = generalise(${stateName}_witness_1.index);
            const ${stateName}_root = generalise(${stateName}_witness_0.root);
            const ${stateName}_0_path = generalise(${stateName}_witness_0.path).all;
            const ${stateName}_1_path = generalise(${stateName}_witness_1.path).all;\n`];
        case 'whole':
          return [`
            \n\n// generate witness for whole state
            const ${stateName}_emptyPath = new Array(32).fill(0);
            const ${stateName}_witness = ${stateName}_witnessRequired
            \t? await getMembershipWitness('${contractName}', ${stateName}_currentCommitment.integer)
            \t: { index: 0, path:  ${stateName}_emptyPath, root: await getRoot('${contractName}') || 0 };
            const ${stateName}_index = generalise(${stateName}_witness.index);
            const ${stateName}_root = generalise(${stateName}_witness.root);
            const ${stateName}_path = generalise(${stateName}_witness.path).all;\n`];
        case 'accessedOnly':
          return [`
            \n\n// generate witness for whole accessed state
            const ${stateName}_witness = await getMembershipWitness('${contractName}', ${stateName}_currentCommitment.integer);
            const ${stateName}_index = generalise(${stateName}_witness.index);
            const ${stateName}_root = generalise(${stateName}_witness.root);
            const ${stateName}_path = generalise(${stateName}_witness.path).all;\n`];
        default:
          throw new TypeError(stateType);
      }
  }
};

  calculateNullifier = {

    postStatements({ stateName, accessedOnly, stateType }): string[] {
      // if (!isWhole && !newCommitmentValue) throw new Error('PATH');
      switch (stateType) {
        
        case 'partitioned':
          return [`
            let ${stateName}_0_nullifier = poseidonHash([BigInt(${stateName}_stateVarId), BigInt(secretKey.hex(32)), BigInt(${stateName}_0_prevSalt.hex(32))],);
            let ${stateName}_1_nullifier = poseidonHash([BigInt(${stateName}_stateVarId), BigInt(secretKey.hex(32)), BigInt(${stateName}_1_prevSalt.hex(32))],);
            ${stateName}_0_nullifier = generalise(${stateName}_0_nullifier.hex(32)); // truncate
            ${stateName}_1_nullifier = generalise(${stateName}_1_nullifier.hex(32)); // truncate
            // Non-membership witness for Nullifier
            const ${stateName}_0_nullifier_NonMembership_witness = getnullifierMembershipWitness(${stateName}_0_nullifier);
            const ${stateName}_1_nullifier_NonMembership_witness = getnullifierMembershipWitness(${stateName}_1_nullifier);

            const ${stateName}_nullifierRoot = generalise(${stateName}_0_nullifier_NonMembership_witness.root);
            const ${stateName}_0_nullifier_path = generalise(${stateName}_0_nullifier_NonMembership_witness.path).all;
            const ${stateName}_1_nullifier_path = generalise(${stateName}_1_nullifier_NonMembership_witness.path).all;
            `];
        case 'whole':
          if(accessedOnly)
          return [`
            let ${stateName}_nullifier = ${stateName}_commitmentExists ? poseidonHash([BigInt(${stateName}_stateVarId), BigInt(secretKey.hex(32)), BigInt(${stateName}_prevSalt.hex(32))],) : poseidonHash([BigInt(${stateName}_stateVarId), BigInt(generalise(0).hex(32)), BigInt(${stateName}_prevSalt.hex(32))],);
            \n${stateName}_nullifier = generalise(${stateName}_nullifier.hex(32)); // truncate

            // Non-membership witness for Nullifier
            const ${stateName}_nullifier_NonMembership_witness = getnullifierMembershipWitness(${stateName}_nullifier);

            const ${stateName}_nullifierRoot = generalise(${stateName}_nullifier_NonMembership_witness.root);
            const ${stateName}_nullifier_path = generalise(${stateName}_nullifier_NonMembership_witness.path).all;
          `];
          return [`
            let ${stateName}_nullifier = ${stateName}_commitmentExists ? poseidonHash([BigInt(${stateName}_stateVarId), BigInt(secretKey.hex(32)), BigInt(${stateName}_prevSalt.hex(32))],) : poseidonHash([BigInt(${stateName}_stateVarId), BigInt(generalise(0).hex(32)), BigInt(${stateName}_prevSalt.hex(32))],);
            \n${stateName}_nullifier = generalise(${stateName}_nullifier.hex(32)); // truncate

            // Non-membership witness for Nullifier
            const ${stateName}_nullifier_NonMembership_witness = getnullifierMembershipWitness(${stateName}_nullifier);

            const ${stateName}_nullifierRoot = generalise(${stateName}_nullifier_NonMembership_witness.root);
            const ${stateName}_nullifier_path = generalise(${stateName}_nullifier_NonMembership_witness.path).all;
          `];
        default:
          throw new TypeError(stateType);
      }
    },
  };

  temporaryUpdatedNullifier = { 
    postStatements({ stateName, accessedOnly, stateType }): string[] {
      // if (!isWhole && !newCommitmentValue) throw new Error('PATH');
      switch (stateType) {
        
        case 'partitioned':
          return [`
            

            await temporaryUpdateNullifier(${stateName}_0_nullifier);
            await temporaryUpdateNullifier(${stateName}_1_nullifier);
            `];
        case 'whole':
          if(!accessedOnly)
          return [`
            await temporaryUpdateNullifier(${stateName}_nullifier);
          `];
          return [` `]; 
        default:
          throw new TypeError(stateType);
      }
    },

  };

  calculateUpdateNullifierPath = {
    postStatements({ stateName, accessedOnly, stateType }): string[] {
      // if (!isWhole && !newCommitmentValue) throw new Error('PATH');
      switch (stateType) {
        
        case 'partitioned':
          return [`
           // Get the new updated nullifier Paths
            const ${stateName}_0_updated_nullifier_NonMembership_witness =  getupdatedNullifierPaths(${stateName}_0_nullifier);
            const ${stateName}_1_updated_nullifier_NonMembership_witness =  getupdatedNullifierPaths(${stateName}_1_nullifier);
 
            const ${stateName}_newNullifierRoot = generalise(${stateName}_0_updated_nullifier_NonMembership_witness.root);
            const ${stateName}_0_nullifier_updatedpath = generalise(${stateName}_0_updated_nullifier_NonMembership_witness.path).all;
            const ${stateName}_1_nullifier_updatedpath = generalise(${stateName}_1_updated_nullifier_NonMembership_witness.path).all;
            `];
        case 'whole':
          if(!accessedOnly)
          return [`
          // Get the new updated nullifier Paths 
            const ${stateName}_updated_nullifier_NonMembership_witness =  getupdatedNullifierPaths(${stateName}_nullifier);
            const ${stateName}_nullifier_updatedpath = generalise(${stateName}_updated_nullifier_NonMembership_witness.path).all;
            const ${stateName}_newNullifierRoot = generalise(${stateName}_updated_nullifier_NonMembership_witness.root);
          `]; 
         return [` `]; 
        default:
          throw new TypeError(stateType);
      }
    },
  };

  calculateCommitment = {

    postStatements({ stateName, stateType, structProperties }): string[] {
      // once per state
      switch (stateType) {
        case 'increment':
          return [`
          \nconst ${stateName}_newSalt = generalise(utils.randomHex(31));
          \nlet ${stateName}_newCommitment = poseidonHash([BigInt(${stateName}_stateVarId), ${structProperties ? `...${stateName}_newCommitmentValue.hex(32).map(v => BigInt(v))` : `BigInt(${stateName}_newCommitmentValue.hex(32))`}, BigInt(${stateName}_newOwnerPublicKey.hex(32)), BigInt(${stateName}_newSalt.hex(32))],);
          \n${stateName}_newCommitment = generalise(${stateName}_newCommitment.hex(32)); // truncate`];
        case 'decrement':
          const change = structProperties ? `[
            ${structProperties.map((p, i) => `parseInt(${stateName}_0_prev.${p}.integer, 10) + parseInt(${stateName}_1_prev.${p}.integer, 10) - parseInt(${stateName}_newCommitmentValue.integer[${i}], 10)`)}
            ];
            \n${stateName}_change = generalise(${stateName}_change).all;` :
            `parseInt(${stateName}_0_prev.integer, 10) + parseInt(${stateName}_1_prev.integer, 10) - parseInt(${stateName}_newCommitmentValue.integer, 10);
            \n${stateName}_change = generalise(${stateName}_change);`;
          return [`
            \nconst ${stateName}_2_newSalt = generalise(utils.randomHex(31));
            \nlet ${stateName}_change = ${change}
            \nlet ${stateName}_2_newCommitment = poseidonHash([BigInt(${stateName}_stateVarId), ${structProperties ? `...${stateName}_change.hex(32).map(v => BigInt(v))` : `BigInt(${stateName}_change.hex(32))`}, BigInt(publicKey.hex(32)), BigInt(${stateName}_2_newSalt.hex(32))],);
            \n${stateName}_2_newCommitment = generalise(${stateName}_2_newCommitment.hex(32)); // truncate`];
        case 'whole':
          const value = structProperties ? structProperties.map(p => `BigInt(${stateName}.${p}.hex(32))`) :` BigInt(${stateName}.hex(32))`;
          return [`
            \n ${structProperties ? structProperties.map(p => `\n${stateName}.${p} = ${stateName}.${p} ? ${stateName}.${p} : ${stateName}_prev.${p};`).join('') : ''}
            \nconst ${stateName}_newSalt = generalise(utils.randomHex(31));
            \nlet ${stateName}_newCommitment = poseidonHash([BigInt(${stateName}_stateVarId), ${value}, BigInt(${stateName}_newOwnerPublicKey.hex(32)), BigInt(${stateName}_newSalt.hex(32))],);
            \n${stateName}_newCommitment = generalise(${stateName}_newCommitment.hex(32)); // truncate`];
        default:
          throw new TypeError(stateType);
        }
    },
  };

  generateProof = {
    import(): string []{
      return [
        `/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */`,
        `\nimport config from 'config';`,
        `\nimport utils from 'zkp-utils';`,
        `\nimport GN from 'general-number';`,
        `\nimport fs from 'fs';
        \n`,
        `\nimport { getContractInstance, getContractAddress, registerKey } from './common/contract.mjs';`,
        `\nimport { storeCommitment, getCurrentWholeCommitment, getCommitmentsById, getAllCommitments, getInputCommitments, joinCommitments, markNullified,getnullifierMembershipWitness,getupdatedNullifierPaths,temporaryUpdateNullifier,updateNullifierTree } from './common/commitment-storage.mjs';`,
        `\nimport { generateProof } from './common/zokrates.mjs';`,
        `\nimport { getMembershipWitness, getRoot } from './common/timber.mjs';`,
        `\nimport Web3 from './common/web3.mjs';`,
        `\nimport { decompressStarlightKey, poseidonHash } from './common/number-theory.mjs';
        \n`,
        `\nconst { generalise } = GN;`,
        `\nconst db = '/app/orchestration/common/db/preimage.json';`,
        `const web3 = Web3.connection();`,
        `\nconst keyDb = '/app/orchestration/common/db/key.json';\n\n`,
      ];
    },

    parameters({
      stateName,
      stateType,
      stateVarIds,
      structProperties,
      reinitialisedOnly,
      burnedOnly,
      accessedOnly,
      nullifierRootRequired,
      initialisationRequired,
      encryptionRequired,
      rootRequired,
      parameters,
    }): string[] {
      let prev;
      // once per state
      switch (stateType) {

        case 'increment':
          return [`
              ${parameters.join('\n')}${stateVarIds.join('\n')}
              ${encryptionRequired ? `` : `\t${stateName}_newOwnerPublicKey.integer,`}
              \t${stateName}_newSalt.integer,
              \t${stateName}_newCommitment.integer
              ${encryptionRequired ? `,
                \tgeneralise(utils.randomHex(31)).integer,
                \t[decompressStarlightKey(${stateName}_newOwnerPublicKey)[0].integer,
              decompressStarlightKey(${stateName}_newOwnerPublicKey)[1].integer]` : ``}
            `];
        case 'decrement':
          prev = (index: number) => structProperties ? structProperties.map(p => `\t${stateName}_${index}_prev.${p}.integer`) : `\t${stateName}_${index}_prev.integer`;
          return [`
              ${parameters.join('\n')}${stateVarIds.join('\n')}
              \tsecretKey.integer,
              \tsecretKey.integer,
              ${nullifierRootRequired ? `\t${stateName}_nullifierRoot.integer,` : ``}
              ${nullifierRootRequired ? `\t${stateName}_newNullifierRoot.integer,` : ``}
              \t${stateName}_0_nullifier.integer,
              \t${stateName}_0_nullifier_path.integer,
              \t${stateName}_0_nullifier_updatedpath.integer,
              \t${stateName}_1_nullifier.integer,
              \t${stateName}_1_nullifier_path.integer,
              \t${stateName}_1_nullifier_updatedpath.integer,
              ${prev(0)},
              \t${stateName}_0_prevSalt.integer,
              ${prev(1)},
              \t${stateName}_1_prevSalt.integer,
              \t${rootRequired ? `\t${stateName}_root.integer,` : ``}
              \t${stateName}_0_index.integer,
              \t${stateName}_0_path.integer,
              \t${stateName}_1_index.integer,
              \t${stateName}_1_path.integer,
              \t${stateName}_newOwnerPublicKey.integer,
              \t${stateName}_2_newSalt.integer,
              \t${stateName}_2_newCommitment.integer`];
        case 'whole':
          switch (reinitialisedOnly) {
            case true:
              return [`
                  ${parameters.join('\n')}${stateVarIds.join('\n')}
                  \t${stateName}_newOwnerPublicKey.integer,
                  \t${stateName}_newSalt.integer,
                  \t${stateName}_newCommitment.integer`];
            default:
              prev = structProperties ? structProperties.map(p => `\t${stateName}_prev.${p}.integer`) : `\t${stateName}_prev.integer`;
              switch (burnedOnly) {
                case true:
                  return [`
                      ${parameters.join('\n')}${stateVarIds.join('\n')}
                      \tsecretKey.integer,
                      ${nullifierRootRequired ? `\t${stateName}_nullifierRoot.integer,` : ``}
                      ${nullifierRootRequired ? `\t${stateName}_newNullifierRoot.integer,` : ``}
                      \t${stateName}_nullifier.integer,
                      \t${stateName}_nullifier_path.integer,
                      \t${stateName}_nullifier_updatedpath.integer,
                      ${prev},
                      \t${stateName}_prevSalt.integer,
                      ${initialisationRequired ? `\t${stateName}_commitmentExists ? 0 : 1,` : ``}
                      ${rootRequired ? `\t${stateName}_root.integer,` : ``}
                      \t${stateName}_index.integer,
                      \t${stateName}_path.integer`];
                default:
                  switch (accessedOnly) {
                    case true:
                      return [`
                          ${parameters.join('\n')}${stateVarIds.join('\n')}
                          \tsecretKey.integer,
                          ${nullifierRootRequired ? `\t${stateName}_nullifierRoot.integer,` : ``}
                          \t${stateName}_nullifier_path.integer,
                          ${prev},
                          \t${stateName}_prevSalt.integer,
                          ${rootRequired ? `\t${stateName}_root.integer,` : ``}
                          \t${stateName}_index.integer,
                          \t${stateName}_path.integer`];
                    default:
                      return [`
                      ${parameters.join('\n')}${stateVarIds.join('\n')}
                      \t${stateName}_commitmentExists ? secretKey.integer: generalise(0).integer,
                      ${nullifierRootRequired ? `\t${stateName}_nullifierRoot.integer,` : ``}
                      ${nullifierRootRequired ? `\t${stateName}_newNullifierRoot.integer,` : ``}
                      \t${stateName}_nullifier.integer,
                      \t${stateName}_nullifier_path.integer,
                      \t${stateName}_nullifier_updatedpath.integer,
                      ${prev},
                      \t${stateName}_prevSalt.integer,
                      ${initialisationRequired ? `\t${stateName}_commitmentExists ? 0 : 1,` : ``}
                      ${rootRequired ? `\t${stateName}_root.integer,` : ``}
                      \t${stateName}_index.integer,
                      \t${stateName}_path.integer,
                      ${encryptionRequired ? `` : `\t${stateName}_newOwnerPublicKey.integer,`}
                      \t${stateName}_newSalt.integer,
                      \t${stateName}_newCommitment.integer
                      ${encryptionRequired ? `,
                        \tgeneralise(utils.randomHex(31)).integer,
                        \t[decompressStarlightKey(${stateName}_newOwnerPublicKey)[0].integer,
                          decompressStarlightKey(${stateName}_newOwnerPublicKey)[1].integer]` : ``}`];
                  }
              }
      }
    }
    return []; // here to stop ts complaining
  },
};

sendTransaction = {
  statements(): string[] {
    return []; // TODO: we might eventually import some underflow/overflow functions.
  },
    // we don't use this builder, because sendtx only requires a few lines which are very custom
};
  /** Partitioned states need boilerplate for a decrementation, because it's so weird and different from `a = a - b`. Whole states inherit directly from the AST, so don't need boilerplate here. */
  writePreimage = {
    postStatements({
      stateName,
      stateType,
      mappingName,
      mappingKey,
      burnedOnly,
      structProperties,
    }): string[] {
      let value;
      switch (stateType) {
        case 'increment':
          value = structProperties ? `{ ${structProperties.map((p, i) => `${p}: ${stateName}_newCommitmentValue.integer[${i}]`)} }` : `${stateName}_newCommitmentValue`;
          return [`
          \nawait storeCommitment({
            hash: ${stateName}_newCommitment,
            name: '${mappingName}',
            mappingKey: ${mappingKey === `` ? `null` : `${mappingKey}`},
            preimage: {
              \tstateVarId: generalise(${stateName}_stateVarId),
              \tvalue: ${value},
              \tsalt: ${stateName}_newSalt,
              \tpublicKey: ${stateName}_newOwnerPublicKey,
            },
            secretKey: ${stateName}_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
            isNullified: false,
          });`];
        case 'decrement':
          value = structProperties ? `{ ${structProperties.map((p, i) => `${p}: ${stateName}_change.integer[${i}]`)} }` : `${stateName}_change`;
          return [`
            \nawait markNullified(generalise(${stateName}_0_oldCommitment._id), secretKey.hex(32));
            \nawait markNullified(generalise(${stateName}_1_oldCommitment._id), secretKey.hex(32));
            \nawait storeCommitment({
              hash: ${stateName}_2_newCommitment,
              name: '${mappingName}',
              mappingKey: ${mappingKey === `` ? `null` : `${mappingKey}`},
              preimage: {
                \tstateVarId: generalise(${stateName}_stateVarId),
                \tvalue: ${value},
                \tsalt: ${stateName}_2_newSalt,
                \tpublicKey: ${stateName}_newOwnerPublicKey,
              },
              secretKey: ${stateName}_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
              isNullified: false,
            });`];
        case 'whole':
          switch (burnedOnly) {
            case true:
              return [`
                \nawait markNullified(${stateName}_currentCommitment, secretKey.hex(32));`];
            default:
              value = structProperties ? `{ ${structProperties.map(p => `${p}: ${stateName}.${p}`)} }` : `${stateName}`;
              return [`
                \nif (${stateName}_commitmentExists) await markNullified(${stateName}_currentCommitment, secretKey.hex(32));
                \n else await updateNullifierTree(); // Else we always update it in markNullified
                \nawait storeCommitment({
                  hash: ${stateName}_newCommitment,
                  name: '${mappingName}',
                  mappingKey: ${mappingKey === `` ? `null` : `${mappingKey}`},
                  preimage: {
                    \tstateVarId: generalise(${stateName}_stateVarId),
                    \tvalue: ${value},
                    \tsalt: ${stateName}_newSalt,
                    \tpublicKey: ${stateName}_newOwnerPublicKey,
                  },
                  secretKey: ${stateName}_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
                  isNullified: false,
                });`];
          }
        default:
          throw new TypeError(stateType);
      } // TODO: we might eventually import some underflow/overflow functions.
    },
};

integrationTestBoilerplate = {
  import(): string {
    return  `import FUNCTION_NAME from './FUNCTION_NAME.mjs';\n
    `
  },
  encryption(): string {
    return `
    it("should recieve and decrypt messages", async () => {
      try {
        const { secretKey } = JSON.parse(
          fs.readFileSync("/app/orchestration/common/db/key.json", "utf-8", (err) => {
            console.log(err);
          })
        );
        const plainText = decrypt(encryption.msgs, secretKey, encryption.key);
        console.log('Decrypted plainText:');
        console.log(plainText);
        const salt = plainText[plainText.length - 1];
        const commitmentSet = await getAllCommitments();
        const thisCommit = commitmentSet.find(c => generalise(c.preimage.salt).integer === generalise(salt).integer);
        assert.equal(!!thisCommit, true);

      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
    `
  },
  preStatements(): string{
    return ` import { startEventFilter, getSiblingPath } from './common/timber.mjs';\nimport fs from "fs";\n import GN from "general-number";\nimport {getAllCommitments} from "./common/commitment-storage.mjs";\nimport logger from './common/logger.mjs';\nimport { decrypt } from "./common/number-theory.mjs";\nimport web3 from './common/web3.mjs';\n\n
        /**
      Welcome to your zApp's integration test!
      Depending on how your functions interact and the range of inputs they expect, the below may need to be changed.
      e.g. Your input contract has two functions, add() and minus(). minus() cannot be called before an initial add() - the compiler won't know this! You'll need to rearrange the below.
      e.g. The function add() only takes numbers greater than 100. The compiler won't know this, so you'll need to change the call to add() below.
      The transpiler automatically fills in any ZKP inputs for you and provides some dummy values for the original zol function.
      NOTE: if any non-secret functions need to be called first, the transpiler won't know! You'll need to add those calls below.
      NOTE: if you'd like to keep track of your commitments, check out ./common/db/preimage. Remember to delete this file if you'd like to start fresh with a newly deployed contract.
      */
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const { generalise } = GN;
      let leafIndex;
      let encryption = {};
      // eslint-disable-next-line func-names
       describe('CONTRACT_NAME', async function () {
        this.timeout(3660000);
        try {
          await web3.connect();
        } catch (err) {
          throw new Error(err);
        }`



},
postStatements(): string {
  return `// eslint-disable-next-line func-names \n ${
      (fs.readFileSync(testReadPath, 'utf8').match(/describe?[\s\S]*/g) || [])[0]
    }`
},

};
integrationApiServicesBoilerplate = {
  import(): string {
    return  `import FUNCTION_NAME from './FUNCTION_NAME.mjs';\n
    `
  },
  preStatements(): string{
    return ` import { startEventFilter, getSiblingPath } from './common/timber.mjs';\nimport fs from "fs";\nimport logger from './common/logger.mjs';\nimport { decrypt } from "./common/number-theory.mjs";\nimport { getAllCommitments, getCommitmentsByState, reinstateNullifiers } from "./common/commitment-storage.mjs";\nimport web3 from './common/web3.mjs';\n\n
        /**
      NOTE: this is the api service file, if you need to call any function use the correct url and if Your input contract has two functions, add() and minus().
      minus() cannot be called before an initial add(). */

      const sleep = ms => new Promise(r => setTimeout(r, ms));
      let leafIndex;
      let encryption = {};
      // eslint-disable-next-line func-names

      export async function CONTRACT_NAME(){

      	try {
      		await web3.connect();
      	} catch (err) {
      		throw new Error(err);
      }
      }`
    },
  postStatements(): string {
    return `// eslint-disable-next-line func-names \n ${
        (fs.readFileSync(apiServiceReadPath, 'utf8').match(/export?[\s\S]*/g)|| [])[0]}`
  },

  commitments(): string {
    return `
      export async function service_allCommitments(req, res, next) {
        try {
          const commitments = await getAllCommitments();
          res.send({ commitments });
          await sleep(10);
        } catch (err) {
          logger.error(err);
          res.send({ errors: [err.message] });
        }
      }
      
      export async function service_getCommitmentsByState(req, res, next) {
        try {
          const { name, mappingKey } = req.body;
          const commitments = await getCommitmentsByState(name, mappingKey);
          res.send({ commitments });
          await sleep(10);
        } catch (err) {
          logger.error(err);
          res.send({ errors: [err.message] });
        }
      }
      
      export async function service_reinstateNullifiers(req, res, next) {
        try {
          await reinstateNullifiers();
          res.send('Complete');
          await sleep(10);
        } catch (err) {
          logger.error(err);
          res.send({ errors: [err.message] });
        }
      }`
      
      
      ;
  }


};
integrationApiRoutesBoilerplate = {
  import(): string {
    return  `import {service_FUNCTION_NAME} from "./api_services.mjs";\n
    `
  },
  preStatements(): string{
    return ` import express from 'express';\n
    \nconst router  = express.Router();`
  },
  postStatements(): string {
    return `// eslint-disable-next-line func-names \n ${
        (fs.readFileSync(apiRoutesReadPath, 'utf8').match(/router.post?[\s\S]*/g)|| [])[0]}`
  },
  commitmentImports(): string {
    return `import { service_allCommitments, service_getCommitmentsByState, service_reinstateNullifiers } from "./api_services.mjs";\n`;
  },
  commitmentRoutes(): string {
    return `// commitment getter routes
    router.get("/getAllCommitments", service_allCommitments);
    router.get("/getCommitmentsByVariableName", service_getCommitmentsByState);
    // nullifier route
    router.post("/reinstateNullifiers", service_reinstateNullifiers);
    `;
  }
};

zappFilesBoilerplate = () => {
  return [
    {
      readPath: pathPrefix + '/bin/startup',
      writePath: '/bin/startup',
      generic: true,
    },
    {
      readPath: pathPrefix + '/bin/startup',
      writePath: '/bin/default_startup',
      generic: true,
    },
    {
      readPath: pathPrefix + '/config/default.js',
      writePath: '/config/default.js',
      generic: false,
    },
    {
      readPath: pathPrefix + '/migrations/1_initial_migration.js',
      writePath: 'migrations/1_initial_migration.js',
      generic: true,
    },
    {
      readPath: pathPrefix + '/boilerplate-package.json',
      writePath: './package.json',
      generic: true,
    },
    {
      readPath: pathPrefix + '/boilerplate-docker-compose.yml',
      writePath: './docker-compose.zapp.yml',
      generic: true,
    },
    {
      readPath: pathPrefix + '/boilerplate-Docker-compose.zapp.override.yml',
      writePath: './docker-compose.zapp.override.yml',
      generic: true,
    },
    {
      readPath: pathPrefix + '/boilerplate-Docker-compose.zapp.override.yml',
      writePath: './docker-compose.zapp.override.default.yml',
      generic: true,
    },
    {
      readPath: pathPrefix + '/boilerplate-Dockerfile',
      writePath: './Dockerfile',
      generic: true,
    },
    {
      readPath: pathPrefix + '/boilerplate-Dockerfile.deployer',
      writePath: './Dockerfile.deployer',
      generic: true,
    },
    {
      readPath: pathPrefix + '/boilerplate-Dockerfile.mongo',
      writePath: './Dockerfile.mongo',
      generic: true,
    },
    {
      readPath: pathPrefix + '/setup-admin-user.js',
      writePath: './setup-admin-user.js',
      generic: true,
    },
    {
      readPath: pathPrefix + '/entrypoint.sh',
      writePath: './entrypoint.sh',
      generic: true,
    },
    {
      readPath: pathPrefix + '/entrypoint.sh',
      writePath: './entrypoint_default.sh',
      generic: true,
    },
    {
      readPath: pathPrefix + '/truffle-config.js',
      writePath: './truffle-config.js',
      generic: true,
    },
    {
      readPath: pathPrefix + '/api.mjs',
      writePath: './orchestration/api.mjs',
      generic: true,
    },
    {
      readPath: pathPrefix + '/commitment-storage.mjs',
      writePath: './orchestration/common/commitment-storage.mjs',
      generic: false,
    },
];
}

}

export default BoilerplateGenerator;
