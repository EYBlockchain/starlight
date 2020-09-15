import { getEventValuesFromTxReceipt } from '../utils/ethers';
import { hexToDec, flattenDeep } from './utils/crypto/conversions';
import { getTxReceipt, getContractWithWalletByName } from './contract';

/**
Converts a proof object to a flattened array of integers (field elements).
@param {object} proofObject - elliptic curve points - in the format provided by the zkp service.
*/
export const formatProof = proofObject => {
  let proof = Object.values(proofObject);
  // convert to flattened array:
  proof = flattenDeep(proof);
  // convert to decimal, as the solidity functions expect a proof to be am array of uints
  proof = proof.map(el => hexToDec(el));
  return proof;
};

/**
@param {array[field]} proof
@param {field} publicInputHash
@param {array[hex]} publicInputs
*/
export const createMSA = async (proof, publicInputHash, publicInputs) => {
  console.log('\nCreating MSA within the shield contract');
  console.log('proof:');
  console.log(proof);
  console.log('publicInputHash:');
  console.log(publicInputHash);
  console.log('publicInputs:');
  console.log(publicInputs);

  const shieldContract = await getContractWithWalletByName('Shield');
  const overrides = {
    // The maximum units of gas for the transaction to use
    gasLimit: 10000000,
  };
  const tx = await shieldContract.createMSA(proof, publicInputHash, ...publicInputs, overrides);
  // The operation is NOT complete yet; we must wait until it is mined
  await tx.wait();
  const txReceipt = await getTxReceipt(tx.hash);

  const { leafIndex, leafValue, root: newRoot } = getEventValuesFromTxReceipt(
    'NewLeaf',
    shieldContract,
    txReceipt,
  )[0];

  return {
    transactionHash: tx.hash,
    leafIndex,
    leafValue,
    newRoot,
  };
};

/**
@param {array[field]} proof
@param {field} publicInputHash
@param {array[hex]} publicInputs
*/
export const createPO = async (proof, publicInputHash, publicInputs) => {
  console.log('\nCreating PO within the shield contract');
  console.log('proof:');
  console.log(proof);
  console.log('publicInputHash:');
  console.log(publicInputHash);
  console.log('publicInputs:');
  console.log(publicInputs);

  const shieldContract = await getContractWithWalletByName('Shield');
  const overrides = {
    // The maximum units of gas for the transaction to use
    gasLimit: 10000000,
  };
  const tx = await shieldContract.createPO(proof, publicInputHash, ...publicInputs, overrides);
  // The operation is NOT complete yet; we must wait until it is mined
  await tx.wait();
  const txReceipt = await getTxReceipt(tx.hash);

  const { minLeafIndex, leafValues, root: newRoot } = getEventValuesFromTxReceipt(
    'NewLeaves',
    shieldContract,
    txReceipt,
  )[0];

  // TODO: How does a dynamic array (emitted as an event parameter) get formatted into an ethers transaction log
  const newMSALeafIndex = minLeafIndex;
  const newPOLeafIndex = minLeafIndex + 1;

  const newMSALeafValue = leafValues[0];
  const newPOLeafValue = leafValues[1];

  return {
    transactionHash: tx.hash,
    newMSALeafIndex,
    newPOLeafIndex,
    newMSALeafValue,
    newPOLeafValue,
    newRoot,
  };
};
