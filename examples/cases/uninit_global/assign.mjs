import config from 'config';
import utils from 'zkp-utils';
import GN from 'general-number';

import { getContractInstance } from '../../../src/utils/contract.mjs';
import { generateProof } from '../../../src/utils/zokrates.mjs';
import { getSiblingPath } from '../../../src/utils/timber.mjs';
import logger from '../../../src/utils/logger.mjs';

const { generalise } = GN;
let currentSalt = generalise('69089008153250307177190178425993311722466992440572990705513631250807294133588'); // general number
let currentValue = generalise('10');
let currentCommitment = generalise('27634846343805787138311706540239887610761244549650326635140919565459517002');
let root = generalise('5751622558927030719140143782094603438076539172391937980489652641072158835988'); // normally we would query this
// const contractAddress = '0x9b1f7F645351AF3631a656421eD2e40f2802E6c0'; // this too
// let currentSalt;
// let currentValue;
// let currentCommitment;
// let root;

const formatProof = proof =>
  generalise(Object.values(proof).flat(Infinity))
    .map(coeff => coeff.integer)
    .flat(Infinity);

export async function assign(_value) {
  const value = generalise(_value);

  if (currentCommitment) {
    logger.info(
      `Previous commitment: ${currentCommitment.integer} Preimage: ${currentValue.integer}, ${currentSalt.integer}`,
    );
  } else {
    logger.info(`Assigning ${_value} to a variable for the first time`);
  }

  let nullifier = currentSalt ? generalise(utils.shaHash(currentSalt.hex(32))) : generalise(0);
  nullifier = generalise(nullifier.hex(32, 31)); // truncate

  const prevValue = currentValue || generalise('0');
  const prevSalt = currentSalt || generalise('0');
  const leafIndex = undefined;

  let path = currentCommitment
    ? await getSiblingPath('Assign', leafIndex, currentCommitment.integer)
    : new Array(33).fill(0); // will be ignored in circuit if no commitment exists

  const index = generalise(path[31].node) || generalise(0);

  root = generalise(path[0].value) || generalise(0);
  // root = generalise(root.hex(32, 31));
  path = currentCommitment ? path.map(node => node.value) : path;
  path.splice(0, 1);

  logger.info(`Sibling path array: ${path}`);

  const newSalt = generalise(utils.randomHex(32));
  let newCommitment = generalise(utils.shaHash(value.hex(32), newSalt.hex(32)));
  newCommitment = generalise(newCommitment.hex(32, 31)); // truncate

  const allInputs = [
    prevValue.limbs(32, 8),
    prevSalt.limbs(32, 8),
    value.limbs(32, 8),
    newSalt.limbs(32, 8),
    index.integer,
    generalise(path).all.integer,
    root.integer,
    nullifier.integer,
    newCommitment.integer,
  ].flat(Infinity);

  logger.info(allInputs);

  // below assumes we have compiled the circuit w outputs in app/outputs/assign
  // idea: when compiling, we create the circuit in this dir, then call load-circuits to add them to the ./circuits folder zokrates_worker looks in
  const res = await generateProof(`assign`, allInputs);
  const proof = formatProof(res.proof);

  logger.info(`proof: ${proof}`);
  logger.info(`new commitment: ${newCommitment.integer}, ${newCommitment.hex(32)}`);
  logger.info(`Preimage: ${value.integer}, ${newSalt.integer}`);
  if (currentCommitment) {
    logger.info(`Nullfier: ${nullifier.integer}`);
  }

  const instance = await getContractInstance('AssignShield');
  const tx = await instance.methods
    .assign(proof, root.integer, nullifier.integer, newCommitment.integer)
    .send({
      from: config.web3.options.defaultAccount,
      gas: config.web3.options.defaultGas,
    });

  currentValue = value;
  currentSalt = newSalt;
  currentCommitment = newCommitment;

  return tx;
}

export default assign;
