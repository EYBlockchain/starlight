/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import assert from "assert";
import FUNCTION_NAME from './FUNCTION_NAME.mjs';
import fs from "fs";
import logger from "./common/logger.mjs";
import web3 from "./common/web3.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let leafIndex;
let encryption = {};
// eslint-disable-next-line func-names
 async service_FUNCTION_NAME (req, res, next){
    const FUNCTION_SIG;
    const { tx , _RESPONSE_} = await this.FUNCTION_NAME.FUNCTION_NAME(FUNCTION_SIG);
    // prints the tx
    console.log(tx);
    res.send({tx, _RESPONSE_});
   
    if (tx.event) {
      console.log(tx.returnValues);
    }
  
}
