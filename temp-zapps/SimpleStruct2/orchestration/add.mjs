/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import utils from "zkp-utils";
import GN from "general-number";
import fs from "fs";

import Contract from "./common/contract.mjs";
import {
	storeCommitment,
	getCurrentWholeCommitment,
	getCommitmentsById,
	getAllCommitments,
	getInputCommitments,
	joinCommitments,
	splitCommitments,
	markNullified,
	getnullifierMembershipWitness,
	getupdatedNullifierPaths,
	temporaryUpdateNullifier,
	updateNullifierTree,
} from "./common/commitment-storage.mjs";
import { generateProof } from "./common/zokrates.mjs";
import { getMembershipWitness, getRoot } from "./common/timber.mjs";
import web3Instance from "./common/web3.mjs";
import {
	decompressStarlightKey,
	poseidonHash,
} from "./common/number-theory.mjs";

const { generalise } = GN;
const db = "/app/orchestration/common/db/preimage.json";
const web3 = web3Instance.getConnection();
const keyDb = "/app/orchestration/common/db/key.json";

export default async function add(
	_myrct,
	_total_msgSender_newOwnerPublicKey = 0,
	_cmt_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const contract = new Contract("ReceiptShield");

	await contract.init();

	const instance = contract.getInstance();

	if (!instance) {
		throw new Error("Contract instance is not initialized");
	}

	const contractAddr = await contract.getContractAddress();

	const msgValue = 0;
	const myrct = generalise(_myrct);
	let total_msgSender_newOwnerPublicKey = generalise(
		_total_msgSender_newOwnerPublicKey
	);
	let cmt_newOwnerPublicKey = generalise(_cmt_newOwnerPublicKey);

	// Initialize the contract

	const contract = new Contract("ReceiptShield");

	await contract.init();

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await contract.registerKey(utils.randomHex(31), "ReceiptShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for incremented state
	total_msgSender_newOwnerPublicKey =
		_total_msgSender_newOwnerPublicKey === 0
			? publicKey
			: total_msgSender_newOwnerPublicKey;

	let total_msgSender_stateVarId = 6;

	const total_msgSender_stateVarId_key = generalise(
		config.web3.options.defaultAccount
	); // emulates msg.sender

	total_msgSender_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(total_msgSender_stateVarId).bigInt,
				total_msgSender_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	const total_msgSender_newCommitmentValue = generalise([
		generalise(parseInt(myrct.amount.integer, 10)),
		generalise(parseInt(myrct.tax.integer, 10)),
	]).all;

	// read preimage for incremented state
	cmt_newOwnerPublicKey =
		_cmt_newOwnerPublicKey === 0 ? publicKey : cmt_newOwnerPublicKey;

	const cmt_stateVarId = generalise(14).hex(32);

	const cmt_newCommitmentValue = generalise([
		generalise(parseInt(myrct.amount.integer, 10)),
		generalise(parseInt(myrct.tax.integer, 10)),
	]).all;

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// Calculate commitment(s):

	const total_msgSender_newSalt = generalise(utils.randomHex(31));

	let total_msgSender_newCommitment = poseidonHash([
		BigInt(total_msgSender_stateVarId),
		...total_msgSender_newCommitmentValue.hex(32).map((v) => BigInt(v)),
		BigInt(total_msgSender_newOwnerPublicKey.hex(32)),
		BigInt(total_msgSender_newSalt.hex(32)),
	]);

	total_msgSender_newCommitment = generalise(
		total_msgSender_newCommitment.hex(32)
	); // truncate

	const cmt_newSalt = generalise(utils.randomHex(31));

	let cmt_newCommitment = poseidonHash([
		BigInt(cmt_stateVarId),
		...cmt_newCommitmentValue.hex(32).map((v) => BigInt(v)),
		BigInt(cmt_newOwnerPublicKey.hex(32)),
		BigInt(cmt_newSalt.hex(32)),
	]);

	cmt_newCommitment = generalise(cmt_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		myrct.amount.integer,
		myrct.tax.integer,
		total_msgSender_stateVarId_key.integer,
		total_msgSender_newOwnerPublicKey.integer,
		total_msgSender_newSalt.integer,
		total_msgSender_newCommitment.integer,

		cmt_newOwnerPublicKey.integer,
		cmt_newSalt.integer,
		cmt_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			[total_msgSender_newCommitment.integer, cmt_newCommitment.integer],
			proof
		)
		.encodeABI();

	let txParams = {
		from: config.web3.options.defaultAccount,
		to: contractAddr,
		gas: config.web3.options.defaultGas,
		gasPrice: config.web3.options.defaultGasPrice,
		data: txData,
		chainId: await web3.eth.net.getId(),
	};

	const key = config.web3.key;

	const signed = await web3.eth.accounts.signTransaction(txParams, key);

	const sendTxn = await web3.eth.sendSignedTransaction(signed.rawTransaction);

	let tx = await instance.getPastEvents("NewLeaves");

	tx = tx[0];

	if (!tx) {
		throw new Error(
			"Tx failed - the commitment was not accepted on-chain, or the contract is not deployed."
		);
	}

	let encEvent = "";

	try {
		encEvent = await instance.getPastEvents("EncryptedData");
	} catch (err) {
		console.log("No encrypted event");
	}

	// Write new commitment preimage to db:

	await storeCommitment({
		hash: total_msgSender_newCommitment,
		name: "total",
		mappingKey: total_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(total_msgSender_stateVarId),
			value: {
				amount: total_msgSender_newCommitmentValue.integer[0],
				tax: total_msgSender_newCommitmentValue.integer[1],
			},
			salt: total_msgSender_newSalt,
			publicKey: total_msgSender_newOwnerPublicKey,
		},
		secretKey:
			total_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		secretKey:
			total_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	await storeCommitment({
		hash: cmt_newCommitment,
		name: "cmt",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(cmt_stateVarId),
			value: {
				amount: cmt_newCommitmentValue.integer[0],
				tax: cmt_newCommitmentValue.integer[1],
			},
			salt: cmt_newSalt,
			publicKey: cmt_newOwnerPublicKey,
		},
		secretKey:
			cmt_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		secretKey:
			cmt_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
