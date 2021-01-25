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

export const preimageBoilerPlate = node => {
  const lines = [];
  const stateVarIds = [];
  const initialiseParams = [];
  const preimageParams = [];
  const { privateStateName } = node;

  node.parameters.forEach(param => {
    // for each param which goes inside the commitment/ is used to calc commitment value
    const id = node.stateVarId[node.parameters.indexOf(param)];
    lines.push(`const ${param}_prev = generalise(${privateStateName}_preimage.${param});`);
    stateVarIds.push(`const ${param}_stateVarId = ${id};`);
    initialiseParams.push(`\nlet ${param}_prev = generalise(0);`);
    preimageParams.push(`\t${param}: 0,`);
  });
  switch (node.isWhole) {
    case true:
      return [
        `${stateVarIds.join('\n')}`,
        `\nlet ${privateStateName}_commitmentExists = true;`,
        `\nlet ${privateStateName}_witnessRequired = true;\n`,
        `if (!fs.existsSync(db)) {
            const preimage = {
            ${preimageParams.join('')}
            \tsalt: 0,
            \tcommitment: 0,
            };
            fs.writeFileSync(db, JSON.stringify(preimage, null, 4));
            ${privateStateName}_commitmentExists = false;
            ${privateStateName}_witnessRequired = false;
          }`,
        `\nconst ${privateStateName}_preimage = JSON.parse(
            fs.readFileSync(db, 'utf-8', err => {
              console.log(err);
            }),
          );
          const ${privateStateName}_currentCommitment = generalise(${privateStateName}_preimage.commitment);
          ${lines.join('')}
          const ${privateStateName}_prevSalt = generalise(${privateStateName}_preimage.salt);
          \n`,
      ];
    default:
      return [];
  }
};

/**
 * Parses the boilerplate import statements, and grabs any common statements.
 * @param {Object} options - must always include stage, for some cases includes other info
 * @return {Object} - common statements
 */

export const OrchestrationCodeBoilerPlate = node => {
  const lines = [];
  const params = [];
  const rtnparams = [];
  const { privateStateName } = node;
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
          `\nconst db = '/app/orchestration/common/db/preimage.json';\n\n`,
        ],
      };
    case 'FunctionDefinition':
      // the main function
      node.parameters.forEach(param => {
        lines.push(`\nconst ${param} = generalise(_${param});`);
        params.push(`_${param}`);
      });
      node.returnParameters.forEach(param => rtnparams.push(`, ${param.integer}`));
      return {
        signature: [
          `export default async function ${node.name}(${params}) {`,
          `\nreturn { tx ${rtnparams.join('')}};
        \n}`,
        ],
        statements: lines,
      };

    case 'ReadPreimage':
      // please help with this terrible name
      // TODO proper db
      return {
        statements: preimageBoilerPlate(node),
      };
    case 'WritePreimage':
      // please help with this terrible name
      // TODO proper db
      node.parameters.forEach(param => {
        lines.push(`\t${param}: ${param}.integer,`);
      });
      return {
        statements: [
          `\nconst preimage = {
          ${lines.join('')}
          \tsalt: ${privateStateName}_newSalt.integer,
          \tcommitment: ${privateStateName}_newCommitment.integer,
          };`,
          `\nfs.writeFileSync(db, JSON.stringify(preimage, null, 4));`,
        ],
      };

    case 'MembershipWitness':
      if (logger.level === 'debug') console.dir(node, { depth: 1 });
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
    case 'CalculateNullifier':
      return {
        statements: [
          `\nlet ${privateStateName}_nullifier = ${privateStateName}_commitmentExists ? generalise(utils.shaHash(${privateStateName}_stateVarId, secretKey.hex(32), ${privateStateName}_prevSalt.hex(32))) : generalise(0);
          \n${privateStateName}_nullifier = generalise(${privateStateName}_nullifier.hex(32, 31)); // truncate`,
        ],
      };
    case 'CalculateCommitment':
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
    case 'GenerateProof':
      node.parameters
        .filter(para => para !== node.privateStateName)
        .forEach(param => {
          lines.push(`\t${param}.integer,`);
        });

      // NEW:
      // add statevarid, isdummy bool, PUBLIC KEYS, secret key
      return {
        statements: [
          `\nconst allInputs = [
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
          \t${node.privateStateName}.limbs(32, 8),
          \t${privateStateName}_newOwnerPublicKey.limbs(32, 8),
          \t${privateStateName}_newSalt.limbs(32, 8),
          \t${privateStateName}_newCommitment.integer,
          \t${privateStateName}_root.integer,
        ].flat(Infinity);`,
          `\nconst res = await generateProof('${node.circuitName}', allInputs);`,
          `\nconst proof = generalise(Object.values(res.proof).flat(Infinity))
          .map(coeff => coeff.integer)
          .flat(Infinity);`,
        ],
      };
    case 'SendTransaction':
      return {
        statements: [
          `\nconst instance = await getContractInstance('${node.contractName}');`,
          `\nconst tx = await instance.methods
          .${node.functionName}(proof, ${privateStateName}_root.integer, [${privateStateName}_nullifier.integer], [${privateStateName}_newCommitment.integer])
          .send({
              from: config.web3.options.defaultAccount,
              gas: config.web3.options.defaultGas,
            });\n`,
        ],
      };
    default:
      return {};
  }
};

export default { OrchestrationCodeBoilerPlate, ZappFilesBoilerplate };
