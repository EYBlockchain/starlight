import web3Instance from './common/web3.mjs';
import { startEventFilter, getSiblingPath } from './common/timber.mjs';
import fs from 'fs';
import logger from './common/logger.mjs';
import { decrypt } from './common/number-theory.mjs';
import { getAllCommitments, getCommitmentsByState, reinstateNullifiers, getBalance, getBalanceByState } from './common/commitment-storage.mjs';
import Contract from './common/contract.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const { generalise } = GN;
let leafIndex;
let encryption = {};

// Example API service function
export async function service_FUNCTION_NAME(req, res, next) {
  try {
    // Initialize the contract
    const contract = new Contract('CONTRACT_NAME');
    await contract.init();
    
    // Use the initialized Web3 instance and contract instance
    await startEventFilter('CONTRACT_NAME');

    const contractInstance = contract.getInstance();
    if (!contractInstance) {
      throw new Error('Failed to get contract instance');
    }

    const FUNCTION_SIG;
    CONSTRUCTOR_INPUTS;
    const { tx , encEvent, _RESPONSE_} = await FUNCTION_NAME(FUNCTION_SIG);
    // prints the tx
    console.log(tx);
    res.send({ tx, encEvent, _RESPONSE_ });
    
    // Update leafIndex with the first commitment added by this function
    if (tx.event) {
      leafIndex = tx.returnValues[0];
      // Print the new leaves (commitments) added by this function call
      console.log(`Merkle tree event returnValues:`);
      console.log(tx.returnValues);
    }
    
    if (encEvent.event) {
      encryption.msgs = encEvent[0].returnValues[0];
      encryption.key = encEvent[0].returnValues[1];
      console.log("EncryptedMsgs:");
      console.log(encEvent[0].returnValues[0]);
    }
    
    await sleep(10);
  } catch (err) {
    logger.error(err);
    res.send({ errors: [err.message] });
  }
}
