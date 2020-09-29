import web3 from 'web3';
import config from 'config';
import utils from 'zkp-utils';
import { getContractInstance } from '../../../src/utils/contract.mjs';
import { generalise } from '../../../src/utils/general-number.mjs';
import { generateProof } from '../../../src/utils/zokrates.mjs'; // not set up yet
import { getSiblingPath } from '../../../src/utils/timber.mjs';

let currentSalt; // general number
let currentValue;
let root; // normally we would query this
let contractAddress; // this too

const formatProof = proof =>
  generalise(Object.values(proof).flat(Infinity))
    .map(coeff => coeff.limbs(256))
    .flat(Infinity);

async function assign(_value) {
  const value = generalise(_value);
  const nullifier = currentSalt ? generalise(utils.shaHash(currentSalt.hex(32))) : generalise(0);

  currentValue = currentValue || generalise(0);

  let path = await getSiblingPath(utils.shaHash(currentValue.hex(16), currentSalt.hex(32))); // will be ignored in circuit if no commitment exists
  const { index } = generalise(path[31].node);
  root = generalise(path[0].value);
  path = path.map(node => generalise(node.value));

  const newSalt = generalise(utils.randomHex(32));
  const newCommitment = generalise(utils.shaHash(value.hex(16), newSalt.hex(32)));

  const allInputs = [
    currentValue.limbs(32, 4),
    currentSalt.limbs(32, 8),
    value.limbs(32, 4),
    newSalt.limbs(32, 8),
    index.integer,
    path.all.integer,
    root.integer,
    nullifier.limbs(32, 8),
    newCommitment.limbs(32, 8),
  ];

  // below assumes we have compiled the circuit w outputs in app/outputs/assign
  // idea: when compiling, we create the circuit in this dir, then call load-circuits to add them to the ./circuits folder zokrates_worker looks in
  const { _proof } = await generateProof(`assign`, allInputs);

  const proof = formatProof(_proof);

  const instance = await getContractInstance('AssignShield.sol', contractAddress);
  const tx = await instance.methods
    .assign(proof, root, nullifier.integer, newCommitment.integer)
    .send({
      from: config.account,
      gas: config.web3.defaultGas,
      gasPrice: config.web3.defaultGasPrice,
    });

  currentValue = value;
  currentSalt = newSalt;

  return tx;
}

export default assign;
