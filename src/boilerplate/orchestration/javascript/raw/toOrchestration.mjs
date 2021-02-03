import logger from '../../../../utils/logger.mjs';

export const ZappFilesBoilerplate = [
  { readPath: 'src/boilerplate/common/bin/setup', writePath: '/bin/setup', generic: false },
  { readPath: 'src/boilerplate/common/bin/startup', writePath: '/bin/startup', generic: true },
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
    readPath: 'src/boilerplate/common/migrations/2_shield.js',
    writePath: 'migrations/2_shield.js',
    generic: false,
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
    readPath: 'src/boilerplate/common/truffle-config.js',
    writePath: './truffle-config.js',
    generic: true,
  },
];

export const sendTransactionBoilerplate = node => {
  const { privateStates } = node;
  const output = [];
  output[0] = [];
  output[1] = [];
  output[2] = [];
  // output[0] = root(s)
  // output[1] = arr of nullifiers
  // output[2] = arr of commitments
  for (const [privateStateName, stateNode] of Object.entries(privateStates)) {
    switch (stateNode.isPartitioned) {
      case true:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            output[0].push(`${privateStateName}_root.integer`);
            output[1].push(
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
        output[0].push(`${privateStateName}_root.integer`);
        output[1].push(`${privateStateName}_nullifier.integer`);
        output[2].push(`${privateStateName}_newCommitment.integer`);
        break;
    }
  }
  return output;
};

export const generateProofBoilerplate = node => {
  const { privateStates } = node;
  const output = [];
  for (const [privateStateName, stateNode] of Object.entries(privateStates)) {
    const lines = [];
    switch (stateNode.isWhole) {
      case true:
        node.parameters
          .filter(para => para !== node.privateStateName)
          .forEach(param => {
            if (!lines.includes(`\t${param}.integer,`)) lines.push(`\t${param}.integer,`);
          });
        output.push(`
            ${lines.join('  \t')}
            \t${privateStateName}_stateVarId,
            \t!${privateStateName}_commitmentExists,
            \t${privateStateName}_prev.limbs(32, 8),
            \tpublicKey.limbs(32, 8),
            \t${privateStateName}_prevSalt.limbs(32, 8),
            \t${privateStateName}_index.integer,
            \t${privateStateName}_path.integer,
            \tsecretKey.limbs(32, 8),
            \t${privateStateName}_nullifier.integer,
            \t${privateStateName}.limbs(32, 8),
            \t${privateStateName}_newOwnerPublicKey.limbs(32, 8),
            \t${privateStateName}_newSalt.limbs(32, 8),
            \t${privateStateName}_newCommitment.integer,
            \t${privateStateName}_root.integer`);
        break;
      case false:
      default:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            lines[0] = `
                \t${stateNode.increment}.integer`;
            // lines[1] = `
            //     \t${stateNode.increment}_newSalt.limbs(32, 8),
            //     \t${stateNode.increment}_newCommitment.integer`;
            if (!output.includes(lines[0])) output.push(lines[0]);
            output.push(`
                \tsecretKey.limbs(32, 8),
                \tsecretKey.limbs(32, 8),
                \t${privateStateName}_0_nullifier.integer,
                \t${privateStateName}_1_nullifier.integer,
                \t${privateStateName}_stateVarId,
                \t${privateStateName}_0_prev.limbs(32, 8),
                \t${privateStateName}_0_prevSalt.limbs(32, 8),
                \t${privateStateName}_stateVarId,
                \t${privateStateName}_1_prev.limbs(32, 8),
                \t${privateStateName}_1_prevSalt.limbs(32, 8),
                \t${privateStateName}_0_index.integer,
                \t${privateStateName}_0_path.integer,
                \t${privateStateName}_root.integer,
                \t${privateStateName}_1_index.integer,
                \t${privateStateName}_1_path.integer,
                \t${privateStateName}_stateVarId,
                \t${privateStateName}_newOwnerPublicKey.limbs(32, 8),
                \t${privateStateName}_2_newSalt.limbs(32, 8),
                \t${privateStateName}_2_newCommitment.integer`);
            //  if (!output.includes(lines[1])) output.push(lines[1]);
            output.push(`
                \t${privateStateName}_root.integer`);
            break;
          case false:
          default:
            // increment
            lines[0] = `
                \t${stateNode.increment}.limbs(32, 8)`;
            if (!output.includes(lines[0])) output.push(lines[0]);
            output.push(`
                \t${privateStateName}_stateVarId,
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
  for (const [privateStateName, stateNode] of Object.entries(node.privateStates)) {
    const lines = [];
    const stateVarIds = [];
    const initialiseParams = [];
    const preimageParams = [];
    stateNode.parameters.forEach(param => {
      // for each param which goes inside the commitment/ is used to calc commitment value
      if (stateNode.isWhole)
        lines.push(`const ${param}_prev = generalise(${privateStateName}_preimage.${param});`);
      const id = stateNode.stateVarId[stateNode.parameters.indexOf(param)];
      stateVarIds.push(`\nconst ${param}_stateVarId = ${id};`);
      initialiseParams.push(`\nlet ${param}_prev = generalise(0);`);
      preimageParams.push(`\t${param}: 0,`);
    });
    const newOwner = stateNode.isOwned ? stateNode.owner : null;
    let newOwnerStatment;
    switch (newOwner) {
      case null:
        newOwnerStatment = `${privateStateName}_newOwnerPublicKey === 0 ? publicKey : ${privateStateName}_newOwnerPublicKey;`;
        break;
      case 'msg':
        if (privateStateName.includes('msg')) {
          newOwnerStatment = `publicKey;`;
        } else {
          newOwnerStatment = `${privateStateName}_newOwnerPublicKey === 0 ? publicKey : ${privateStateName}_newOwnerPublicKey;`;
        }
        break;
      default:
        newOwnerStatment = `${newOwner};`;
        break;
    }

    switch (stateNode.isWhole) {
      case true:
        output.push(
          `${stateVarIds.join('\n')}
          \nlet ${privateStateName}_commitmentExists = true;
          \nlet ${privateStateName}_witnessRequired = true;\n
          if (!fs.existsSync(db)) {
              const preimage = {
              ${preimageParams.join('')}
              \tsalt: 0,
              \tcommitment: 0,
              };
              fs.writeFileSync(db, JSON.stringify(preimage, null, 4));
              ${privateStateName}_commitmentExists = false;
              ${privateStateName}_witnessRequired = false;
            }
          \nconst ${privateStateName}_preimage = JSON.parse(
              fs.readFileSync(db, 'utf-8', err => {
                console.log(err);
              }),
            );
          ${privateStateName}_newOwnerPublicKey = ${newOwnerStatment}
            const ${privateStateName}_currentCommitment = generalise(${privateStateName}_preimage.commitment);
            ${lines.join('')}
            const ${privateStateName}_prevSalt = generalise(${privateStateName}_preimage.salt);
            \n`,
        );
        break;
      case false:
      default:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            output.push(
              `${stateVarIds.join('\n')}
              \nconst ${privateStateName}_preimage = JSON.parse(
                fs.readFileSync(db, 'utf-8', err => {
                  console.log(err);
                }),
              );
              \n${privateStateName}_newOwnerPublicKey = ${newOwnerStatment}
              const ${privateStateName}_0_prevSalt = generalise(${privateStateName}_preimage[${privateStateName}_0_oldCommitment].salt);
              const ${privateStateName}_1_prevSalt = generalise(${privateStateName}_preimage[${privateStateName}_1_oldCommitment].salt);
              const ${privateStateName}_0_prev = generalise(${privateStateName}_preimage[${privateStateName}_0_oldCommitment].value);
              const ${privateStateName}_1_prev = generalise(${privateStateName}_preimage[${privateStateName}_1_oldCommitment].value);
              \n`,
            );
            break;
          case false:
          default:
            // increment
            output.push(
              `${stateVarIds.join('\n')}
              ${privateStateName}_newOwnerPublicKey = ${newOwnerStatment}
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
  const { privateStateName, increment } = node;
  switch (node.nodeType) {
    case 'Imports':
      // TODO proper db
      return {
        statements: [
          `/* eslint-disable prettier/prettier, no-use-before-define, babel/camelcase */`,
          `\nimport config from 'config';`,
          `\nimport utils from 'zkp-utils';`,
          `\nimport GN from 'general-number';`,
          `\nimport fs from 'fs';
          \n`,
          `\nimport { getContractInstance } from './common/contract.mjs';`,
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
        states.push(` _${node.decrementedSecretState}_0_oldCommitment = 0`);
        states.push(` _${node.decrementedSecretState}_1_oldCommitment = 0`);
        lines.push(
          `\nconst ${node.decrementedSecretState}_0_oldCommitment = generalise(_${node.decrementedSecretState}_0_oldCommitment);`,
        );
        lines.push(
          `\nconst ${node.decrementedSecretState}_1_oldCommitment = generalise(_${node.decrementedSecretState}_1_oldCommitment);`,
        );
      }
      node.returnParameters.forEach(param => rtnparams.push(`, ${param.integer}`));

      return {
        signature: [
          `\nexport default async function ${node.name}(${params}, ${states}) {`,
          `\nreturn { tx ${rtnparams.join('')}};
        \n}`,
        ],
        statements: lines,
      };

    case 'ReadPreimage':
      // please help with this terrible name
      // TODO proper db
      lines[0] = preimageBoilerPlate(node);
      return {
        statements: [
          `\nconst keys = JSON.parse(
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
          lines[0] = `\tvalue: ${increment}.integer,`;
        } else if (stateNode.increment && stateNode.nullifierRequired) {
          lines[0] = `\tvalue: change.integer,`;
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
                  `\npreimage[${stateName}_2_newCommitment.hex(32)] = {
                  ${lines.join('')}
                  \tsalt: ${stateName}_2_newSalt.integer,
                  \tpublicKey: publicKey.integer,
                  \tcommitment: ${stateName}_2_newCommitment.integer,
                  };
                  \nfs.writeFileSync(db, JSON.stringify(preimage, null, 4));`,
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
                  };
                  \nfs.writeFileSync(db, JSON.stringify(preimage, null, 4));`,
                );
                break;
            }
            break;
          case false:
          default:
            return {
              statements: [
                `\nconst ${stateName}_preimage_out = {
                ${lines.join('')}
                \tsalt: ${stateName}_newSalt.integer,
                \tpublicKey: ${stateName}_newOwnerPublicKey.integer,
                \tcommitment: ${stateName}_newCommitment.integer,
                };`,
                `\nfs.writeFileSync(db, JSON.stringify(${stateName}_preimage_out, null, 4));`,
              ],
            };
        }
      }
      return {
        statements: [
          `\nlet preimage = {};`,
          `\nif (!fs.existsSync(db)) {
            preimage = JSON.parse(
                fs.readFileSync(db, 'utf-8', err => {
                  console.log(err);
                }),
              );
          }`,
          states.join('\n'),
        ],
      };

    case 'MembershipWitness':
      if (node.isPartitioned) {
        return {
          statements: [
            `const witness_0 = await getMembershipWitness('${node.contractName}', ${privateStateName}_0_oldCommitment.integer);
            const witness_1 = await getMembershipWitness('${node.contractName}', ${privateStateName}_1_oldCommitment.integer);
            const ${privateStateName}_0_index = generalise(witness_0.index);
            const ${privateStateName}_1_index = generalise(witness_1.index);
            const ${privateStateName}_root = generalise(witness_0.root);
            const ${privateStateName}_0_path = generalise(witness_0.path).all;
            const ${privateStateName}_1_path = generalise(witness_1.path).all;\n`,
          ],
        };
      }
      if (node.isWhole) {
        return {
          statements: [
            `const emptyPath = new Array(32).fill(0);
            const witness = ${privateStateName}_witnessRequired
            \t? await getMembershipWitness('${node.contractName}', ${privateStateName}_currentCommitment.integer)
            \t: { index: 0, path: emptyPath, root: 0 };
            const ${privateStateName}_index = generalise(witness.index);
            const ${privateStateName}_root = generalise(witness.root);
            const ${privateStateName}_path = generalise(witness.path).all;\n`,
          ],
        };
      }
      return { statements: [] };

    case 'CalculateNullifier':
      if (node.isPartitioned) {
        return {
          statements: [
            `\nlet ${privateStateName}_0_nullifier = generalise(utils.shaHash(${privateStateName}_stateVarId, secretKey.hex(32), ${privateStateName}_0_prevSalt.hex(32)));
            let ${privateStateName}_1_nullifier = generalise(utils.shaHash(${privateStateName}_stateVarId, secretKey.hex(32), ${privateStateName}_1_prevSalt.hex(32)));
            ${privateStateName}_0_nullifier = generalise(${privateStateName}_0_nullifier.hex(32, 31)); // truncate
            ${privateStateName}_1_nullifier = generalise(${privateStateName}_1_nullifier.hex(32, 31)); // truncate`,
          ],
        };
      }
      return {
        statements: [
          `\nlet ${privateStateName}_nullifier = ${privateStateName}_commitmentExists ? generalise(utils.shaHash(${privateStateName}_stateVarId, secretKey.hex(32), ${privateStateName}_prevSalt.hex(32))) : generalise(0);
          \n${privateStateName}_nullifier = generalise(${privateStateName}_nullifier.hex(32, 31)); // truncate`,
        ],
      };
    case 'CalculateCommitment':
      switch (node.isIncremented) {
        case undefined:
        case false:
          node.parameters.forEach(param => {
            lines.push(`${param}.hex(32)`);
          });
          return {
            statements: [
              `\nconst ${privateStateName}_newSalt = generalise(utils.randomHex(32));`,
              `\nlet ${privateStateName}_newCommitment = generalise(utils.shaHash(${privateStateName}_stateVarId, ${lines}, ${privateStateName}_newOwnerPublicKey.hex(32), ${privateStateName}_newSalt.hex(32)));
              \n${privateStateName}_newCommitment = generalise(${privateStateName}_newCommitment.hex(32, 31)); // truncate`,
            ],
          };
        case true:
        default:
          switch (node.nullifierRequired) {
            case true:
              // decrement
              return {
                statements: [
                  `\nconst ${privateStateName}_2_newSalt = generalise(utils.randomHex(32));`,
                  `\nlet change = ${privateStateName}_0_prev.integer + ${privateStateName}_1_prev.integer - ${increment}.integer;`,
                  `\nchange = generalise(change);`,
                  `\nlet ${privateStateName}_2_newCommitment = generalise(utils.shaHash(${privateStateName}_stateVarId, change.hex(32), publicKey.hex(32), ${privateStateName}_2_newSalt.hex(32)));
                  \n${privateStateName}_2_newCommitment = generalise(${privateStateName}_2_newCommitment.hex(32, 31)); // truncate`,
                ],
              };
            case false:
            default:
              // increment
              return {
                statements: [
                  `\nconst ${privateStateName}_newSalt = generalise(utils.randomHex(32));`,
                  `\nlet ${privateStateName}_newCommitment = generalise(utils.shaHash(${privateStateName}_stateVarId, ${increment}.hex(32), ${privateStateName}_newOwnerPublicKey.hex(32), ${privateStateName}_newSalt.hex(32)));
                  \n${privateStateName}_newCommitment = generalise(${privateStateName}_newCommitment.hex(32, 31)); // truncate`,
                ],
              };
          }
      }

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
        lines.push(...node.publicInputs);
        lines[0] = `, ${lines[0]}`;
      }
      params[0] = sendTransactionBoilerplate(node);
      if (params[0][0][0]) params[0][0] = `${params[0][0]},`;
      if (params[0][1][0]) params[0][1] = `[${params[0][1]}],`;
      if (params[0][2][0]) params[0][2] = `[${params[0][2]}]`;
      return {
        statements: [
          `\nconst instance = await getContractInstance('${node.contractName}');`,
          `\nconst tx = await instance.methods
          .${node.functionName}(proof, ${params[0][0]} ${params[0][1]} ${params[0][2]}${lines})
          .send({
              from: config.web3.options.defaultAccount,
              gas: config.web3.options.defaultGas,
            });\n`,
        ],
      };

    case 'KeyRegistrationFunction':
      if (node.onChainKeyRegistry === true)
        lines.push(`\n\tconst instance = await getContractInstance('${node.contractName}');\n\tconst tx = await instance.methods
                .registerKey(publicKey.integer)
                .send({
                    from: config.web3.options.defaultAccount,
                    gas: config.web3.options.defaultGas,
                  });\n`);
      return {
        statements: [
          `\nexport async function registerKey(_secretKey) {`,
          `\n\tconst secretKey = generalise(_secretKey);`,
          `\n\tconst publicKey = generalise(utils.shaHash(secretKey.hex(32)));`,
          lines[0],
          `\n\tconst keyJson = {
            secretKey: secretKey.integer,
            publicKey: publicKey.integer, // not req
          };`,
          `\n\tfs.writeFileSync(keyDb, JSON.stringify(keyJson, null, 4));`,
          `\n}\n`,
        ],
      };
    default:
      return {};
  }
};

export default { OrchestrationCodeBoilerPlate, ZappFilesBoilerplate };
