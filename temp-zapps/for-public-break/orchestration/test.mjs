/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import assert from "assert";

import add from "./add.mjs";

import { startEventFilter, getSiblingPath } from "./common/timber.mjs";
import fs from "fs";
import GN from "general-number";
import { getAllCommitments } from "./common/commitment-storage.mjs";
import logger from "./common/logger.mjs";
import { decrypt } from "./common/number-theory.mjs";
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
const { generalise } = GN;
let leafIndex;
let encryption = {};
// eslint-disable-next-line func-names
describe("TestShield", async function () {
	this.timeout(3660000);
	try {
		await web3.connect();
	} catch (err) {
		throw new Error(err);
	}
	// eslint-disable-next-line func-names
	describe("add", async function () {
		this.timeout(3660000);
		try {
			await web3.connect();
		} catch (err) {
			throw new Error(err);
		}
		// eslint-disable-next-line func-names
		describe("First call", async function () {
			this.timeout(3660000);
			it("should call add", async () => {
				try {
					// this starts up the merkle tree's event filter
					await startEventFilter("TestShield");
					// this calls your function! It returns the tx from the shield contract
					// you can replace the values below - numbers are randomly generated
					const { tx, encEvent } = await add(89, 18);
					// prints the tx
					console.log(tx);
					// reassigns leafIndex to the index of the first commitment added by this function
					if (tx.event) {
						leafIndex = tx.returnValues[0];
						// prints the new leaves (commitments) added by this function call
						console.log(`Merkle tree event returnValues:`);
						console.log(tx.returnValues[0]);
					}
					if (encEvent[0].event) {
						encryption.msgs = encEvent[0].returnValues[0];
						encryption.key = encEvent[0].returnValues[1];
						console.log("EncryptedMsgs:");
						console.log(encEvent[0].returnValues[0]);
					}
					await sleep(10);
				} catch (err) {
					logger.error(err);
					process.exit(1);
				}
			});
			it("should update the merkle tree", async () => {
				try {
					// this is the path from your new commitment to the root of the tree - it's needed to show the commitment exists when you want to edit your secret state
					const path = await getSiblingPath("TestShield", leafIndex);
					console.log("Queried sibling path:");
					console.table(path, ["value", "nodeIndex"]);
				} catch (err) {
					logger.error(err);
					process.exit(1);
				}
			});
		});
		// eslint-disable-next-line func-names
		describe("Second Call", async function () {
			this.timeout(3660000);
			it("should call add again", async () => {
				try {
					// this calls your function a second time for incremental cases
					const { tx } = await add(58, 158);
					if (tx.event) {
						console.log(`Merkle tree event returnValues:`);
						console.log(tx.returnValues[0]);
					}
				} catch (err) {
					logger.error(err);
					process.exit(1);
				}
			});
		});
	});
});
