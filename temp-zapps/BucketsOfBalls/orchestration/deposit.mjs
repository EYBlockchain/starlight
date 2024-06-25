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

export default async function deposit(
	_bucketId,
	_amountDeposit,
	_buckets_bucketId_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("BucketsOfBallsShield");

	const contractAddr = await getContractAddress("BucketsOfBallsShield");

	const msgValue = 0;
	const bucketId = generalise(_bucketId);
	const amountDeposit = generalise(_amountDeposit);
	let buckets_bucketId_newOwnerPublicKey = generalise(
		_buckets_bucketId_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "BucketsOfBallsShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for incremented state
	buckets_bucketId_newOwnerPublicKey =
		_buckets_bucketId_newOwnerPublicKey === 0
			? publicKey
			: buckets_bucketId_newOwnerPublicKey;

	let buckets_bucketId_stateVarId = 5;

	const buckets_bucketId_stateVarId_key = bucketId;

	buckets_bucketId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(buckets_bucketId_stateVarId).bigInt,
				buckets_bucketId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	const buckets_bucketId_newCommitmentValue = generalise(
		parseInt(amountDeposit.integer, 10)
	);

	// increment would go here but has been filtered out

	// Calculate commitment(s):

	const buckets_bucketId_newSalt = generalise(utils.randomHex(31));

	let buckets_bucketId_newCommitment = poseidonHash([
		BigInt(buckets_bucketId_stateVarId),
		BigInt(buckets_bucketId_newCommitmentValue.hex(32)),
		BigInt(buckets_bucketId_newOwnerPublicKey.hex(32)),
		BigInt(buckets_bucketId_newSalt.hex(32)),
	]);

	buckets_bucketId_newCommitment = generalise(
		buckets_bucketId_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		bucketId.integer,
		amountDeposit.integer,
		buckets_bucketId_newOwnerPublicKey.integer,
		buckets_bucketId_newSalt.integer,
		buckets_bucketId_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("deposit", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.deposit(
			amountDeposit.integer,
			[buckets_bucketId_newCommitment.integer],
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
		hash: buckets_bucketId_newCommitment,
		name: "buckets",
		mappingKey: buckets_bucketId_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(buckets_bucketId_stateVarId),
			value: buckets_bucketId_newCommitmentValue,
			salt: buckets_bucketId_newSalt,
			publicKey: buckets_bucketId_newOwnerPublicKey,
		},
		secretKey:
			buckets_bucketId_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
