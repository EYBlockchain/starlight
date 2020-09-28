import web3 from 'web3';
import utils from 'zkp-utils';
import zokrates from 'zokrates'; // not set up yet
import tree from 'merkle-tree';

let currentSalt;
let currentValue;
let root; // normally we would query this
let contractAddress; // this too

async function assign(value) {
  const nullifier = currentSalt ? utils.shaHash(currentSalt) : 0;

  currentValue = currentValue || 0;
  root = await tree.getRoot(); // make sure this returns 0 when empty

  const newSalt = utils.randomHex(32);
  const newCommitment = utils.shaHash(value, newSalt);

  const allInputs = utils.formatInputsForZkSnark([
    new Element(value, 'field', 128, 1), // newValue - the global var input
    new Element(currentSalt, 'field'), // old commitment preimage
    new Element(currentValue, 'field', 128, 1),
    new Element(root, 'field'), // current root of mt
    new Element(nullifier, 'field'),
    new Element(newSalt, 'field'), // new commitment preimage
    new Element(newCommitment, 'field'),
  ]);

  const witness = await zokrates.computeWitness(`./assign_out`, allInputs);
  const proof = await zokrates.generateProof(`./assign_pk.key`, `./assign_out`, witness);

  const instance = await web3.getContractInstance('AssignShield.sol', contractAddress);
  const tx = await instance.assign(proof, root, nullifier, newCommitment);

  currentValue = value;
  currentSalt = newSalt;
  return tx;
}

export default assign;
