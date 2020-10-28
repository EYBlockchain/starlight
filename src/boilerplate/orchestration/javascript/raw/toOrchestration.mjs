/**
 * Parses the boilerplate import statements, and grabs any common statements.
 * @param {Object} options - must always include stage, for some cases includes other info
 * @return {Object} - common statements
 */

const OrchestrationCodeBoilerPlate = node => {
  const lines = [];
  const params = [];
  switch (node.nodeType) {
    case 'Imports':
      // TODO proper db
      return {
        statements: [
          `/* eslint-disable prettier/prettier, no-use-before-define */`,
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
          `\nconst db = './common/db/preimage.json';\n\n`,
        ],
      };
    case 'FunctionDefinition':
      // the main function
      node.parameters.forEach(param => {
        lines.push(`\nconst ${param} = generalise(_${param});`);
        params.push(`_${param}`);
      });
      return {
        signature: [`export default async function ${node.name}(${params}) {`, `}`],
        statements: lines,
      };
    case 'ReadPreimage':
      // please help with this terrible name
      // TODO proper db
      node.parameters.forEach(param => {
        lines.push(`\tprev${param} = generalise(preimage.${param});`);
        params.push(`let prev${param};`);
      });
      return {
        statements: [
          `\nlet preimage;`,
          `\nlet prevSalt;`,
          params,
          `\nlet currentCommitment;`,
          `\nlet commitmentExists;`,
          `\nlet witnessRequired;
          \n`,
          `if (fs.existsSync(db)) {
            preimage = JSON.parse(
              fs.readFileSync(db, 'utf-8', err => {
                console.log(err);
              }),
            );
            currentCommitment = generalise(preimage.commitment);
            ${lines.join('  \t')}
            prevSalt = generalise(preimage.salt);
            commitmentExists = true;
            witnessRequired = true;
          } else {
            commitmentExists = false;
            witnessRequired = false;
          }\n`,
        ],
      };
    case 'WritePreimage':
      // please help with this terrible name
      // TODO proper db
      node.parameters.forEach(param => {
        lines.push(`\t${param}: ${param}.integer,`);
      });
      return {
        statements: [
          `\npreimage = {
          ${lines.join('')}
          \tsalt: newSalt.integer,
          \tcommitment: newCommitment.integer,
          };`,
          `\nfs.writeFileSync(db, JSON.stringify(preimage, null, 4));`,
        ],
      };
    case 'MembershipWitness':
      return {
        statements: [
          `const emptyPath = new Array(32).fill(0);
          const witness = witnessRequired
          \t? await getMembershipWitness('Assign', currentCommitment.integer)
          \t: { index: 0, path: emptyPath, root: 0 };
          const index = generalise(witness.index);
          const root = generalise(witness.root);
          const path = generalise(witness.path).all;\n`,
        ],
      };
    case 'CalculateNullifier':
      return {
        statements: [
          `\nlet nullifier = commitmentExists ? generalise(utils.shaHash(prevSalt.hex(32))) : generalise(0);
          \nnullifier = generalise(nullifier.hex(32, 31)); // truncate`,
        ],
      };
    case 'CalculateCommitment':
      node.parameters.forEach(param => {
        lines.push(`${param}.hex(32)`);
      });
      return {
        statements: [
          `\nconst newSalt = generalise(utils.randomHex(32));`,
          `\nlet newCommitment = generalise(utils.shaHash(${lines}, newSalt.hex(32)));
          \nnewCommitment = generalise(newCommitment.hex(32, 31)); // truncate`,
        ],
      };
    case 'GenerateProof':
      node.parameters
        .filter(para => para !== node.privateStateName)
        .forEach(param => {
          lines.push(`\t${param}.integer,`);
        });
      return {
        statements: [
          `\nconst allInputs = [
          ${lines.join('  \t')}
          \tprev${node.privateStateName}.limbs(32, 8),
          \tprevSalt.limbs(32, 8),
          \tindex.integer,
          \tgeneralise(path).all.integer,
          \tnullifier.integer,
          \t${node.privateStateName}.limbs(32, 8),
          \tnewSalt.limbs(32, 8),
          \tnewCommitment.integer,
          \troot.integer,
        ].flat(Infinity);`,
          `\nconst res = await generateProof(${node.circuitName}, allInputs);`,
          `\nconst proof = generalise(Object.values(res).flat(Infinity))
          .map(coeff => coeff.integer)
          .flat(Infinity);`,
        ],
      };
    case 'SendTransaction':
      return {
        statements: [
          `\nconst instance = await getContractInstance('${node.contractName}');`,
          `\nconst tx = await instance.methods
          .${node.functionName}(proof, root.integer, nullifier.integer, newCommitment.integer)
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

export default OrchestrationCodeBoilerPlate;
