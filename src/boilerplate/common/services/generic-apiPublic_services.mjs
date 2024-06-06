/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import assert from "assert";
import FUNCTION_NAME from './FUNCTION_NAME.mjs';
import startEventFilter from "./common/timber.mjs";
import fs from "fs";
import logger from "./common/logger.mjs";
import web3 from "./common/web3.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let leafIndex;
let encryption = {};
// eslint-disable-next-line func-names

export async function service_FUNCTION_NAME (req, res, next){
  try {
    await web3.connect();
    await new Promise((resolve) => setTimeout(() => resolve(), 3000));
  } catch (err) {
    throw new Error(err);
  }
	try {
    await startEventFilter('CONTRACT_NAME');
    const FUNCTION_SIG;
    const { tx , _RESPONSE_} = await FUNCTION_NAME(FUNCTION_SIG);
    // prints the tx
    console.log(tx);
    res.send({tx, _RESPONSE_});
    // reassigns leafIndex to the index of the first commitment added by this function
    if (tx.event) {
      // prints the new leaves (commitments) added by this function call
      console.log(`Merkle tree event returnValues:`);
      console.log(tx.returnValues);
    }
   
    await sleep(10);
  } catch (err) {
    logger.error(err);
    res.send({ errors: [err.message] });
  }
}
