/* eslint-disable import/no-cycle */

// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.
import fs from 'fs';

const testReadPath = './src/boilerplate/common/generic-test.mjs';
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
          \nconst ${stateName}_preimage = JSON.parse(
              fs.readFileSync(db, 'utf-8', err => {
                console.log(err);
              }),
            ).${mappingName}${mappingKey};
          \nconst ${stateName} = generalise(${stateName}_preimage.value);`];
        default:
          return [`
              \n // Initialise commitment preimage of whole state:
              ${stateVarIds.join('\n')}
              \nlet ${stateName}_commitmentExists = true;
              let ${stateName}_witnessRequired = true;
              \nlet ${stateName}_preimage = {
              \tvalue: ${structProperties ? `{` + structProperties.map(p => `${p}: 0`) + `}` : `0`},
              \tsalt: 0,
              \tcommitment: 0,
              };
              if (!fs.existsSync(db) || !JSON.parse(fs.readFileSync(db, 'utf-8')).${mappingName} || !JSON.parse(fs.readFileSync(db, 'utf-8')).${mappingName}${mappingKey}) {
                  ${stateName}_commitmentExists = false;
                  ${stateName}_witnessRequired = false;
                } else {
                  ${stateName}_preimage = JSON.parse(
                      fs.readFileSync(db, 'utf-8', err => {
                console.log(err);
              }),
            ).${mappingName}${mappingKey};
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
        const stateVarId = [];
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
              \nconst ${stateName}_preimage = JSON.parse(
                fs.readFileSync(db, 'utf-8', err => {
                  console.log(err);
                }),
              ).${mappingName}${mappingKey};
              \nconst ${stateName}_newCommitmentValue = generalise([${Object.values(increment).map((inc) => `generalise(${inc})`)}]).all;

              \nconst ${stateName}_0_oldCommitment = _${stateName}_0_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage, ${structProperties ? `true` : `false`})[0] : generalise(_${stateName}_0_oldCommitment).hex(32);
              \nconst ${stateName}_1_oldCommitment = _${stateName}_1_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage, ${structProperties ? `true` : `false`})[1] : generalise(_${stateName}_1_oldCommitment).hex(32);

              const ${stateName}_0_prevSalt = generalise(${stateName}_preimage[${stateName}_0_oldCommitment].salt);
              const ${stateName}_1_prevSalt = generalise(${stateName}_preimage[${stateName}_1_oldCommitment].salt);
              const ${stateName}_0_prev = generalise(${stateName}_preimage[${stateName}_0_oldCommitment].value);
              const ${stateName}_1_prev = generalise(${stateName}_preimage[${stateName}_1_oldCommitment].value);
              \n
            `];
          return [`
            \n\n// read preimage for decremented state
            \n${stateName}_newOwnerPublicKey = ${newOwnerStatment}
            ${stateVarIds.join('\n')}
            \n let ${stateName}_preimage = JSON.parse(
              fs.readFileSync(db, 'utf-8', err => {
                console.log(err);
              }),
            ).${mappingName}${mappingKey};
            \n const ${stateName}_newCommitmentValue = generalise(${increment});
            // First check if required commitments exist or not
            \n let commitmentFlag = getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage)[0];
            \nlet ${stateName}_0_oldCommitment = _${stateName}_0_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage)[1] : generalise(_${stateName}_0_oldCommitment).hex(32);
            \nlet ${stateName}_1_oldCommitment = _${stateName}_1_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage)[2] : generalise(_${stateName}_1_oldCommitment).hex(32);
            \n let ${stateName}_witness_0 ;
            \n let ${stateName}_witness_1 ;

                      while( commitmentFlag === false) {
                \n  ${stateName}_witness_0 = await getMembershipWitness('${contractName}', generalise(${stateName}_0_oldCommitment).integer);
                \n  ${stateName}_witness_1 = await getMembershipWitness('${contractName}', generalise(${stateName}_1_oldCommitment).integer);

                \n const tx = await joinCommitments('${contractName}', '${mappingName}${mappingKey}', secretKey, publicKey, [${stateVarId.join(' , ')}], ${stateName}_preimage, [${stateName}_0_oldCommitment,${stateName}_1_oldCommitment], [${stateName}_witness_0,${stateName}_witness_1], instance);

                ${stateName}_preimage = JSON.parse(
                  fs.readFileSync(db, 'utf-8', err => {
                    console.log(err);
                  }),
                ).${mappingName}${mappingKey};

                commitmentFlag = getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage)[0];
                \n ${stateName}_0_oldCommitment = _${stateName}_0_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage)[1] : generalise(_${stateName}_0_oldCommitment).hex(32);
                \n ${stateName}_1_oldCommitment = _${stateName}_1_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage)[2] : generalise(_${stateName}_1_oldCommitment).hex(32);

            }
            const ${stateName}_0_prevSalt = generalise(${stateName}_preimage[${stateName}_0_oldCommitment].salt);
            const ${stateName}_1_prevSalt = generalise(${stateName}_preimage[${stateName}_1_oldCommitment].salt);
            const ${stateName}_0_prev = generalise(${stateName}_preimage[${stateName}_0_oldCommitment].value);
            const ${stateName}_1_prev = generalise(${stateName}_preimage[${stateName}_1_oldCommitment].value);
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
                    const ${stateName}_currentCommitment = generalise(${stateName}_preimage.commitment);
                    const ${stateName}_prev = generalise(${stateName}_preimage.value);
                    const ${stateName}_prevSalt = generalise(${stateName}_preimage.salt);
                    \n`];
                default:
                  return [`
                    \n\n// read preimage for whole state
                    ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
                    ${initialised ? `` : stateVarIds.join('\n')}
                    const ${stateName}_currentCommitment = generalise(${stateName}_preimage.commitment);
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
            ${stateName}_witness_0 = await getMembershipWitness('${contractName}', generalise(${stateName}_0_oldCommitment).integer);
            ${stateName}_witness_1 = await getMembershipWitness('${contractName}', generalise(${stateName}_1_oldCommitment).integer);
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

    postStatements({ stateName, stateType }): string[] {
      // if (!isWhole && !newCommitmentValue) throw new Error('PATH');
      switch (stateType) {
        case 'partitioned':
          return [`
            let ${stateName}_0_nullifier = poseidonHash([BigInt(${stateName}_stateVarId), BigInt(secretKey.hex(32)), BigInt(${stateName}_0_prevSalt.hex(32))],);
            let ${stateName}_1_nullifier = poseidonHash([BigInt(${stateName}_stateVarId), BigInt(secretKey.hex(32)), BigInt(${stateName}_1_prevSalt.hex(32))],);
            ${stateName}_0_nullifier = generalise(${stateName}_0_nullifier.hex(32)); // truncate
            ${stateName}_1_nullifier = generalise(${stateName}_1_nullifier.hex(32)); // truncate`];
        case 'whole':
          return [`
            let ${stateName}_nullifier = ${stateName}_commitmentExists ? poseidonHash([BigInt(${stateName}_stateVarId), BigInt(secretKey.hex(32)), BigInt(${stateName}_prevSalt.hex(32))],) : poseidonHash([BigInt(${stateName}_stateVarId), BigInt(generalise(0).hex(32)), BigInt(${stateName}_prevSalt.hex(32))],);
            \n${stateName}_nullifier = generalise(${stateName}_nullifier.hex(32)); // truncate`];
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
        `\nimport { getContractInstance, registerKey, getInputCommitments, joinCommitments } from './common/contract.mjs';`,
        `\nimport { generateProof } from './common/zokrates.mjs';`,
        `\nimport poseidonHash from './common/poseidon.mjs';`,
        `\nimport { getMembershipWitness, getRoot } from './common/timber.mjs';`,
        `\nimport { decompressStarlightKey } from './common/number-theory.mjs';
        \n`,
        `\nconst { generalise } = GN;`,
        `\nconst db = '/app/orchestration/common/db/preimage.json';`,
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
              \t${stateName}_0_nullifier.integer,
              \t${stateName}_1_nullifier.integer,
              ${prev(0)},
              \t${stateName}_0_prevSalt.integer,
              ${prev(1)},
              \t${stateName}_1_prevSalt.integer,
              ${rootRequired ? `\t${stateName}_root.integer,` : ``}
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
                      \t${stateName}_nullifier.integer,
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
                          \t${stateName}_nullifier.integer,
                          ${prev},
                          \t${stateName}_prevSalt.integer,
                          ${rootRequired ? `\t${stateName}_root.integer,` : ``}
                          \t${stateName}_index.integer,
                          \t${stateName}_path.integer`];
                    default:
                      return [`
                      ${parameters.join('\n')}${stateVarIds.join('\n')}
                      \t${stateName}_commitmentExists ? secretKey.integer: generalise(0).integer,
                      \t${stateName}_nullifier.integer,
                      ${prev},
                      \t${stateName}_prevSalt.integer,
                      ${initialisationRequired ? `\t${stateName}_commitmentExists ? 0 : 1,` : ``}
                      ${rootRequired ? `\t${stateName}_root.integer,` : ``}
                      \t${stateName}_index.integer,
                      \t${stateName}_path.integer,
                      \t${stateName}_newOwnerPublicKey.integer,
                      \t${stateName}_newSalt.integer,
                      \t${stateName}_newCommitment.integer`];
        }
      }
    }
  }
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
          value = structProperties ? `{ ${structProperties.map((p, i) => `${p}: ${stateName}_newCommitmentValue.integer[${i}]`)} }` : `${stateName}_newCommitmentValue.integer`;
          return [`
            \npreimage.${mappingName}${mappingKey}[${stateName}_newCommitment.hex(32)] = {
            \tvalue: ${value},
            \tsalt: ${stateName}_newSalt.integer,
            \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
            \tcommitment: ${stateName}_newCommitment.integer,
          };`];
        case 'decrement':
          value = structProperties ? `{ ${structProperties.map((p, i) => `${p}: ${stateName}_change.integer[${i}]`)} }` : `${stateName}_change.integer`;
          return [`
            \npreimage.${mappingName}${mappingKey}[generalise(${stateName}_0_oldCommitment).hex(32)].isNullified = true;
            \npreimage.${mappingName}${mappingKey}[generalise(${stateName}_1_oldCommitment).hex(32)].isNullified = true;
            \npreimage.${mappingName}${mappingKey}[${stateName}_2_newCommitment.hex(32)] = {
            \tvalue: ${value},
            \tsalt: ${stateName}_2_newSalt.integer,
            \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
            \tcommitment: ${stateName}_2_newCommitment.integer,
          };`];
        case 'whole':
          switch (burnedOnly) {
            case true:
              return [`
                \npreimage.${mappingName}${mappingKey} = {};`];
            default:
              value = structProperties ? `{ ${structProperties.map(p => `${p}: ${stateName}.${p}.integer`)} }` : `${stateName}.integer`;
              return [`
                \npreimage.${mappingName}${mappingKey} = {
                \tvalue: ${value},
                \tsalt: ${stateName}_newSalt.integer,
                \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
                \tcommitment: ${stateName}_newCommitment.integer,
              };`];
          }
        default:
          throw new TypeError(stateType);
      } // TODO: we might eventually import some underflow/overflow functions.
    },
};

integrationTestBoilerplate = {
  import(): string {
    return  `import FUNCTION_NAME from './FUNCTION_NAME.mjs';\n
    `},
  preStatements(): string{
    return ` import { startEventFilter, getSiblingPath } from './common/timber.mjs';\nimport logger from './common/logger.mjs';\nimport web3 from './common/web3.mjs';\n\n
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
      let leafIndex;
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
      fs.readFileSync(testReadPath, 'utf8').match(/describe?[\s\S]*/g)[0]
    }`
},

};
zappFilesBoilerplate = () => {
  return [
    {
      readPath: 'src/boilerplate/common/bin/startup',
      writePath: '/bin/startup',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/config/default.js',
      writePath: '/config/default.js',
      generic: false,
    },
    {
      readPath: 'src/boilerplate/common/migrations/1_initial_migration.js',
      writePath: 'migrations/1_initial_migration.js',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/boilerplate-package.json',
      writePath: './package.json',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/boilerplate-docker-compose.yml',
      writePath: './docker-compose.zapp.yml',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/boilerplate-Dockerfile',
      writePath: './Dockerfile',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/boilerplate-Dockerfile.deployer',
      writePath: './Dockerfile.deployer',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/boilerplate-Dockerfile.mongo',
      writePath: './Dockerfile.mongo',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/setup-admin-user.js',
      writePath: './setup-admin-user.js',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/entrypoint.sh',
      writePath: './entrypoint.sh',
      generic: true,
    },
    {
      readPath: 'src/boilerplate/common/truffle-config.js',
      writePath: './truffle-config.js',
      generic: true,
    },
];
}

}

export default BoilerplateGenerator;
