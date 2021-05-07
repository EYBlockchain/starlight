/* eslint-disable import/no-cycle, consistent-return */
import fs from 'fs';

const testReadPath = './src/boilerplate/common/generic-test.mjs';

/**
 * @desc:
 * Visitor transforms a `.zol` AST into a `.js` AST
 * NB: the resulting `.js` AST is custom, and can only be interpreted by this
 * repo's code generator. JS compilers will not be able to interpret this
 * AST.
 */

export default function buildBoilerplate(nodeType, fields = {}) {
  const {
    stateName,
    contractName,
    stateVarIds = [],
    parameters = [], // used for extra params in generateProof
    newOwnerStatment,
    increment,
    onChainKeyRegistry = `false`,
  } = fields;
  switch (nodeType) {
    case 'Imports':
      // once per function
      return [
        `/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */`,
        `\nimport config from 'config';`,
        `\nimport utils from 'zkp-utils';`,
        `\nimport GN from 'general-number';`,
        `\nimport fs from 'fs';
        \n`,
        `\nimport { getContractInstance, registerKey, getInputCommitments } from './common/contract.mjs';`,
        `\nimport { generateProof } from './common/zokrates.mjs';`,
        `\nimport { getMembershipWitness } from './common/timber.mjs';
        \n`,
        `\nconst { generalise } = GN;`,
        `\nconst db = '/app/orchestration/common/db/preimage.json';`,
        `\nconst keyDb = '/app/orchestration/common/db/key.json';\n\n`,
      ];

    case 'InitialisePreimage':
      // once per state
      // only whole states
      return `
      \n // Initialise commitment preimage of whole state:
      \nlet ${stateName}_commitmentExists = true;
      let ${stateName}_witnessRequired = true;
      if (!fs.existsSync(db) || !JSON.parse(fs.readFileSync(db, 'utf-8').${stateName}
    ).${stateName}) {
          const preimage = {};
          preimage.${stateName} = {
          \t${stateName}: 0,
          \tsalt: 0,
          \tcommitment: 0,
          };
          fs.writeFileSync(db, JSON.stringify(preimage, null, 4));
          ${stateName}_commitmentExists = false;
          ${stateName}_witnessRequired = false;
        }
      \nconst ${stateName}_preimage = JSON.parse(
          fs.readFileSync(db, 'utf-8', err => {
            console.log(err);
          }),
        ).${stateName};`;

    case 'ReadPreimage':
      // once per state
      switch (fields.stateType) {
        case 'increment':
          return `
            ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
            ${stateVarIds.join('\n')}
            \n`;
        case 'decrement':
          return `
            \nconst ${stateName}_preimage = JSON.parse(
              fs.readFileSync(db, 'utf-8', err => {
                console.log(err);
              }),
            );
            \nconst ${stateName}_0_oldCommitment = _${stateName}_0_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${increment}.integer)[0] : generalise(_${stateName}_0_oldCommitment).hex(32);
            \nconst ${stateName}_1_oldCommitment = _${stateName}_1_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${increment}.integer)[1] : generalise(_${stateName}_1_oldCommitment).hex(32);

            \n${stateName}_newOwnerPublicKey = ${newOwnerStatment}
            const ${stateName}_0_prevSalt = generalise(${stateName}_preimage[${stateName}_0_oldCommitment].salt);
            const ${stateName}_1_prevSalt = generalise(${stateName}_preimage[${stateName}_1_oldCommitment].salt);
            const ${stateName}_0_prev = generalise(${stateName}_preimage[${stateName}_0_oldCommitment].value);
            const ${stateName}_1_prev = generalise(${stateName}_preimage[${stateName}_1_oldCommitment].value);
            ${stateVarIds.join('\n')}
            \n`;
        case 'whole':
          return `
          ${stateName}_newOwnerPublicKey = ${newOwnerStatment}
            const ${stateName}_currentCommitment = generalise(${stateName}_preimage.commitment);
            const ${stateName}_prev = generalise(${stateName}_preimage.${stateName});
            const ${stateName}_prevSalt = generalise(${stateName}_preimage.salt);
            ${stateVarIds.join('\n')}
            \n`;
        case 'preamble':
          return `
          \n\n// Read dbs for keys and previous commitment values:
          \nif (!fs.existsSync(keyDb)) await registerKey(utils.randomHex(32), '${contractName}', ${onChainKeyRegistry});
          const keys = JSON.parse(
                      fs.readFileSync(keyDb, 'utf-8', err => {
                        console.log(err);
                      }),
                    );
                  const secretKey = generalise(keys.secretKey);
                  const publicKey = generalise(keys.publicKey);`;
        default:
          throw new TypeError(fields.stateType);
      }

    case 'MembershipWitness':
      // once per state
      switch (fields.stateType) {
        case 'partitioned':
          return `
            const ${stateName}_witness_0 = await getMembershipWitness('${contractName}', generalise(${stateName}_0_oldCommitment).integer);
            const ${stateName}_witness_1 = await getMembershipWitness('${contractName}', generalise(${stateName}_1_oldCommitment).integer);
            const ${stateName}_0_index = generalise(${stateName}_witness_0.index);
            const ${stateName}_1_index = generalise(${stateName}_witness_1.index);
            const ${stateName}_root = generalise(${stateName}_witness_0.root);
            const ${stateName}_0_path = generalise(${stateName}_witness_0.path).all;
            const ${stateName}_1_path = generalise(${stateName}_witness_1.path).all;\n`;
        case 'whole':
          return `
            const emptyPath = new Array(32).fill(0);
            const ${stateName}_witness = ${stateName}_witnessRequired
            \t? await getMembershipWitness('${contractName}', ${stateName}_currentCommitment.integer)
            \t: { index: 0, path: emptyPath, root: 0 };
            const ${stateName}_index = generalise(${stateName}_witness.index);
            const ${stateName}_root = generalise(${stateName}_witness.root);
            const ${stateName}_path = generalise(${stateName}_witness.path).all;\n`;
        default:
          throw new TypeError(fields.stateType);
      }

    case 'CalculateNullifier':
      // once per state
      switch (fields.stateType) {
        case 'partitioned':
          return `
            let ${stateName}_0_nullifier = generalise(utils.shaHash(${stateName}_stateVarId, secretKey.hex(32), ${stateName}_0_prevSalt.hex(32)));
            let ${stateName}_1_nullifier = generalise(utils.shaHash(${stateName}_stateVarId, secretKey.hex(32), ${stateName}_1_prevSalt.hex(32)));
            ${stateName}_0_nullifier = generalise(${stateName}_0_nullifier.hex(32, 31)); // truncate
            ${stateName}_1_nullifier = generalise(${stateName}_1_nullifier.hex(32, 31)); // truncate`;
        case 'whole':
          return `
            let ${stateName}_nullifier = ${stateName}_commitmentExists ? generalise(utils.shaHash(${stateName}_stateVarId, secretKey.hex(32), ${stateName}_prevSalt.hex(32))) : generalise(0);
            \n${stateName}_nullifier = generalise(${stateName}_nullifier.hex(32, 31)); // truncate`;
        default:
          throw new TypeError(fields.stateType);
      }

    case 'CalculateCommitment':
      // once per state
      switch (fields.stateType) {
        case 'increment':
          return `
          \nconst ${stateName}_newSalt = generalise(utils.randomHex(32));
          \nlet ${stateName}_newCommitment = generalise(utils.shaHash(${stateName}_stateVarId, ${increment}.hex(32), ${stateName}_newOwnerPublicKey.hex(32), ${stateName}_newSalt.hex(32)));
          \n${stateName}_newCommitment = generalise(${stateName}_newCommitment.hex(32, 31)); // truncate`;
        case 'decrement':
          return `
            \nconst ${stateName}_2_newSalt = generalise(utils.randomHex(32));
            \nlet ${stateName}_change = parseInt(${stateName}_0_prev.integer, 10) + parseInt(${stateName}_1_prev.integer, 10) - parseInt(${increment}.integer, 10);
            \n${stateName}_change = generalise(${stateName}_change);
            \nlet ${stateName}_2_newCommitment = generalise(utils.shaHash(${stateName}_stateVarId, ${stateName}_change.hex(32), publicKey.hex(32), ${stateName}_2_newSalt.hex(32)));
            \n${stateName}_2_newCommitment = generalise(${stateName}_2_newCommitment.hex(32, 31)); // truncate`;
        case 'whole':
          return `
            \nconst ${stateName}_newSalt = generalise(utils.randomHex(32));
            \nlet ${stateName}_newCommitment = generalise(utils.shaHash(${stateName}_stateVarId, ${stateName}.hex(32), ${stateName}_newOwnerPublicKey.hex(32), ${stateName}_newSalt.hex(32)));
            \n${stateName}_newCommitment = generalise(${stateName}_newCommitment.hex(32, 31)); // truncate`;
        default:
          throw new TypeError(fields.stateType);
      }

    case 'GenerateProof':
      // once per state
      switch (fields.stateType) {
        case 'increment':
          return `
              ${stateVarIds.join('\n')}
              \t${stateName}_newOwnerPublicKey.limbs(32, 8),
              \t${stateName}_newSalt.limbs(32, 8),
              \t${stateName}_newCommitment.integer`;
        case 'decrement':
          return `
              ${parameters.join('\n')}${stateVarIds.join('\n')}
              \tsecretKey.limbs(32, 8),
              \tsecretKey.limbs(32, 8),
              \t${stateName}_0_nullifier.integer,
              \t${stateName}_1_nullifier.integer,
              \t${stateName}_0_prev.integer,
              \t${stateName}_0_prevSalt.limbs(32, 8),
              \t${stateName}_1_prev.integer,
              \t${stateName}_1_prevSalt.limbs(32, 8),
              \t${stateName}_root.integer,
              \t${stateName}_0_index.integer,
              \t${stateName}_0_path.integer,
              \t${stateName}_1_index.integer,
              \t${stateName}_1_path.integer,
              \t${stateName}_newOwnerPublicKey.limbs(32, 8),
              \t${stateName}_2_newSalt.limbs(32, 8),
              \t${stateName}_2_newCommitment.integer`;
        case 'whole':
          return `
              ${parameters.join('\n')}${stateVarIds.join('\n')}
              \tsecretKey.limbs(32, 8),
              \t${stateName}_nullifier.integer,
              \t${stateName}_prev.limbs(32, 8),
              \t${stateName}_prevSalt.limbs(32, 8),
              \t!${stateName}_commitmentExists,
              \tpublicKey.limbs(32, 8),
              \t${stateName}_root.integer,
              \t${stateName}_index.integer,
              \t${stateName}_path.integer,
              \t${stateName}_newOwnerPublicKey.limbs(32, 8),
              \t${stateName}_newSalt.limbs(32, 8),
              \t${stateName}_newCommitment.integer`;
        default:
          throw new TypeError(fields.stateType);
      }

    case 'SendTransaction':
      // we don't use this builder, because sendtx only requires a few lines which are very custom
      break;
    case 'WritePreimage':
      // once per state
      switch (fields.stateType) {
        case 'increment':
          return `
            \npreimage[${stateName}_newCommitment.hex(32)] = {
            \tvalue: ${increment}.integer,
            \tsalt: ${stateName}_newSalt.integer,
            \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
            \tcommitment: ${stateName}_newCommitment.integer,
            };`;
        case 'decrement':
          return `
            \npreimage[generalise(${stateName}_0_oldCommitment).hex(32)].isNullified = true;
            \npreimage[generalise(${stateName}_1_oldCommitment).hex(32)].isNullified = true;
            \npreimage[${stateName}_2_newCommitment.hex(32)] = {
            \tvalue: ${stateName}_change.integer,
            \tsalt: ${stateName}_2_newSalt.integer,
            \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
            \tcommitment: ${stateName}_2_newCommitment.integer,
            };`;
        case 'whole':
          return `
            \npreimage.${stateName} = {
            \t${stateName}: ${stateName}.integer,
            \tsalt: ${stateName}_newSalt.integer,
            \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
            \tcommitment: ${stateName}_newCommitment.integer,
            };`;
        default:
          throw new TypeError(fields.stateType);
      }

    case 'IntegrationTestBoilerplate':
      return {
        fnimport: `import FUNCTION_NAME from './FUNCTION_NAME.mjs';`,
        prefix: `import { startEventFilter, getSiblingPath } from './common/timber.mjs';\nimport logger from './common/logger.mjs';\nimport web3 from './common/web3.mjs';\n\n
        /**
        Welcome to your zApp's integration test!
        Depending on how your functions interact and the range of inputs they expect, the below may need to be changed.
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
          }`,
        suffix: `});`,
        // below regex extracts everything below the first 'describe' (i.e. the outer test function)
        function: `// eslint-disable-next-line func-names \n ${
          fs.readFileSync(testReadPath, 'utf8').match(/describe?[\s\S]*/g)[0]
        }`,
      };
    case 'ZappFilesBoilerplate':
      return [
        {
          readPath: 'src/boilerplate/common/bin/setup',
          writePath: '/bin/setup',
          generic: false,
        },
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
    default:
      throw new TypeError(nodeType);
  }
}

// PoKoSK = {
//   importStatements() {
//     return [`from "./common/hashes/sha256/pad256ThenHash.zok" import main as sha256of256`];
//   },
//
//   parameters({ name: x }) {
//     return [`private u32[8] ${x}_oldCommitment_owner_secretKey`];
//   },
//
//   postStatements({ name: x }) {
//     // default nullification lines (for partitioned & whole states)
//     return [
//       `
//       // ${x}_oldCommitment - PoKoSK:
//       // The correctness of this secret key will be constrained within the oldCommitment existence check.
//
//       u32[8] ${x}_oldCommitment_owner_publicKey = sha256of256([...${x}_oldCommitment_owner_secretKey])`,
//     ];
//   },
// };

//   nullification = {
//     importStatements() {
//       return [
//         `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
//         `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
//         `from "./common/hashes/sha256/pad768ThenHash.zok" import main as sha256of768`,
//       ];
//     },
//
//     parameters({ name: x }) {
//       return [
//         `private u32[8] ${x}_oldCommitment_owner_secretKey`,
//         `public field ${x}_oldCommitment_nullifier`,
//       ];
//     },
//
//     preStatements({ name: x, id, isMapping }) {
//       if (isMapping) return [];
//       return [
//         `
//         // We need to hard-code each stateVarId into the circuit:
//         u32[8] ${x}_stateVarId = field_to_u32_8(${id})`, // TODO: this results in unnecessary unpacking constraints, but simplifies transpilation effort, for now.
//       ];
//     },
//
//     postStatements({ name: x }) {
//       // default nullification lines (for partitioned & whole states)
//       const lines = [
//         `
//         // Nullify ${x}:
//
//         u32[8] ${x}_oldCommitment_nullifier_check = sha256of768([\\
//           ...${x}_stateVarId,\\
//           ...${x}_oldCommitment_owner_secretKey,\\
//           ...${x}_oldCommitment_salt\\
//         ])
//
//         assert(\\
//         field_to_bool_256(${x}_oldCommitment_nullifier)[8..256] == u32_8_to_bool_256(${x}_oldCommitment_nullifier_check)[8..256]\\
//         )`,
//       ];
//
//       if (this.isWhole) {
//         // whole states also need to handle the case of a dummy nullifier
//         const newLines = [
//           `
//           ${x}_oldCommitment_owner_secretKey = if ${x}_oldCommitment_isDummy then [0x00000000; 8] else ${x}_oldCommitment_owner_secretKey fi
//
//           ${x}_oldCommitment_salt = if ${x}_oldCommitment_isDummy then [0x00000000; 8] else ${x}_oldCommitment_salt fi`,
//         ];
//         newLines.concat(lines);
//       }
//
//       return lines;
//     },
//   };
//
//   oldCommitmentPreimage = {
//     importStatements() {
//       return [
//         `from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024`,
//         `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
//       ];
//     },
//
//     parameters({ name: x }) {
//       // prettier-ignore
//       return [
//         `private field ${x}_oldCommitment_value`,
//         `private u32[8] ${x}_oldCommitment_salt`,
//       ];
//     },
//
//     preStatements({ name: x }) {
//       // For a state variable, we'll have passed in `${x}_oldCommitment_value` as a parameter. But our AST nodes will be using `${x}`. This line resolves the two.
//       return [
//         `
//         field ${x} = ${x}_oldCommitment_value`,
//       ];
//     },
//
//     postStatements({ name: x }) {
//       return [
//         `
//         // ${x}_oldCommitment_commitment: preimage check
//
//         u32[8] ${x}_oldCommitment_commitment = sha256of1024([\\
//           ...${x}_stateVarId,\\
//           ...field_to_u32_8(${x}_oldCommitment_value),\\
//           ...${x}_oldCommitment_owner_publicKey,\\
//           ...${x}_oldCommitment_salt\\
//         ])`,
//       ];
//     },
//   };
//
//   oldCommitmentExistence = {
//     importStatements() {
//       return [
//         `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
//         `from "utils/pack/bool/pack256.zok" import main as bool_256_to_field`,
//         `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
//         `from "./common/merkle-tree/mimc/altbn254/verify-membership/height32.zok" import main as checkRoot`,
//       ];
//     },
//
//     parameters({ name: x, isWhole }) {
//       const lines = [
//         `public field commitmentRoot`,
//         `private field ${x}_oldCommitment_membershipWitness_index`,
//         `private field[32] ${x}_oldCommitment_membershipWitness_siblingPath`,
//       ];
//       if (isWhole) {
//         lines.unshift(`private bool ${x}_oldCommitment_isDummy`);
//       }
//       return lines;
//     },
//
//     postStatements({ name: x, isWhole }) {
//       const lines = [
//         `
//         // ${x}_oldCommitment_commitment: existence check
//
//         field ${x}_oldCommitment_commitment_truncated = bool_256_to_field([...[false; 8], ...u32_8_to_bool_256(${x}_oldCommitment_commitment)[8..256]])
//
//         field ${x}_commitmentRoot_check = checkRoot(\\
//           ${x}_oldCommitment_membershipWitness_siblingPath,\\
//           ${x}_oldCommitment_commitment_truncated,\\
//           ${x}_oldCommitment_membershipWitness_index\\
//         )
//
//         assert(\\
//           field_to_bool_256(commitmentRoot)[8..256] == field_to_bool_256(${x}_commitmentRoot_check)[8..256]\\
//         )`,
//       ];
//
//       if (isWhole) {
//         // initialisation of whole states requires a dummy oldCommitment to be ignored.
//         lines.splice(
//           -1,
//           0,
//           `
//         // Note: Don't bother actually asserting existence, if the oldCommitment is a dummy:
//         ${x}_commitmentRoot_check = if ${x}_oldCommitment_isDummy == true then commitmentRoot else ${x}_commitmentRoot_check fi`,
//         );
//       }
//       return lines;
//     },
//   };
//
//   newCommitment = {
//     importStatements() {
//       return [
//         `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
//         `from "utils/pack/u32/unpack256ToBits.zok" import main as u32_8_to_bool_256`,
//         `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
//         `from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024`,
//         `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
//       ];
//     },
//
//     parameters({ name: x }) {
//       return [
//         `private u32[8] ${x}_newCommitment_owner_publicKey`,
//         `private u32[8] ${x}_newCommitment_salt`,
//         `public field ${x}_newCommitment_commitment`,
//       ];
//     },
//
//     preStatements({ name: x, id, isMapping }) {
//       if (isMapping) return [];
//       return [
//         `
//         // We need to hard-code each stateVarId into the circuit:
//         u32[8] ${x}_stateVarId = field_to_u32_8(${id})`, // TODO: this results in unnecessary unpacking constraints, but simplifies transpilation effort, for now.
//       ];
//     },
//
//     postStatements({ name: x }) {
//       return [
//         `
//         // prepare secret state '${x}' for commitment
//
//         u32[8] ${x}_newCommitment_value = field_to_u32_8(${x})
//
//         // ${x}_newCommitment_commitment - preimage check
//
//         u32[8] ${x}_newCommitment_commitment_check = sha256of1024([\\
//           ...${x}_stateVarId,\\
//           ...${x}_newCommitment_value,\\
//           ...${x}_newCommitment_owner_publicKey,\\
//           ...${x}_newCommitment_salt\\
//         ])
//
//         assert(\\
//           field_to_bool_256(${x}_newCommitment_commitment)[8..256] == u32_8_to_bool_256(${x}_newCommitment_commitment_check)[8..256]\\
//         )`,
//       ];
//     },
//   };
//
//   mapping = {
//     importStatements() {
//       return [
//         `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
//         `from "./common/hashes/mimc/altbn254/mimc2.zok" import main as mimc2`,
//       ];
//     },
//
//     parameters({ mappingKeyName: k }) {
//       return [
//         `private field ${k}`, // must be a field, in case we need to do arithmetic on it.
//       ];
//     },
//
//     preStatements({ id: mappingId, mappingName: m }) {
//       return [
//         `
//         // We need to hard-code the mappingId's of mappings into the circuit:
//         field ${m}_mappingId = ${mappingId}`,
//       ];
//     },
//
//     postStatements({ name: x, mappingName: m, mappingKeyName: k }) {
//       // const x = `${m}_${k}`;
//       return [
//         `
//         field ${x}_stateVarId_field = mimc2([${m}_mappingId, ${k}])`,
//
//         `
//         u32[8] ${x}_stateVarId = field_to_u32_8(${x}_stateVarId_field)`, // convert to u32[8], for later sha256 hashing
//       ];
//     },
//   };
//
//   incrementation = {
//     importStatements() {
//       return []; // TODO: we might eventually import some underflow/overflow functions.
//     },
//
//     statements({ name: x, startIndex: i, addend }) {
//       const y = codeGenerator(addend);
//       return [
//         `
//         // The below represents the incrementation '${x} = ${x} + ${y}':
//
//         field ${x}_${i} = ${y}`,
//       ];
//     },
//   };
//
//   /** Partitioned states need boilerplate for a decrementation, because it's so weird and different from `a = a - b`. Whole states inherit directly from the AST, so don't need boilerplate here. */
//   decrementation = {
//     importStatements() {
//       return []; // TODO: we might eventually import some underflow/overflow functions.
//     },
//
//     statements({ name: x, startIndex, subtrahend }) {
//       const y = codeGenerator(subtrahend);
//       let i = startIndex;
//       const x0 = `${x}_${i++}`;
//       const x1 = `${x}_${i++}`;
//       const x2 = `${x}_${i}`;
//
//       return [
//         `
//         // The below represents the decrementation '${x} = ${x} - ${y}':
//
//         assert(${x0} + ${x1} > ${y})
//         // TODO: assert no under/overflows
//
//         field ${x2} = (${x0} + ${x1}) - ${y}`,
//       ];
//     },
//   };
//
// export default BoilerplateGenerator;
