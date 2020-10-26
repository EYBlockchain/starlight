import config from 'config';
import utils from 'zkp-utils';
import GN from 'general-number';
import fs from 'fs';

import { getContractInstance } from '../../../src/utils/contract.mjs';
import { generateProof } from '../../../src/utils/zokrates.mjs';
import { getSiblingPath } from '../../../src/utils/timber.mjs';

const { generalise } = GN;
const db = '/app/examples/cases/uninit_global/db/preimage.json';

const formatProof = proof =>
  generalise(Object.values(proof).flat(Infinity))
    .map(coeff => coeff.integer)
    .flat(Infinity);

export async function assign(_value) {
  const value = generalise(_value);
  let preimage;
  let prevSalt;
  let prevValue;
  let currentCommitment;
  let commitmentExists;
  let witnessRequired;

  if (fs.existsSync(db)) {
    preimage = JSON.parse(
      fs.readFileSync(db, 'utf-8', err => {
        console.log(err);
      }),
    );
    currentCommitment = generalise(preimage.commitment);
    prevValue = generalise(preimage.value);
    prevSalt = generalise(preimage.salt);
    commitmentExists = true;
    witnessRequired = true;
  } else {
    commitmentExists = false;
    witnessRequired = false;
  }

  let nullifier = commitmentExists ? generalise(utils.shaHash(prevSalt.hex(32))) : generalise(0);
  nullifier = generalise(nullifier.hex(32, 31)); // truncate

  let path = witnessRequired
    ? await getSiblingPath('Assign', null, currentCommitment.integer)
    : new Array(33).fill(0); // will be ignored in circuit if no commitment exists

  let index = witnessRequired ? path[32].node.leafIndex : generalise(0);

  index = generalise(index);

  const root = witnessRequired ? generalise(path[0].value) : generalise(0);

  path = witnessRequired ? path.map(node => node.value) : path;
  path.splice(0, 1);

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

  const res = await generateProof(`assign`, allInputs);
  const proof = formatProof(res.proof);

  const instance = await getContractInstance('AssignShield');

  const tx = await instance.methods
    .assign(proof, root.integer, nullifier.integer, newCommitment.integer)
    .send({
      from: config.web3.options.defaultAccount,
      gas: config.web3.options.defaultGas,
    });

  preimage = {
    value: value.integer,
    salt: newSalt.integer,
    commitment: newCommitment.integer,
  };

  fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

  return tx;
}

export default assign;
