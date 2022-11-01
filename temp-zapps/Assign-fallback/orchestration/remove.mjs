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

export default async function remove(
	_value,
	_fromBucketId,
	_toBucketId,
	_buckets_fromBucketId_newOwnerPublicKey = 0,
	_buckets_toBucketId_newOwnerPublicKey = 0,
	_buckets_fromBucketId_0_oldCommitment = 0,
	_buckets_fromBucketId_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");
	const value = generalise(_value);
	const fromBucketId = generalise(_fromBucketId);
	const toBucketId = generalise(_toBucketId);
	let buckets_fromBucketId_newOwnerPublicKey = generalise(
		_buckets_fromBucketId_newOwnerPublicKey
	);
	let buckets_toBucketId_newOwnerPublicKey = generalise(
		_buckets_toBucketId_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "AssignShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for decremented state

	buckets_fromBucketId_newOwnerPublicKey =
		_buckets_fromBucketId_newOwnerPublicKey === 0
			? publicKey
			: buckets_fromBucketId_newOwnerPublicKey;

	let buckets_fromBucketId_stateVarId = 7;

	const buckets_fromBucketId_stateVarId_key = fromBucketId;

	buckets_fromBucketId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(buckets_fromBucketId_stateVarId).bigInt,
				buckets_fromBucketId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let buckets_fromBucketId_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).buckets[buckets_fromBucketId_stateVarId_key.integer];

	const buckets_fromBucketId_newCommitmentValue = generalise(
		parseInt(value.integer, 10)
	);
	// First check if required commitments exist or not

	let commitmentFlag = getInputCommitments(
		publicKey.integer,
		buckets_fromBucketId_newCommitmentValue.integer,
		buckets_fromBucketId_preimage
	)[0];

	let buckets_fromBucketId_0_oldCommitment =
		_buckets_fromBucketId_0_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					buckets_fromBucketId_newCommitmentValue.integer,
					buckets_fromBucketId_preimage
			  )[1]
			: generalise(_buckets_fromBucketId_0_oldCommitment).hex(32);

	let buckets_fromBucketId_1_oldCommitment =
		_buckets_fromBucketId_1_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					buckets_fromBucketId_newCommitmentValue.integer,
					buckets_fromBucketId_preimage
			  )[2]
			: generalise(_buckets_fromBucketId_1_oldCommitment).hex(32);

	let buckets_fromBucketId_witness_0;

	let buckets_fromBucketId_witness_1;

	while (commitmentFlag === false) {
		buckets_fromBucketId_witness_0 = await getMembershipWitness(
			"AssignShield",
			generalise(buckets_fromBucketId_0_oldCommitment).integer
		);

		buckets_fromBucketId_witness_1 = await getMembershipWitness(
			"AssignShield",
			generalise(buckets_fromBucketId_1_oldCommitment).integer
		);

		const tx = await joinCommitments(
			"AssignShield",
			"buckets[buckets_fromBucketId_stateVarId_key.integer]",
			secretKey,
			publicKey,
			[7, buckets_fromBucketId_stateVarId_key],
			buckets_fromBucketId_preimage,
			[
				buckets_fromBucketId_0_oldCommitment,
				buckets_fromBucketId_1_oldCommitment,
			],
			[buckets_fromBucketId_witness_0, buckets_fromBucketId_witness_1],
			instance
		);

		buckets_fromBucketId_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).buckets[buckets_fromBucketId_stateVarId_key.integer];

		commitmentFlag = getInputCommitments(
			publicKey.integer,
			buckets_fromBucketId_newCommitmentValue.integer,
			buckets_fromBucketId_preimage
		)[0];

		buckets_fromBucketId_0_oldCommitment =
			_buckets_fromBucketId_0_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						buckets_fromBucketId_newCommitmentValue.integer,
						buckets_fromBucketId_preimage
				  )[1]
				: generalise(_buckets_fromBucketId_0_oldCommitment).hex(32);

		buckets_fromBucketId_1_oldCommitment =
			_buckets_fromBucketId_1_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						buckets_fromBucketId_newCommitmentValue.integer,
						buckets_fromBucketId_preimage
				  )[2]
				: generalise(_buckets_fromBucketId_1_oldCommitment).hex(32);
	}
	const buckets_fromBucketId_0_prevSalt = generalise(
		buckets_fromBucketId_preimage[buckets_fromBucketId_0_oldCommitment].salt
	);
	const buckets_fromBucketId_1_prevSalt = generalise(
		buckets_fromBucketId_preimage[buckets_fromBucketId_1_oldCommitment].salt
	);
	const buckets_fromBucketId_0_prev = generalise(
		buckets_fromBucketId_preimage[buckets_fromBucketId_0_oldCommitment].value
	);
	const buckets_fromBucketId_1_prev = generalise(
		buckets_fromBucketId_preimage[buckets_fromBucketId_1_oldCommitment].value
	);

	// read preimage for incremented state
	buckets_toBucketId_newOwnerPublicKey =
		_buckets_toBucketId_newOwnerPublicKey === 0
			? publicKey
			: buckets_toBucketId_newOwnerPublicKey;

	let buckets_toBucketId_stateVarId = 7;

	const buckets_toBucketId_stateVarId_key = toBucketId;

	buckets_toBucketId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(buckets_toBucketId_stateVarId).bigInt,
				buckets_toBucketId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	const buckets_toBucketId_newCommitmentValue = generalise(
		parseInt(value.integer, 10)
	);

	// Extract set membership witness:

	// generate witness for partitioned state
	buckets_fromBucketId_witness_0 = await getMembershipWitness(
		"AssignShield",
		generalise(buckets_fromBucketId_0_oldCommitment).integer
	);
	buckets_fromBucketId_witness_1 = await getMembershipWitness(
		"AssignShield",
		generalise(buckets_fromBucketId_1_oldCommitment).integer
	);
	const buckets_fromBucketId_0_index = generalise(
		buckets_fromBucketId_witness_0.index
	);
	const buckets_fromBucketId_1_index = generalise(
		buckets_fromBucketId_witness_1.index
	);
	const buckets_fromBucketId_root = generalise(
		buckets_fromBucketId_witness_0.root
	);
	const buckets_fromBucketId_0_path = generalise(
		buckets_fromBucketId_witness_0.path
	).all;
	const buckets_fromBucketId_1_path = generalise(
		buckets_fromBucketId_witness_1.path
	).all;

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let buckets_fromBucketId_0_nullifier = poseidonHash([
		BigInt(buckets_fromBucketId_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(buckets_fromBucketId_0_prevSalt.hex(32)),
	]);
	let buckets_fromBucketId_1_nullifier = poseidonHash([
		BigInt(buckets_fromBucketId_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(buckets_fromBucketId_1_prevSalt.hex(32)),
	]);
	buckets_fromBucketId_0_nullifier = generalise(
		buckets_fromBucketId_0_nullifier.hex(32)
	); // truncate
	buckets_fromBucketId_1_nullifier = generalise(
		buckets_fromBucketId_1_nullifier.hex(32)
	); // truncate

	// Calculate commitment(s):

	const buckets_fromBucketId_2_newSalt = generalise(utils.randomHex(32));

	let buckets_fromBucketId_change =
		parseInt(buckets_fromBucketId_0_prev.integer, 10) +
		parseInt(buckets_fromBucketId_1_prev.integer, 10) -
		parseInt(buckets_fromBucketId_newCommitmentValue.integer, 10);

	buckets_fromBucketId_change = generalise(buckets_fromBucketId_change);

	let buckets_fromBucketId_2_newCommitment = poseidonHash([
		BigInt(buckets_fromBucketId_stateVarId),
		BigInt(buckets_fromBucketId_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(buckets_fromBucketId_2_newSalt.hex(32)),
	]);

	buckets_fromBucketId_2_newCommitment = generalise(
		buckets_fromBucketId_2_newCommitment.hex(32)
	); // truncate

	const buckets_toBucketId_newSalt = generalise(utils.randomHex(32));

	let buckets_toBucketId_newCommitment = poseidonHash([
		BigInt(buckets_toBucketId_stateVarId),
		BigInt(buckets_toBucketId_newCommitmentValue.hex(32)),
		BigInt(buckets_toBucketId_newOwnerPublicKey.hex(32)),
		BigInt(buckets_toBucketId_newSalt.hex(32)),
	]);

	buckets_toBucketId_newCommitment = generalise(
		buckets_toBucketId_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		fromBucketId.integer,
		toBucketId.integer,
		secretKey.limbs(32, 8),
		secretKey.limbs(32, 8),
		buckets_fromBucketId_0_nullifier.integer,
		buckets_fromBucketId_1_nullifier.integer,
		buckets_fromBucketId_0_prev.integer,
		buckets_fromBucketId_0_prevSalt.integer,
		buckets_fromBucketId_1_prev.integer,
		buckets_fromBucketId_1_prevSalt.integer,
		buckets_fromBucketId_root.integer,
		buckets_fromBucketId_0_index.integer,
		buckets_fromBucketId_0_path.integer,
		buckets_fromBucketId_1_index.integer,
		buckets_fromBucketId_1_path.integer,
		buckets_fromBucketId_newOwnerPublicKey.integer,
		buckets_fromBucketId_2_newSalt.integer,
		buckets_fromBucketId_2_newCommitment.integer,

		buckets_toBucketId_newOwnerPublicKey.integer,
		buckets_toBucketId_newSalt.integer,
		buckets_toBucketId_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("remove", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.remove(
			[
				buckets_fromBucketId_0_nullifier.integer,
				buckets_fromBucketId_1_nullifier.integer,
			],
			buckets_fromBucketId_root.integer,
			[
				buckets_fromBucketId_2_newCommitment.integer,
				buckets_toBucketId_newCommitment.integer,
			],
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

	preimage.buckets[buckets_fromBucketId_stateVarId_key.integer][
		generalise(buckets_fromBucketId_0_oldCommitment).hex(32)
	].isNullified = true;

	preimage.buckets[buckets_fromBucketId_stateVarId_key.integer][
		generalise(buckets_fromBucketId_1_oldCommitment).hex(32)
	].isNullified = true;

	preimage.buckets[buckets_fromBucketId_stateVarId_key.integer][
		buckets_fromBucketId_2_newCommitment.hex(32)
	] = {
		value: buckets_fromBucketId_change.integer,
		salt: buckets_fromBucketId_2_newSalt.integer,
		publicKey: buckets_fromBucketId_newOwnerPublicKey.integer,
		commitment: buckets_fromBucketId_2_newCommitment.integer,
	};

	if (!preimage.buckets) preimage.buckets = {};

	if (!preimage.buckets[buckets_toBucketId_stateVarId_key.integer])
		preimage.buckets[buckets_toBucketId_stateVarId_key.integer] = {};

	preimage.buckets[buckets_toBucketId_stateVarId_key.integer][
		buckets_toBucketId_newCommitment.hex(32)
	] = {
		value: buckets_toBucketId_newCommitmentValue.integer,
		salt: buckets_toBucketId_newSalt.integer,
		publicKey: buckets_toBucketId_newOwnerPublicKey.integer,
		commitment: buckets_toBucketId_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
