/**
 * Parses the boilerplate import statements, and grabs any common statements.
 * @param {Object} options - must always include stage, for some cases includes other info
 * @return {Object} - common statements
 */

const OrchestrationCodeBoilerPlate = options => {
  const lines = [];
  switch (options.stage) {
    case 'Imports':
      // TODO proper db
      return {
        statements: [
          `\nimport config from 'config';`,
          `\nimport utils from 'zkp-utils';`,
          `\nimport GN from 'general-number';`,
          `\nimport fs from 'fs';
          \n`,
          `\nimport { getContractInstance } from '../../../src/utils/contract.mjs';`,
          `\nimport { generateProof } from '../../../src/utils/zokrates.mjs';`,
          `\nimport { getSiblingPath } from '../../../src/utils/timber.mjs';
          \n`,
          `\nconst { generalise } = GN;`,
          `\nconst db = '/app/examples/cases/uninit_global/db/preimage.json';`,
        ],
      };
    case 'FunctionDefinition':
      // the main function
      options.parameters.forEach(param => {
        lines.push(`\nconst ${param} = generalise(_${param});`);
        param = `_${param}`;
      });
      return {
        signature: [`export async function ${options.functionName}(${options.parameters}) {`, `}`],
        statements: lines,
      };
    case 'ReadPreimage':
      // please help with this terrible name
      // TODO proper db
      options.parameters.forEach(param => {
        lines.push(`\n\tprev${param} = generalise(preimage.${param});`);
        param = `let prev${param};`;
      });
      return {
        statements: [
          `\nlet preimage;`,
          `\nlet prevSalt;`,
          options.parameters,
          `\nlet currentCommitment;`,
          `\nlet commitmentExists;`,
          `\nlet witnessRequired;
          \n`,
          `\nif (fs.existsSync(db)) {
            \n\tpreimage = JSON.parse(
            \n\t\tfs.readFileSync(db, 'utf-8', err => {
                \n\t\t\tconsole.log(err);
              \n\t\t}),
            \n\t);
            \n\tcurrentCommitment = generalise(preimage.commitment);`,
          lines,
          `\n\tprevSalt = generalise(preimage.salt);
            \n\tcommitmentExists = true;
            \n\twitnessRequired = true;
          \n} else {
            \n\tcommitmentExists = false;
            \n\twitnessRequired = false;
          \n}`,
        ],
      };
    case 'WritePreimage':
      // please help with this terrible name
      // TODO proper db
      options.parameters.forEach(param => {
        lines.push(`\n\t${param}: = ${param}.integer,`);
      });
      return {
        statements: [
          `\npreimage = {`,
          lines,
          `\n\tsalt: newSalt.integer,
          \n\tcommitment: newCommitment.integer,
          \n};`,
          `\nfs.writeFileSync(db, JSON.stringify(preimage, null, 4));`,
        ],
      };
    case 'MembershipWitness':
      return {
        statements: [
          `\nlet path = witnessRequired
            \n\t? await getSiblingPath('${options.contractName}', null, currentCommitment.integer)
            \n\t: new Array(33).fill(0);`,
          `\nlet index = witnessRequired ? path[32].node.leafIndex : generalise(0);
          \nindex = generalise(index);`,
          `\nconst root = witnessRequired ? generalise(path[0].value) : generalise(0);`,
          `\npath = witnessRequired ? path.map(node => node.value) : path;
          \npath.splice(0, 1);`,
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
      options.parameters.forEach(param => {
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
      options.parameters.forEach(param => {
        lines.push(`\n\tprev${param}.limbs(32, 8),`);
      });
      options.parameters.forEach(param => {
        lines.push(`\n\t${param}.limbs(32, 8),`);
      });
      return {
        statements: [
          `\nconst allInputs = [``\n\tprevSalt.limbs(32, 8),`,
          lines,
          `\n\tnewSalt.limbs(32, 8),`,
          `\n\tindex.integer,`,
          `\n\tgeneralise(path).all.integer,`,
          `\n\troot.integer,`,
          `\n\tnullifier.integer,`,
          `\n\tnewCommitment.integer,`,
          `\n].flat(Infinity);`,
          `\nconst res = await generateProof(${options.circuitName}, allInputs);`,
          `\nconst proof = generalise(Object.values(proof).flat(Infinity))
              \n\t.map(coeff => coeff.integer)
              \n\t.flat(Infinity);`,
        ],
      };
    case 'SendTransaction':
      return {
        statements: [
          `\nconst instance = await getContractInstance('${options.contractName}');`,
          `\nconst tx = await instance.methods
            \n\t.${options.functionName}(proof, root.integer, nullifier.integer, newCommitment.integer)
            \n\t.send({
              \n\t\tfrom: config.web3.options.defaultAccount,
              \n\t\tgas: config.web3.options.defaultGas,
            \n\t});`,
        ],
      };
    default:
      return {};
  }
};

export default OrchestrationCodeBoilerPlate;
