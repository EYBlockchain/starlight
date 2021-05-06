import fs from 'fs';

const testReadPath = './src/boilerplate/common/generic-test.mjs';

export const ZappFilesBoilerplate = [
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
  // {
  //   readPath: 'src/boilerplate/common/migrations/2_shield.js',
  //   writePath: 'migrations/2_shield.js',
  //   generic: false,
  // },
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

export const integrationTestBoilerplate = {
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

export const sendTransactionBoilerplate = node => {
  const { privateStates } = node;
  const output = [];
  output[0] = [];
  output[1] = [];
  output[2] = [];
  // output[0] = arr of nullifiers
  // output[1] = root(s)
  // output[2] = arr of commitments
  for (const [privateStateName, stateNode] of Object.entries(privateStates)) {
    switch (stateNode.isPartitioned) {
      case true:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            output[1].push(`${privateStateName}_root.integer`);
            output[0].push(
              `${privateStateName}_0_nullifier.integer, ${privateStateName}_1_nullifier.integer`,
            );
            output[2].push(`${privateStateName}_2_newCommitment.integer`);
            break;
          case false:
          default:
            // increment
            output[2].push(`${privateStateName}_newCommitment.integer`);
            break;
        }
        break;
      case false:
      default:
        // whole
        output[1].push(`${privateStateName}_root.integer`);
        output[0].push(`${privateStateName}_nullifier.integer`);
        output[2].push(`${privateStateName}_newCommitment.integer`);
        break;
    }
  }
  return output;
};

export const generateProofBoilerplate = node => {
  const { privateStates } = node;
  const privateStateNames = Object.keys(privateStates);
  const output = [];
  for (const [privateStateName, stateNode] of Object.entries(privateStates)) {
    const lines = [];
    const stateVarIdLines = stateNode.isMapping
      ? [`\n\t\t\t\t\t\t\t\t${privateStateName}_stateVarId_key.integer,`]
      : [];
    node.parameters
      .filter(
        para =>
          !privateStateNames.includes(para) &&
          !output.join().includes(`${para}.integer`),
      ) //  !== node.privateStateName)
      .forEach(param => {
        lines.push(`\t${param}.integer,`);
        // if (stateNode.owner.includes(param)) stateVarIdLines = [];
      });
    switch (stateNode.isWhole) {
      case true:
        output.push(`
            ${lines.join('  \n\t\t\t\t\t\t\t\t')}
            ${stateVarIdLines.join('  \n\t\t\t\t\t\t\t\t')}
            \tsecretKey.limbs(32, 8),
            \t${privateStateName}_nullifier.integer,
            \t${privateStateName}_prev.limbs(32, 8),
            \t${privateStateName}_prevSalt.limbs(32, 8),
            \t!${privateStateName}_commitmentExists,
            \tpublicKey.limbs(32, 8),
            \t${privateStateName}_root.integer,
            \t${privateStateName}_index.integer,
            \t${privateStateName}_path.integer,
            \t${privateStateName}_newOwnerPublicKey.limbs(32, 8),
            \t${privateStateName}_newSalt.limbs(32, 8),
            \t${privateStateName}_newCommitment.integer`);
        break;
      case false:
      default:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            if (
              !output.join().includes(`\t${stateNode.increment}.integer`) &&
              !lines.includes(`\t${stateNode.increment}.integer,`)
            )
              output.push(`\n\t\t\t\t\t\t\t\t${stateNode.increment}.integer`);
            output.push(`
                ${lines.join('  \n\t\t\t\t\t\t\t\t')}
                ${stateVarIdLines.join('  \n\t\t\t\t\t\t\t\t')}
                \tsecretKey.limbs(32, 8),
                \tsecretKey.limbs(32, 8),
                \t${privateStateName}_0_nullifier.integer,
                \t${privateStateName}_1_nullifier.integer,
                \t${privateStateName}_0_prev.integer,
                \t${privateStateName}_0_prevSalt.limbs(32, 8),
                \t${privateStateName}_1_prev.integer,
                \t${privateStateName}_1_prevSalt.limbs(32, 8),
                \t${privateStateName}_root.integer,
                \t${privateStateName}_0_index.integer,
                \t${privateStateName}_0_path.integer,
                \t${privateStateName}_1_index.integer,
                \t${privateStateName}_1_path.integer,
                \t${privateStateName}_newOwnerPublicKey.limbs(32, 8),
                \t${privateStateName}_2_newSalt.limbs(32, 8),
                \t${privateStateName}_2_newCommitment.integer`);
            //  if (!output.includes(lines[1])) output.push(lines[1]);
            // output.push(`
            //     \t${privateStateName}_root.integer`);
            break;
          case false:
          default:
            // increment
            if (
              !output.join().includes(`\t${stateNode.increment}.integer`)
              // && !lines.includes(`\t${stateNode.increment}.integer,`)
            )
              output.push(`\n\t\t\t\t\t\t\t\t${stateNode.increment}.integer`);

            output.push(`${stateVarIdLines.join('  \n\t\t\t\t\t\t\t\t')}
                \t${privateStateName}_newOwnerPublicKey.limbs(32, 8),
                \t${privateStateName}_newSalt.limbs(32, 8),
                \t${privateStateName}_newCommitment.integer`);
            break;
        }
    }
  }
  output.push(`\n].flat(Infinity);`);
  return output;
};

export const preimageBoilerPlate = node => {
  const output = [];
  for (const [privateStateName, stateNode] of Object.entries(
    node.privateStates,
  )) {
    const lines = [];
    const stateVarIds = [];
    const initialiseParams = [];
    const preimageParams = [];
    // stateNode.parameters.forEach(param => {
    // for each param which goes inside the commitment/ is used to calc commitment value
    if (stateNode.isWhole)
      lines.push(
        `const ${privateStateName}_prev = generalise(${privateStateName}_preimage.${privateStateName});`,
      );
    const id = stateNode.stateVarId[0]
      ? stateNode.stateVarId[0]
      : stateNode.stateVarId;
    if (!stateNode.stateVarId[1])
      stateVarIds.push(`\nconst ${privateStateName}_stateVarId = ${id};`);
    if (
      stateNode.stateVarId[1] &&
      privateStateName.includes(stateNode.stateVarId[1]) &&
      stateNode.stateVarId[1] !== 'msg'
    ) {
      stateVarIds.push(`\nlet ${privateStateName}_stateVarId = ${id};`);
      stateVarIds.push(
        `\nconst ${privateStateName}_stateVarId_key = ${stateNode.stateVarId[1]};`,
      );
      stateVarIds.push(
        `\n${privateStateName}_stateVarId = generalise(utils.mimcHash([generalise(${privateStateName}_stateVarId).bigInt, ${privateStateName}_stateVarId_key.bigInt], 'ALT_BN_254')).hex(32);`,
      );
    }

    if (stateNode.stateVarId[1] === 'msg' && privateStateName.includes('msg')) {
      stateVarIds.push(`\nlet ${privateStateName}_stateVarId = ${id};`);
      stateVarIds.push(
        `\nconst ${privateStateName}_stateVarId_key = ${privateStateName}_newOwnerPublicKey;`,
      );
      stateVarIds.push(
        `\n${privateStateName}_stateVarId = generalise(utils.mimcHash([generalise(${privateStateName}_stateVarId).bigInt, ${privateStateName}_stateVarId_key.bigInt], 'ALT_BN_254')).hex(32);`,
      );
    }
    initialiseParams.push(`\nlet ${privateStateName}_prev = generalise(0);`);
    preimageParams.push(`\t${privateStateName}: 0,`);
    // });
    const newOwner = stateNode.isOwned ? stateNode.owner : null;
    let newOwnerStatment;
    switch (newOwner) {
      case null:
        newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? publicKey : ${privateStateName}_newOwnerPublicKey;`;
        break;
      case 'msg':
        if (privateStateName.includes('msg')) {
          newOwnerStatment = `publicKey;`;
        } else {
          newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? publicKey : ${privateStateName}_newOwnerPublicKey;`;
        }
        break;
      default:
        // TODO - this is the case where the owner is an admin (state var)
        // we have to let the user submit the key and check it in the contract
        // newOwnerStatment = `${newOwner};`;
        if (!stateNode.ownerIsSecret && !stateNode.ownerIsParam) {
          newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? await instance.methods.${newOwner}().call() : ${privateStateName}_newOwnerPublicKey;`;
        } else if (stateNode.ownerIsParam) {
          newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? ${newOwner} : ${privateStateName}_newOwnerPublicKey;`;
        }
        break;
    }

    switch (stateNode.isWhole) {
      case true:
        output.push(
          `
          ${privateStateName}_newOwnerPublicKey = ${newOwnerStatment}
            const ${privateStateName}_currentCommitment = generalise(${privateStateName}_preimage.commitment);
            ${lines.join('')}
            const ${privateStateName}_prevSalt = generalise(${privateStateName}_preimage.salt);
            ${stateVarIds.join('\n')}
            \n`,
        );
        break;
      case false:
      default:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            output.push(
              `
              \nconst ${privateStateName}_preimage = JSON.parse(
                fs.readFileSync(db, 'utf-8', err => {
                  console.log(err);
                }),
              );
              \nconst ${privateStateName}_0_oldCommitment = _${privateStateName}_0_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${
                stateNode.increment
              }.integer)[0] : generalise(_${privateStateName}_0_oldCommitment).hex(32);
              \nconst ${privateStateName}_1_oldCommitment = _${privateStateName}_1_oldCommitment === 0 ? getInputCommitments(publicKey.integer, ${
                stateNode.increment
              }.integer)[1] : generalise(_${privateStateName}_1_oldCommitment).hex(32);

              \n${privateStateName}_newOwnerPublicKey = ${newOwnerStatment}
              const ${privateStateName}_0_prevSalt = generalise(${privateStateName}_preimage[${privateStateName}_0_oldCommitment].salt);
              const ${privateStateName}_1_prevSalt = generalise(${privateStateName}_preimage[${privateStateName}_1_oldCommitment].salt);
              const ${privateStateName}_0_prev = generalise(${privateStateName}_preimage[${privateStateName}_0_oldCommitment].value);
              const ${privateStateName}_1_prev = generalise(${privateStateName}_preimage[${privateStateName}_1_oldCommitment].value);
              ${stateVarIds.join('\n')}
              \n`,
            );
            break;
          case false:
          default:
            // increment
            output.push(
              `
              ${privateStateName}_newOwnerPublicKey = ${newOwnerStatment}
              ${stateVarIds.join('\n')}
              \n`,
            );
        }
    }
  }
  return output;
};

/**
 * Parses the boilerplate import statements, and grabs any common statements.
 * @param {Object} options - must always include stage, for some cases includes other info
 * @return {Object} - common statements
 */

export const OrchestrationCodeBoilerPlate = node => {
  const lines = [];
  const params = [];
  const states = [];
  const rtnparams = [];
  // const { privateStateName, increment } = node;
  switch (node.nodeType) {
    case 'Imports':
      // TODO proper db
      return {
        statements: [
          `/* eslint-disable prettier/prettier, no-use-before-define, camelcase, no-unused-vars */`,
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
        ],
      };
    case 'FunctionDefinition':
      // the main function
      lines.push(
        `\nconst instance = await getContractInstance('${node.contractName}');`,
      );
      node.inputParameters.forEach(param => {
        lines.push(`\nconst ${param} = generalise(_${param});`);
        params.push(`_${param}`);
      });

      node.parameters.modifiedStateVariables.forEach(param => {
        states.push(`_${param.name}_newOwnerPublicKey = 0`);
        lines.push(
          `\nlet ${param.name}_newOwnerPublicKey = generalise(_${param.name}_newOwnerPublicKey);`,
        );
      });

      if (node.decrementsSecretState) {
        node.decrementedSecretStates.forEach(decrementedState => {
          states.push(` _${decrementedState}_0_oldCommitment = 0`);
          states.push(` _${decrementedState}_1_oldCommitment = 0`);
        });
      }
      node.returnParameters.forEach(param =>
        rtnparams.push(`, ${param.integer}`),
      );

      return {
        signature: [
          `\nexport default async function ${node.name}(${params}, ${states}) {`,
          `\nreturn { tx ${rtnparams.join('')}};
        \n}`,
        ],
        statements: lines,
      };

    case 'InitialisePreimage':
      for (const stateName of node.privateStates) {
        lines.push(`
        \nlet ${stateName}_commitmentExists = true;
        let ${stateName}_witnessRequired = true;
        if (!fs.existsSync(db) || !JSON.parse(fs.readFileSync(db, 'utf-8')[${stateName}],
          )[${stateName}]) {
            const preimage = {};
            preimage[${stateName}] = {
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
          )[${stateName}];`);
      }
      return {
        statements: [lines],
      };

    case 'ReadPreimage':
      lines[0] = preimageBoilerPlate(node);
      states[0] = node.onChainKeyRegistry ? `true` : `false`;
      return {
        statements: [
          `\nif (!fs.existsSync(keyDb)) await registerKey(utils.randomHex(32), '${node.contractName}', ${states[0]});
          const keys = JSON.parse(
                      fs.readFileSync(keyDb, 'utf-8', err => {
                        console.log(err);
                      }),
                    );
                  const secretKey = generalise(keys.secretKey);
                  const publicKey = generalise(keys.publicKey);`,
          lines[0].join('\n'),
        ],
      };

    case 'WritePreimage':
      for (const [stateName, stateNode] of Object.entries(node.privateStates)) {
        if (stateNode.increment && !stateNode.nullifierRequired) {
          lines[0] = `\tvalue: ${stateNode.increment}.integer,`;
        } else if (stateNode.increment && stateNode.nullifierRequired) {
          lines[0] = `\tvalue: ${stateName}_change.integer,`;
        } else {
          stateNode.parameters.forEach(param => {
            lines.push(`\t${param}: ${param}.integer,`);
          });
        }

        switch (stateNode.isPartitioned) {
          case true:
            switch (stateNode.nullifierRequired) {
              case true:
                states.push(
                  `\npreimage[generalise(${stateName}_0_oldCommitment).hex(32)].isNullified = true;`,
                );
                states.push(
                  `\npreimage[generalise(${stateName}_1_oldCommitment).hex(32)].isNullified = true;`,
                );
                states.push(
                  `\npreimage[${stateName}_2_newCommitment.hex(32)] = {
                  ${lines.join('')}
                  \tsalt: ${stateName}_2_newSalt.integer,
                  \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
                  \tcommitment: ${stateName}_2_newCommitment.integer,
                  };`,
                );
                break;
              case false:
              default:
                states.push(
                  `\npreimage[${stateName}_newCommitment.hex(32)] = {
                  ${lines.join('')}
                  \tsalt: ${stateName}_newSalt.integer,
                  \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
                  \tcommitment: ${stateName}_newCommitment.integer,
                  };`,
                );
                break;
            }
            break;
          case false:
          default:
            states.push(
              `\npreimage[${stateName}] = {
              ${lines.join('')}
              \tsalt: ${stateName}_newSalt.integer,
              \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
              \tcommitment: ${stateName}_newCommitment.integer,
              };`,
            );
        }
      }
      return {
        statements: [
          `\nlet preimage = {};`,
          `\nif (fs.existsSync(db)) {
            preimage = JSON.parse(
                fs.readFileSync(db, 'utf-8', err => {
                  console.log(err);
                }),
              );
            }`,
          states.join('\n'),
          `\nfs.writeFileSync(db, JSON.stringify(preimage, null, 4));`,
        ],
      };

    case 'MembershipWitness':
      for (const [privateStateName, stateNode] of Object.entries(
        node.privateStates,
      )) {
        if (stateNode.isPartitioned) {
          lines.push(
            ...[
              `const ${privateStateName}_witness_0 = await getMembershipWitness('${node.contractName}', generalise(${privateStateName}_0_oldCommitment).integer);
              const ${privateStateName}_witness_1 = await getMembershipWitness('${node.contractName}', generalise(${privateStateName}_1_oldCommitment).integer);
              const ${privateStateName}_0_index = generalise(${privateStateName}_witness_0.index);
              const ${privateStateName}_1_index = generalise(${privateStateName}_witness_1.index);
              const ${privateStateName}_root = generalise(${privateStateName}_witness_0.root);
              const ${privateStateName}_0_path = generalise(${privateStateName}_witness_0.path).all;
              const ${privateStateName}_1_path = generalise(${privateStateName}_witness_1.path).all;\n`,
            ],
          );
        }
        if (stateNode.isWhole) {
          lines.push(
            ...[
              `const emptyPath = new Array(32).fill(0);
              const ${privateStateName}_witness = ${privateStateName}_witnessRequired
              \t? await getMembershipWitness('${node.contractName}', ${privateStateName}_currentCommitment.integer)
              \t: { index: 0, path: emptyPath, root: 0 };
              const ${privateStateName}_index = generalise(${privateStateName}_witness.index);
              const ${privateStateName}_root = generalise(${privateStateName}_witness.root);
              const ${privateStateName}_path = generalise(${privateStateName}_witness.path).all;\n`,
            ],
          );
        }
      }
      return { statements: lines };

    case 'CalculateNullifier':
      for (const [privateStateName] of Object.entries(node.privateStates)) {
        if (node.isPartitioned) {
          lines.push(
            ...[
              `\nlet ${privateStateName}_0_nullifier = generalise(utils.shaHash(${privateStateName}_stateVarId, secretKey.hex(32), ${privateStateName}_0_prevSalt.hex(32)));
              let ${privateStateName}_1_nullifier = generalise(utils.shaHash(${privateStateName}_stateVarId, secretKey.hex(32), ${privateStateName}_1_prevSalt.hex(32)));
              ${privateStateName}_0_nullifier = generalise(${privateStateName}_0_nullifier.hex(32, 31)); // truncate
              ${privateStateName}_1_nullifier = generalise(${privateStateName}_1_nullifier.hex(32, 31)); // truncate`,
            ],
          );
        } else {
          lines.push(
            ...[
              `\nlet ${privateStateName}_nullifier = ${privateStateName}_commitmentExists ? generalise(utils.shaHash(${privateStateName}_stateVarId, secretKey.hex(32), ${privateStateName}_prevSalt.hex(32))) : generalise(0);
              \n${privateStateName}_nullifier = generalise(${privateStateName}_nullifier.hex(32, 31)); // truncate`,
            ],
          );
        }
      }
      return {
        statements: lines,
      };

    case 'CalculateCommitment':
      for (const [, stateNode] of Object.entries(node.privateStates)) {
        const { privateStateName, increment } = stateNode;
        // if isMapping we have the key to hash with the stateVarId
        states[0] = `${privateStateName}_stateVarId`;
        switch (stateNode.isPartitioned) {
          case undefined:
          case false:
            lines.push(
              ...[
                `\nconst ${privateStateName}_newSalt = generalise(utils.randomHex(32));`,
                `\nlet ${privateStateName}_newCommitment = generalise(utils.shaHash(${states[0]}, ${privateStateName}.hex(32), ${privateStateName}_newOwnerPublicKey.hex(32), ${privateStateName}_newSalt.hex(32)));
                \n${privateStateName}_newCommitment = generalise(${privateStateName}_newCommitment.hex(32, 31)); // truncate`,
              ],
            );
            break;
          case true:
          default:
            switch (stateNode.nullifierRequired) {
              case true:
                // decrement
                lines.push(
                  ...[
                    `\nconst ${privateStateName}_2_newSalt = generalise(utils.randomHex(32));`,
                    `\nlet ${privateStateName}_change = parseInt(${privateStateName}_0_prev.integer, 10) + parseInt(${privateStateName}_1_prev.integer, 10) - parseInt(${increment}.integer, 10);`,
                    `\n${privateStateName}_change = generalise(${privateStateName}_change);`,
                    `\nlet ${privateStateName}_2_newCommitment = generalise(utils.shaHash(${states[0]}, ${privateStateName}_change.hex(32), publicKey.hex(32), ${privateStateName}_2_newSalt.hex(32)));
                    \n${privateStateName}_2_newCommitment = generalise(${privateStateName}_2_newCommitment.hex(32, 31)); // truncate`,
                  ],
                );
                break;
              case false:
              default:
                // increment
                lines.push(
                  ...[
                    `\nconst ${privateStateName}_newSalt = generalise(utils.randomHex(32));`,
                    `\nlet ${privateStateName}_newCommitment = generalise(utils.shaHash(${states[0]}, ${increment}.hex(32), ${privateStateName}_newOwnerPublicKey.hex(32), ${privateStateName}_newSalt.hex(32)));
                    \n${privateStateName}_newCommitment = generalise(${privateStateName}_newCommitment.hex(32, 31)); // truncate`,
                  ],
                );
            }
        }
      }
      return {
        statements: lines,
      };

    case 'GenerateProof':
      return {
        statements: [
          `\nconst allInputs = [`,
          generateProofBoilerplate(node),
          `\nconst res = await generateProof('${node.circuitName}', allInputs);`,
          `\nconst proof = generalise(Object.values(res.proof).flat(Infinity))
          .map(coeff => coeff.integer)
          .flat(Infinity);`,
        ],
      };
    case 'SendTransaction':
      if (node.publicInputs[0]) {
        node.publicInputs.forEach(input => {
          lines.push(`${input}.integer`);
        });
        // lines[0] = `, ${lines[0]}`;
        lines[lines.length - 1] += `, `;
      }
      params[0] = sendTransactionBoilerplate(node);
      if (params[0][1][0]) params[0][1] = `${params[0][1]},`;
      if (params[0][0][0]) params[0][0] = `[${params[0][0]}],`;
      if (params[0][2][0]) params[0][2] = `[${params[0][2]}]`;
      return {
        statements: [
          `\nconst tx = await instance.methods
          .${node.functionName}(${lines}${params[0][0]} ${params[0][1]} ${params[0][2]}, proof)
          .send({
              from: config.web3.options.defaultAccount,
              gas: config.web3.options.defaultGas,
            });\n`,
        ],
      };
    //
    // case 'KeyRegistrationFunction':
    //   if (node.onChainKeyRegistry === true)
    //     lines.push(`\n\tconst instance = await getContractInstance('${node.contractName}');\n\tconst tx = await instance.methods
    //             .registerKey(publicKey.integer)
    //             .send({
    //                 from: config.web3.options.defaultAccount,
    //                 gas: config.web3.options.defaultGas,
    //               });\n`);
    //   return {
    //     statements: [
    //       `\nexport async function registerKey(_secretKey) {`,
    //       `\n\tconst secretKey = generalise(_secretKey);`,
    //       `\n\tconst publicKey = generalise(utils.shaHash(secretKey.hex(32)));`,
    //       lines[0],
    //       `\n\tconst keyJson = {
    //         secretKey: secretKey.integer,
    //         publicKey: publicKey.integer, // not req
    //       };`,
    //       `\n\tfs.writeFileSync(keyDb, JSON.stringify(keyJson, null, 4));`,
    //       `\n}\n`,
    //     ],
    //   };
    default:
      return {};
  }
};

export default { OrchestrationCodeBoilerPlate, ZappFilesBoilerplate };
