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

    preStatements( {stateName, accessedOnly, stateVarIds, mappingName, mappingKey }): string[] {
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
            ).${mappingName}${mappingKey};`];
        default:
          return [`
              \n // Initialise commitment preimage of whole state:
              ${stateVarIds.join('\n')}
              \nlet ${stateName}_commitmentExists = true;
              let ${stateName}_witnessRequired = true;
              \nlet ${stateName}_preimage = {
              \t${stateName}: 0,
              \tsalt: 0,
              \tcommitment: 0,
              };
              if (!fs.existsSync(db) || !JSON.parse(fs.readFileSync(db, 'utf-8')).${mappingName}${mappingKey}) {
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
        \nif (!fs.existsSync(keyDb)) await registerKey(utils.randomHex(32), '${contractName}', ${onChainKeyRegistry});
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
      stateType,
      mappingName,
      mappingKey,
      increment,
      initialised,
      newOwnerStatment,
      reinitialisedOnly,
      accessedOnly,
      stateVarIds
      }): string[] {
      switch (stateType) {
        case 'increment':
          return [`
            ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
            ${stateVarIds.join('\n')}
            \nconst ${stateName}_newCommitmentValue = generalise(${increment});
            \n`];
        case 'decrement':
          return [`
            \n${stateName}_newOwnerPublicKey = ${newOwnerStatment}
            ${stateVarIds.join('\n')}
            \nconst ${stateName}_preimage = JSON.parse(
              fs.readFileSync(db, 'utf-8', err => {
                console.log(err);
              }),
            ).${mappingName}${mappingKey};
            \nconst ${stateName}_newCommitmentValue = generalise(${increment});
            \nconst ${stateName}_0_oldCommitment = _${stateName}_0_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage)[0] : generalise(_${stateName}_0_oldCommitment).hex(32);
            \nconst ${stateName}_1_oldCommitment = _${stateName}_1_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${stateName}_newCommitmentValue.integer, ${stateName}_preimage)[1] : generalise(_${stateName}_1_oldCommitment).hex(32);

            const ${stateName}_0_prevSalt = generalise(${stateName}_preimage[${stateName}_0_oldCommitment].salt);
            const ${stateName}_1_prevSalt = generalise(${stateName}_preimage[${stateName}_1_oldCommitment].salt);
            const ${stateName}_0_prev = generalise(${stateName}_preimage[${stateName}_0_oldCommitment].value);
            const ${stateName}_1_prev = generalise(${stateName}_preimage[${stateName}_1_oldCommitment].value);
            \n`];
        case 'whole':
          switch (reinitialisedOnly) {
            case true:
              return [`
                ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
                ${initialised ? `` : stateVarIds.join('\n')}
                \n`];
            default:
              switch (accessedOnly) {
                case true:
                  return [`
                    ${initialised ? `` : stateVarIds.join('\n')}
                    const ${stateName}_currentCommitment = generalise(${stateName}_preimage.commitment);
                    const ${stateName}_prev = generalise(${stateName}_preimage.${stateName});
                    const ${stateName}_prevSalt = generalise(${stateName}_preimage.salt);
                    \n`];
                default:
                  return [`
                    ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
                    ${initialised ? `` : stateVarIds.join('\n')}
                    const ${stateName}_currentCommitment = generalise(${stateName}_preimage.commitment);
                    const ${stateName}_prev = generalise(${stateName}_preimage.${stateName});
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
            const ${stateName}_witness_0 = await getMembershipWitness('${contractName}', generalise(${stateName}_0_oldCommitment).integer);
            const ${stateName}_witness_1 = await getMembershipWitness('${contractName}', generalise(${stateName}_1_oldCommitment).integer);
            const ${stateName}_0_index = generalise(${stateName}_witness_0.index);
            const ${stateName}_1_index = generalise(${stateName}_witness_1.index);
            const ${stateName}_root = generalise(${stateName}_witness_0.root);
            const ${stateName}_0_path = generalise(${stateName}_witness_0.path).all;
            const ${stateName}_1_path = generalise(${stateName}_witness_1.path).all;\n`];
        case 'whole':
          return [`
            const ${stateName}_emptyPath = new Array(32).fill(0);
            const ${stateName}_witness = ${stateName}_witnessRequired
            \t? await getMembershipWitness('${contractName}', ${stateName}_currentCommitment.integer)
            \t: { index: 0, path:  ${stateName}_emptyPath, root: await getRoot('${contractName}') || 0 };
            const ${stateName}_index = generalise(${stateName}_witness.index);
            const ${stateName}_root = generalise(${stateName}_witness.root);
            const ${stateName}_path = generalise(${stateName}_witness.path).all;\n`];
        case 'accessedOnly':
          return [`
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
            let ${stateName}_0_nullifier = generalise(utils.shaHash(${stateName}_stateVarId, secretKey.hex(32), ${stateName}_0_prevSalt.hex(32)));
            let ${stateName}_1_nullifier = generalise(utils.shaHash(${stateName}_stateVarId, secretKey.hex(32), ${stateName}_1_prevSalt.hex(32)));
            ${stateName}_0_nullifier = generalise(${stateName}_0_nullifier.hex(32, 31)); // truncate
            ${stateName}_1_nullifier = generalise(${stateName}_1_nullifier.hex(32, 31)); // truncate`];
        case 'whole':
          return [`
            let ${stateName}_nullifier = ${stateName}_commitmentExists ? generalise(utils.shaHash(${stateName}_stateVarId, secretKey.hex(32), ${stateName}_prevSalt.hex(32))) : generalise(utils.shaHash(${stateName}_stateVarId, generalise(0).hex(32), ${stateName}_prevSalt.hex(32)));
            \n${stateName}_nullifier = generalise(${stateName}_nullifier.hex(32, 31)); // truncate`];
        default:
          throw new TypeError(stateType);
      }
    },
  };

  calculateCommitment = {

    postStatements({ stateName, stateType }): string[] {
      // once per state
      switch (stateType) {
        case 'increment':
          return [`
          \nconst ${stateName}_newSalt = generalise(utils.randomHex(32));
          \nlet ${stateName}_newCommitment = generalise(utils.shaHash(${stateName}_stateVarId, ${stateName}_newCommitmentValue.hex(32), ${stateName}_newOwnerPublicKey.hex(32), ${stateName}_newSalt.hex(32)));
          \n${stateName}_newCommitment = generalise(${stateName}_newCommitment.hex(32, 31)); // truncate`];
        case 'decrement':
          return [`
            \nconst ${stateName}_2_newSalt = generalise(utils.randomHex(32));
            \nlet ${stateName}_change = parseInt(${stateName}_0_prev.integer, 10) + parseInt(${stateName}_1_prev.integer, 10) - parseInt(${stateName}_newCommitmentValue.integer, 10);
            \n${stateName}_change = generalise(${stateName}_change);
            \nlet ${stateName}_2_newCommitment = generalise(utils.shaHash(${stateName}_stateVarId, ${stateName}_change.hex(32), publicKey.hex(32), ${stateName}_2_newSalt.hex(32)));
            \n${stateName}_2_newCommitment = generalise(${stateName}_2_newCommitment.hex(32, 31)); // truncate`];
        case 'whole':
          return [`
            \nconst ${stateName}_newSalt = generalise(utils.randomHex(32));
            \nlet ${stateName}_newCommitment = generalise(utils.shaHash(${stateName}_stateVarId, ${stateName}.hex(32), ${stateName}_newOwnerPublicKey.hex(32), ${stateName}_newSalt.hex(32)));
            \n${stateName}_newCommitment = generalise(${stateName}_newCommitment.hex(32, 31)); // truncate`];
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
        `\nimport { getContractInstance, registerKey, getInputCommitments } from './common/contract.mjs';`,
        `\nimport { generateProof } from './common/zokrates.mjs';`,
        `\nimport { getMembershipWitness, getRoot } from './common/timber.mjs';
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
      reinitialisedOnly,
      burnedOnly,
      accessedOnly,
      initialisationRequired,
      rootRequired,
      parameters,
      }): string[] {

      // once per state
      switch (stateType) {

        case 'increment':
          return [`
              ${parameters.join('\n')}${stateVarIds.join('\n')}
              \t${stateName}_newOwnerPublicKey.limbs(32, 8),
              \t${stateName}_newSalt.limbs(32, 8),
              \t${stateName}_newCommitment.integer`];
        case 'decrement':
          return [`
              ${parameters.join('\n')}${stateVarIds.join('\n')}
              \tsecretKey.limbs(32, 8),
              \tsecretKey.limbs(32, 8),
              \t${stateName}_0_nullifier.integer,
              \t${stateName}_1_nullifier.integer,
              \t${stateName}_0_prev.integer,
              \t${stateName}_0_prevSalt.limbs(32, 8),
              \t${stateName}_1_prev.integer,
              \t${stateName}_1_prevSalt.limbs(32, 8),
              ${rootRequired ? `\t${stateName}_root.integer,` : ``}
              \t${stateName}_0_index.integer,
              \t${stateName}_0_path.integer,
              \t${stateName}_1_index.integer,
              \t${stateName}_1_path.integer,
              \t${stateName}_newOwnerPublicKey.limbs(32, 8),
              \t${stateName}_2_newSalt.limbs(32, 8),
              \t${stateName}_2_newCommitment.integer`];
        case 'whole':
          switch (reinitialisedOnly) {
            case true:
              return [`
                  ${parameters.join('\n')}${stateVarIds.join('\n')}
                  \t${stateName}_newOwnerPublicKey.limbs(32, 8),
                  \t${stateName}_newSalt.limbs(32, 8),
                  \t${stateName}_newCommitment.integer`];
            default:
              switch (burnedOnly) {
                case true:
                  return [`
                      ${parameters.join('\n')}${stateVarIds.join('\n')}
                      \tsecretKey.limbs(32, 8),
                      \t${stateName}_nullifier.integer,
                      \t${stateName}_prev.integer,
                      \t${stateName}_prevSalt.limbs(32, 8),
                      ${initialisationRequired ? `\t${stateName}_commitmentExists ? 0 : 1,` : ``}
                      ${rootRequired ? `\t${stateName}_root.integer,` : ``}
                      \t${stateName}_index.integer,
                      \t${stateName}_path.integer`];
                default:
                  switch (accessedOnly) {
                    case true:
                      return [`
                          ${parameters.join('\n')}${stateVarIds.join('\n')}
                          \tsecretKey.limbs(32, 8),
                          \t${stateName}_nullifier.integer,
                          \t${stateName}_prev.integer,
                          \t${stateName}_prevSalt.limbs(32, 8),
                          ${rootRequired ? `\t${stateName}_root.integer,` : ``}
                          \t${stateName}_index.integer,
                          \t${stateName}_path.integer`];
                    default:
                      return [`
                      ${parameters.join('\n')}${stateVarIds.join('\n')}
                      \t${stateName}_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
                      \t${stateName}_nullifier.integer,
                      \t${stateName}_prev.integer,
                      \t${stateName}_prevSalt.limbs(32, 8),
                      ${initialisationRequired ? `\t${stateName}_commitmentExists ? 0 : 1,` : ``}
                      ${rootRequired ? `\t${stateName}_root.integer,` : ``}
                      \t${stateName}_index.integer,
                      \t${stateName}_path.integer,
                      \t${stateName}_newOwnerPublicKey.limbs(32, 8),
                      \t${stateName}_newSalt.limbs(32, 8),
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
    postStatements({stateName,
      stateType,
      mappingName,
      mappingKey,
      burnedOnly}): string[] {
      switch (stateType) {
        case 'increment':
          return [`
            \npreimage.${mappingName}${mappingKey}[${stateName}_newCommitment.hex(32)] = {
            \tvalue: ${stateName}_newCommitmentValue.integer,
            \tsalt: ${stateName}_newSalt.integer,
            \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
            \tcommitment: ${stateName}_newCommitment.integer,
          };`];
        case 'decrement':
          return [`
            \npreimage.${mappingName}${mappingKey}[generalise(${stateName}_0_oldCommitment).hex(32)].isNullified = true;
            \npreimage.${mappingName}${mappingKey}[generalise(${stateName}_1_oldCommitment).hex(32)].isNullified = true;
            \npreimage.${mappingName}${mappingKey}[${stateName}_2_newCommitment.hex(32)] = {
            \tvalue: ${stateName}_change.integer,
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
              return [`
                \npreimage.${mappingName}${mappingKey} = {
                \t${stateName}: ${stateName}.integer,
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
