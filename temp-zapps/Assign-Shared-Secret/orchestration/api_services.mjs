/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import assert from "assert";

import quitSwap from "./quitSwap.mjs";

import completeSwap from "./completeSwap.mjs";

import startSwap from "./startSwap.mjs";

import deposit from "./deposit.mjs";

import { startEventFilter, getSiblingPath } from "./common/timber.mjs";
import fs from "fs";
import logger from "./common/logger.mjs";
import { decrypt } from "./common/number-theory.mjs";
import {
	getAllCommitments,
	getCommitmentsByState,
	reinstateNullifiers,
	getSharedSecretskeys,
	getBalance,
	getBalanceByState,
	addConstructorNullifiers,
} from "./common/commitment-storage.mjs";
import web3 from "./common/web3.mjs";

/**
      NOTE: this is the api service file, if you need to call any function use the correct url and if Your input contract has two functions, add() and minus().
      minus() cannot be called before an initial add(). */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let leafIndex;
let encryption = {};
// eslint-disable-next-line func-names

export async function SwapShield() {
	try {
		await web3.connect();
	} catch (err) {
		throw new Error(err);
	}
}
// eslint-disable-next-line func-names
export async function service_deposit(req, res, next) {
	try {
		await web3.connect();
		await new Promise((resolve) => setTimeout(() => resolve(), 3000));
	} catch (err) {
		throw new Error(err);
	}
	try {
		await startEventFilter("SwapShield");
		const { amount } = req.body;
		const { tokenId } = req.body;
		const balances_msgSender_newOwnerPublicKey =
			req.body.balances_msgSender_newOwnerPublicKey || 0;
		const tokenOwners_tokenId_newOwnerPublicKey =
			req.body.tokenOwners_tokenId_newOwnerPublicKey || 0;
		const { tx, encEvent } = await deposit(
			amount,
			tokenId,
			balances_msgSender_newOwnerPublicKey,
			tokenOwners_tokenId_newOwnerPublicKey
		);
		// prints the tx
		console.log(tx);
		res.send({ tx, encEvent });
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

// eslint-disable-next-line func-names
export async function service_startSwap(req, res, next) {
	try {
		await web3.connect();
		await new Promise((resolve) => setTimeout(() => resolve(), 3000));
	} catch (err) {
		throw new Error(err);
	}
	try {
		await startEventFilter("SwapShield");
		const { sharedAddress } = req.body;
		const { amountSent } = req.body;
		const { tokenIdSent } = req.body;
		const { amountRecieved } = req.body;
		const { tokenIdRecieved } = req.body;
		const balances_msgSender_newOwnerPublicKey =
			req.body.balances_msgSender_newOwnerPublicKey || 0;
		const tokenOwners_tokenIdSent_newOwnerPublicKey =
			req.body.tokenOwners_tokenIdSent_newOwnerPublicKey || 0;
		const pendingStatus_newOwnerPublicKey =
			req.body.pendingStatus_newOwnerPublicKey || 0;
		const swapProposals_sharedAddress_newOwnerPublicKey =
			req.body.swapProposals_sharedAddress_newOwnerPublicKey || 0;
		const { tx, encEvent } = await startSwap(
			sharedAddress,
			amountSent,
			tokenIdSent,
			amountRecieved,
			tokenIdRecieved,
			balances_msgSender_newOwnerPublicKey,
			tokenOwners_tokenIdSent_newOwnerPublicKey,
			pendingStatus_newOwnerPublicKey,
			swapProposals_sharedAddress_newOwnerPublicKey
		);
		// prints the tx
		console.log(tx);
		res.send({ tx, encEvent });
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

// eslint-disable-next-line func-names
export async function service_completeSwap(req, res, next) {
	try {
		await web3.connect();
		await new Promise((resolve) => setTimeout(() => resolve(), 3000));
	} catch (err) {
		throw new Error(err);
	}
	try {
		await startEventFilter("SwapShield");
		const { counterParty } = req.body;
		const { sharedAddress } = req.body;
		const { amountSent } = req.body;
		const { tokenIdSent } = req.body;
		const { amountRecieved } = req.body;
		const { tokenIdRecieved } = req.body;
		const balances_msgSender_newOwnerPublicKey =
			req.body.balances_msgSender_newOwnerPublicKey || 0;
		const balances_counterParty_newOwnerPublicKey =
			req.body.balances_counterParty_newOwnerPublicKey || 0;
		const tokenOwners_tokenIdSent_newOwnerPublicKey =
			req.body.tokenOwners_tokenIdSent_newOwnerPublicKey || 0;
		const tokenOwners_tokenIdRecieved_newOwnerPublicKey =
			req.body.tokenOwners_tokenIdRecieved_newOwnerPublicKey || 0;
		const pendingStatus_newOwnerPublicKey =
			req.body.pendingStatus_newOwnerPublicKey || 0;
		const swapProposals_sharedAddress_newOwnerPublicKey =
			req.body.swapProposals_sharedAddress_newOwnerPublicKey || 0;
		const { tx, encEvent } = await completeSwap(
			counterParty,
			sharedAddress,
			amountSent,
			tokenIdSent,
			amountRecieved,
			tokenIdRecieved,
			balances_msgSender_newOwnerPublicKey,
			balances_counterParty_newOwnerPublicKey,
			tokenOwners_tokenIdSent_newOwnerPublicKey,
			tokenOwners_tokenIdRecieved_newOwnerPublicKey,
			pendingStatus_newOwnerPublicKey,
			swapProposals_sharedAddress_newOwnerPublicKey
		);
		// prints the tx
		console.log(tx);
		res.send({ tx, encEvent });
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

// eslint-disable-next-line func-names
export async function service_quitSwap(req, res, next) {
	try {
		await web3.connect();
		await new Promise((resolve) => setTimeout(() => resolve(), 3000));
	} catch (err) {
		throw new Error(err);
	}
	try {
		await startEventFilter("SwapShield");
		const { sharedAddress } = req.body;
		const { amountSent } = req.body;
		const { tokenIdSent } = req.body;
		const balances_msgSender_newOwnerPublicKey =
			req.body.balances_msgSender_newOwnerPublicKey || 0;
		const tokenOwners_tokenIdSent_newOwnerPublicKey =
			req.body.tokenOwners_tokenIdSent_newOwnerPublicKey || 0;
		const pendingStatus_newOwnerPublicKey =
			req.body.pendingStatus_newOwnerPublicKey || 0;
		const swapProposals_sharedAddress_newOwnerPublicKey =
			req.body.swapProposals_sharedAddress_newOwnerPublicKey || 0;
		const { tx, encEvent } = await quitSwap(
			sharedAddress,
			amountSent,
			tokenIdSent,
			balances_msgSender_newOwnerPublicKey,
			tokenOwners_tokenIdSent_newOwnerPublicKey,
			pendingStatus_newOwnerPublicKey,
			swapProposals_sharedAddress_newOwnerPublicKey
		);
		// prints the tx
		console.log(tx);
		res.send({ tx, encEvent });
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

export async function service_allCommitments(req, res, next) {
	try {
		const commitments = await getAllCommitments();
		res.send({ commitments });
		await sleep(10);
	} catch (err) {
		logger.error(err);
		res.send({ errors: [err.message] });
	}
}
export async function service_getBalance(req, res, next) {
	try {
		const sum = await getBalance();
		res.send({ " Total Balance": sum });
	} catch (error) {
		console.error("Error in calculation :", error);
		res.status(500).send({ error: err.message });
	}
}

export async function service_getBalanceByState(req, res, next) {
	try {
		const { name, mappingKey } = req.body;
		const balance = await getBalanceByState(name, mappingKey);
		res.send({ " Total Balance": balance });
	} catch (error) {
		console.error("Error in calculation :", error);
		res.status(500).send({ error: err.message });
	}
}

export async function service_getCommitmentsByState(req, res, next) {
	try {
		const { name, mappingKey } = req.body;
		const commitments = await getCommitmentsByState(name, mappingKey);
		res.send({ commitments });
		await sleep(10);
	} catch (err) {
		logger.error(err);
		res.send({ errors: [err.message] });
	}
}

export async function service_reinstateNullifiers(req, res, next) {
	try {
		await reinstateNullifiers();
		res.send("Complete");
		await sleep(10);
	} catch (err) {
		logger.error(err);
		res.send({ errors: [err.message] });
	}
}
export async function service_getSharedKeys(req, res, next) {
	try {
		const { recipientAddress } = req.body;
		const recipientPubKey = req.body.recipientPubKey || 0;
		const SharedKeys = await getSharedSecretskeys(
			recipientAddress,
			recipientPubKey
		);
		res.send({ SharedKeys });
		await sleep(10);
	} catch (err) {
		logger.error(err);
		res.send({ errors: [err.message] });
	}
}
