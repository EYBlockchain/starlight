/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import assert from "assert";
import FUNCTION_NAME from './FUNCTION_NAME.mjs';
import { startEventFilter, getSiblingPath } from "./common/timber.mjs";
import fs from "fs";
import logger from "./common/logger.mjs";
import { decrypt } from "./common/number-theory.mjs";
import { getAllCommitments, getCommitmentsByState } from "./common/commitment-storage.mjs";
import ServiceManager from './common/serviceManager.mjs'
import web3 from "./common/web3.mjs";

/**
      Welcome to your zApp's integration test!
      Depending on how your functions interact and the range of inputs they expect, the below may need to be changed.
      e.g. Your input contract has two functions, add() and minus(). minus() cannot be called before an initial add() - the compiler won't know this! You'll need to rearrange the below.
      e.g. The function add() only takes numbers greater than 100. The compiler won't know this, so you'll need to change the call to add() below.
      The transpiler automatically fills in any ZKP inputs for you and provides some dummy values for the original zol function.
      NOTE: if any non-secret functions need to be called first, the transpiler won't know! You'll need to add those calls below.
      NOTE: if you'd like to keep track of your commitments, check out ./common/db/preimage. Remember to delete this file if you'd like to start fresh with a newly deployed contract.
      */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let leafIndex;
let encryption = {};
// eslint-disable-next-line func-names

export class ServiceManager{
  constructor(web3){
    this.web3 =web3;
    this.FUNCTION_NAME = new FUNCTION_NAME(web3);
  }

  async init(){
    await this.FUNCTION_NAME.init();
  }

 async service_FUNCTION_NAME (req, res, next){
	try {
    await startEventFilter('CONTRACT_NAME');
    const FUNCTION_SIG;
    CONSTRUCTOR_INPUTS;
    const { tx , encEvent, encBackupEvent, _RESPONSE_} = await this.FUNCTION_NAME.FUNCTION_NAME(FUNCTION_SIG);
    // prints the tx
    console.log(tx);
    res.send({tx, encEvent, encBackupEvent, _RESPONSE_});
    // reassigns leafIndex to the index of the first commitment added by this function
    if (tx.event) {
      leafIndex = tx.returnValues[0];
      // prints the new leaves (commitments) added by this function call
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
