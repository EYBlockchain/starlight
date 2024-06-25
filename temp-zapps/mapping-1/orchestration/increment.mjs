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

export default async function increment(
	_param2,
	_a_msgSender_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const contract = new Contract("MyContractShield");

	await contract.init();

	const instance = contract.getInstance();

	if (!instance) {
		throw new Error("Contract instance is not initialized");
	}

	const contractAddr = await contract.getContractAddress();

	const msgValue = 0;
	const param2 = generalise(_param2);
	let a_msgSender_newOwnerPublicKey = generalise(
		_a_msgSender_newOwnerPublicKey
	);

	// Initialize the contract

	const contract = new Contract("MyContractShield");

	await contract.init();

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await contract.registerKey(utils.randomHex(31), "MyContractShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for incremented state
	a_msgSender_newOwnerPublicKey =
		_a_msgSender_newOwnerPublicKey === 0
			? publicKey
			: a_msgSender_newOwnerPublicKey;

	let a_msgSender_stateVarId = 5;

	const a_msgSender_stateVarId_key = generalise(
		config.web3.options.defaultAccount
	); // emulates msg.sender

	a_msgSender_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(a_msgSender_stateVarId).bigInt,
				a_msgSender_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	const a_msgSender_newCommitmentValue = generalise(
		parseInt(param2.integer, 10)
	);

	// increment would go here but has been filtered out

	// Calculate commitment(s):

	const a_msgSender_newSalt = generalise(utils.randomHex(31));

	let a_msgSender_newCommitment = poseidonHash([
		BigInt(a_msgSender_stateVarId),
		BigInt(a_msgSender_newCommitmentValue.hex(32)),
		BigInt(a_msgSender_newOwnerPublicKey.hex(32)),
		BigInt(a_msgSender_newSalt.hex(32)),
	]);

	a_msgSender_newCommitment = generalise(a_msgSender_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param2.integer,
		a_msgSender_stateVarId_key.integer,
		a_msgSender_newOwnerPublicKey.integer,
		a_msgSender_newSalt.integer,
		a_msgSender_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("increment", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.increment([a_msgSender_newCommitment.integer], proof)
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
		hash: a_msgSender_newCommitment,
		name: "a",
		mappingKey: a_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(a_msgSender_stateVarId),
			value: a_msgSender_newCommitmentValue,
			salt: a_msgSender_newSalt,
			publicKey: a_msgSender_newOwnerPublicKey,
		},
		secretKey:
			a_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		secretKey:
			a_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
