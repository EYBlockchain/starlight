/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import utils from "zkp-utils";
import GN from "general-number";
import fs from "fs";

import {
	getContractInstance,
	registerKey,
	getInputCommitments,
	joinCommitments,
} from "./common/contract.mjs";
import { generateProof } from "./common/zokrates.mjs";
import poseidonHash from "./common/poseidon.mjs";
import { getMembershipWitness, getRoot } from "./common/timber.mjs";

const { generalise } = GN;
const db = "/app/orchestration/common/db/preimage.json";
const keyDb = "/app/orchestration/common/db/key.json";

export default async function deposit(
	_bucketId,
	_amountDeposit,
	_buckets_bucketId_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("BucketsOfBallsShield");
	const bucketId = generalise(_bucketId);
	const amountDeposit = generalise(_amountDeposit);
	let buckets_bucketId_newOwnerPublicKey = generalise(
		_buckets_bucketId_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "BucketsOfBallsShield", false);
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

	const buckets_bucketId_newSalt = generalise(utils.randomHex(32));

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

	const tx = await instance.methods
		.deposit(
			amountDeposit.integer,
			[buckets_bucketId_newCommitment.integer],
			proof
		)
		.send({
			from: config.web3.options.defaultAccount,
			gas: config.web3.options.defaultGas,
		});

	// Write new commitment preimage to db:

	let preimage = {};
	if (fs.existsSync(db)) {
		preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		);
	}

	if (!preimage.buckets) preimage.buckets = {};

	if (!preimage.buckets[buckets_bucketId_stateVarId_key.integer])
		preimage.buckets[buckets_bucketId_stateVarId_key.integer] = {};

	preimage.buckets[buckets_bucketId_stateVarId_key.integer][
		buckets_bucketId_newCommitment.hex(32)
	] = {
		value: buckets_bucketId_newCommitmentValue.integer,
		salt: buckets_bucketId_newSalt.integer,
		publicKey: buckets_bucketId_newOwnerPublicKey.integer,
		commitment: buckets_bucketId_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
