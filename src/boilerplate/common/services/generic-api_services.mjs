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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
    const { tx , newLeavesEvent, encEvent, encBackupEvent, _RESPONSE_} = await this.FUNCTION_NAME.FUNCTION_NAME(FUNCTION_SIG);
    // prints the tx
    console.log(tx);
    const txSerialized = serializeBigInt(tx);
    const newLeavesEventSerialized = serializeBigInt(newLeavesEvent);
    const encEventSerialized = serializeBigInt(encEvent);
    const encBackupEventSerialized = serializeBigInt(encBackupEvent);
    res.send({ tx: txSerialized, newLeavesEvent: newLeavesEventSerialized, encEvent: encEventSerialized, encBackupEvent: encBackupEventSerialized, _RESPONSE_ });
    if (newLeavesEvent) {
      console.log(`Merkle tree event returnValues:`);
      console.log(newLeavesEvent.returnValues);
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
