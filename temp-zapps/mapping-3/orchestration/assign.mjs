/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import utils from "zkp-utils";
import GN from "general-number";
import fs from "fs";

import {
	getContractInstance,
	getContractAddress,
	registerKey,
} from "./common/contract.mjs";
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
import Web3 from "./common/web3.mjs";
import {
	decompressStarlightKey,
	poseidonHash,
} from "./common/number-theory.mjs";

const { generalise } = GN;
const db = "/app/orchestration/common/db/preimage.json";
const web3 = Web3.connection();
const keyDb = "/app/orchestration/common/db/key.json";

export default async function assign(
	_param1,
	_param2,
	_a_param1_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");

	const contractAddr = await getContractAddress("MyContractShield");

	const msgValue = 0;
	const param1 = generalise(_param1);
	const param2 = generalise(_param2);
	let a_param1_newOwnerPublicKey = generalise(_a_param1_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "MyContractShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for incremented state
	a_param1_newOwnerPublicKey =
		_a_param1_newOwnerPublicKey === 0 ? publicKey : a_param1_newOwnerPublicKey;

	let a_param1_stateVarId = 5;

	const a_param1_stateVarId_key = param1;

	a_param1_stateVarId = generalise(
		utils.mimcHash(
			[generalise(a_param1_stateVarId).bigInt, a_param1_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	const a_param1_newCommitmentValue = generalise(parseInt(param2.integer, 10));

	// increment would go here but has been filtered out

	// Calculate commitment(s):

	const a_param1_newSalt = generalise(utils.randomHex(31));

	let a_param1_newCommitment = poseidonHash([
		BigInt(a_param1_stateVarId),
		BigInt(a_param1_newCommitmentValue.hex(32)),
		BigInt(a_param1_newOwnerPublicKey.hex(32)),
		BigInt(a_param1_newSalt.hex(32)),
	]);

	a_param1_newCommitment = generalise(a_param1_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param1.integer,
		param2.integer,
		a_param1_newOwnerPublicKey.integer,
		a_param1_newSalt.integer,
		a_param1_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("assign", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.assign([a_param1_newCommitment.integer], proof)
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
		hash: a_param1_newCommitment,
		name: "a",
		mappingKey: a_param1_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(a_param1_stateVarId),
			value: a_param1_newCommitmentValue,
			salt: a_param1_newSalt,
			publicKey: a_param1_newOwnerPublicKey,
		},
		secretKey:
			a_param1_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
