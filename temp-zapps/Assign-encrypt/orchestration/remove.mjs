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

export default async function remove(
	_value,
	_a_newOwnerPublicKey = 0,
	_b_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");

	const contractAddr = await getContractAddress("AssignShield");

	const msgValue = 0;
	const value = generalise(_value);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
	let b_newOwnerPublicKey = generalise(_b_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "AssignShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for incremented state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_stateVarId = generalise(3).hex(32);

	const a_newCommitmentValue = generalise(parseInt(value.integer, 10));

	// read preimage for incremented state
	b_newOwnerPublicKey =
		_b_newOwnerPublicKey === 0 ? publicKey : b_newOwnerPublicKey;

	const b_stateVarId = generalise(5).hex(32);

	const b_newCommitmentValue = generalise(
		parseInt(2, 10) * parseInt(value.integer, 10)
	);

	// Extract set membership witness:

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	// Calculate commitment(s):

	const a_newSalt = generalise(utils.randomHex(31));

	let a_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a_newCommitmentValue.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	const b_newSalt = generalise(utils.randomHex(31));

	let b_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b_newCommitmentValue.hex(32)),
		BigInt(b_newOwnerPublicKey.hex(32)),
		BigInt(b_newSalt.hex(32)),
	]);

	b_newCommitment = generalise(b_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		a_newOwnerPublicKey.integer,
		a_newSalt.integer,
		a_newCommitment.integer,

		b_newSalt.integer,
		b_newCommitment.integer,
		generalise(utils.randomHex(31)).integer,
		[
			decompressStarlightKey(b_newOwnerPublicKey)[0].integer,
			decompressStarlightKey(b_newOwnerPublicKey)[1].integer,
		],
	].flat(Infinity);
	const res = await generateProof("remove", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);
	const b_cipherText = res.inputs
		.slice(-5, -2)
		.map((e) => generalise(e).integer);
	const b_encKey = res.inputs.slice(-2).map((e) => generalise(e).integer);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.remove(
			[a_newCommitment.integer, b_newCommitment.integer],
			[b_cipherText],
			[b_encKey],
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
		hash: a_newCommitment,
		name: "a",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(a_stateVarId),
			value: a_newCommitmentValue,
			salt: a_newSalt,
			publicKey: a_newOwnerPublicKey,
		},
		secretKey:
			a_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	await storeCommitment({
		hash: b_newCommitment,
		name: "b",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(b_stateVarId),
			value: b_newCommitmentValue,
			salt: b_newSalt,
			publicKey: b_newOwnerPublicKey,
		},
		secretKey:
			b_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
