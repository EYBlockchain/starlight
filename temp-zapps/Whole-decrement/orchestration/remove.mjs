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
	_value1,
	_a_newOwnerPublicKey = 0,
	_b_newOwnerPublicKey = 0,
	_a_0_oldCommitment = 0,
	_a_1_oldCommitment = 0,
	_b_0_oldCommitment = 0,
	_b_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");
	const value = generalise(_value);
	const value1 = generalise(_value1);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
	let b_newOwnerPublicKey = generalise(_b_newOwnerPublicKey);

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

	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_stateVarId = generalise(3).hex(32);

	let a_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).a;

	const a_newCommitmentValue = generalise(parseInt(value.integer, 10));
	// First check if required commitments exist or not

	let commitmentFlag = getInputCommitments(
		publicKey.integer,
		a_newCommitmentValue.integer,
		a_preimage
	)[0];

	let a_0_oldCommitment =
		_a_0_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					a_newCommitmentValue.integer,
					a_preimage
			  )[1]
			: generalise(_a_0_oldCommitment).hex(32);

	let a_1_oldCommitment =
		_a_1_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					a_newCommitmentValue.integer,
					a_preimage
			  )[2]
			: generalise(_a_1_oldCommitment).hex(32);

	let a_witness_0;

	let a_witness_1;

	while (commitmentFlag === false) {
		a_witness_0 = await getMembershipWitness(
			"AssignShield",
			generalise(a_0_oldCommitment).integer
		);

		a_witness_1 = await getMembershipWitness(
			"AssignShield",
			generalise(a_1_oldCommitment).integer
		);

		const tx = await joinCommitments(
			"AssignShield",
			"a",
			secretKey,
			publicKey,
			[a_stateVarId],
			a_preimage,
			[a_0_oldCommitment, a_1_oldCommitment],
			[a_witness_0, a_witness_1],
			instance
		);

		a_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).a;

		commitmentFlag = getInputCommitments(
			publicKey.integer,
			a_newCommitmentValue.integer,
			a_preimage
		)[0];

		a_0_oldCommitment =
			_a_0_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						a_newCommitmentValue.integer,
						a_preimage
				  )[1]
				: generalise(_a_0_oldCommitment).hex(32);

		a_1_oldCommitment =
			_a_1_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						a_newCommitmentValue.integer,
						a_preimage
				  )[2]
				: generalise(_a_1_oldCommitment).hex(32);
	}
	const a_0_prevSalt = generalise(a_preimage[a_0_oldCommitment].salt);
	const a_1_prevSalt = generalise(a_preimage[a_1_oldCommitment].salt);
	const a_0_prev = generalise(a_preimage[a_0_oldCommitment].value);
	const a_1_prev = generalise(a_preimage[a_1_oldCommitment].value);

	// read preimage for decremented state

	b_newOwnerPublicKey =
		_b_newOwnerPublicKey === 0 ? publicKey : b_newOwnerPublicKey;

	const b_stateVarId = generalise(5).hex(32);

	let b_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).b;

	const b_newCommitmentValue = generalise(parseInt(value1.integer, 10));
	// First check if required commitments exist or not

	let commitmentFlag = getInputCommitments(
		publicKey.integer,
		b_newCommitmentValue.integer,
		b_preimage
	)[0];

	let b_0_oldCommitment =
		_b_0_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					b_newCommitmentValue.integer,
					b_preimage
			  )[1]
			: generalise(_b_0_oldCommitment).hex(32);

	let b_1_oldCommitment =
		_b_1_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					b_newCommitmentValue.integer,
					b_preimage
			  )[2]
			: generalise(_b_1_oldCommitment).hex(32);

	let b_witness_0;

	let b_witness_1;

	while (commitmentFlag === false) {
		b_witness_0 = await getMembershipWitness(
			"AssignShield",
			generalise(b_0_oldCommitment).integer
		);

		b_witness_1 = await getMembershipWitness(
			"AssignShield",
			generalise(b_1_oldCommitment).integer
		);

		const tx = await joinCommitments(
			"AssignShield",
			"b",
			secretKey,
			publicKey,
			[b_stateVarId],
			b_preimage,
			[b_0_oldCommitment, b_1_oldCommitment],
			[b_witness_0, b_witness_1],
			instance
		);

		b_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).b;

		commitmentFlag = getInputCommitments(
			publicKey.integer,
			b_newCommitmentValue.integer,
			b_preimage
		)[0];

		b_0_oldCommitment =
			_b_0_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						b_newCommitmentValue.integer,
						b_preimage
				  )[1]
				: generalise(_b_0_oldCommitment).hex(32);

		b_1_oldCommitment =
			_b_1_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						b_newCommitmentValue.integer,
						b_preimage
				  )[2]
				: generalise(_b_1_oldCommitment).hex(32);
	}
	const b_0_prevSalt = generalise(b_preimage[b_0_oldCommitment].salt);
	const b_1_prevSalt = generalise(b_preimage[b_1_oldCommitment].salt);
	const b_0_prev = generalise(b_preimage[b_0_oldCommitment].value);
	const b_1_prev = generalise(b_preimage[b_1_oldCommitment].value);

	// Extract set membership witness:

	// generate witness for partitioned state
	a_witness_0 = await getMembershipWitness(
		"AssignShield",
		generalise(a_0_oldCommitment).integer
	);
	a_witness_1 = await getMembershipWitness(
		"AssignShield",
		generalise(a_1_oldCommitment).integer
	);
	const a_0_index = generalise(a_witness_0.index);
	const a_1_index = generalise(a_witness_1.index);
	const a_root = generalise(a_witness_0.root);
	const a_0_path = generalise(a_witness_0.path).all;
	const a_1_path = generalise(a_witness_1.path).all;

	// generate witness for partitioned state
	b_witness_0 = await getMembershipWitness(
		"AssignShield",
		generalise(b_0_oldCommitment).integer
	);
	b_witness_1 = await getMembershipWitness(
		"AssignShield",
		generalise(b_1_oldCommitment).integer
	);
	const b_0_index = generalise(b_witness_0.index);
	const b_1_index = generalise(b_witness_1.index);
	const b_root = generalise(b_witness_0.root);
	const b_0_path = generalise(b_witness_0.path).all;
	const b_1_path = generalise(b_witness_1.path).all;

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let a_0_nullifier = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_0_prevSalt.hex(32)),
	]);
	let a_1_nullifier = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_1_prevSalt.hex(32)),
	]);
	a_0_nullifier = generalise(a_0_nullifier.hex(32)); // truncate
	a_1_nullifier = generalise(a_1_nullifier.hex(32)); // truncate
	let b_0_nullifier = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(b_0_prevSalt.hex(32)),
	]);
	let b_1_nullifier = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(b_1_prevSalt.hex(32)),
	]);
	b_0_nullifier = generalise(b_0_nullifier.hex(32)); // truncate
	b_1_nullifier = generalise(b_1_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const a_2_newSalt = generalise(utils.randomHex(32));

	let a_change =
		parseInt(a_0_prev.integer, 10) +
		parseInt(a_1_prev.integer, 10) -
		parseInt(a_newCommitmentValue.integer, 10);

	a_change = generalise(a_change);

	let a_2_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(a_2_newSalt.hex(32)),
	]);

	a_2_newCommitment = generalise(a_2_newCommitment.hex(32)); // truncate

	const b_2_newSalt = generalise(utils.randomHex(32));

	let b_change =
		parseInt(b_0_prev.integer, 10) +
		parseInt(b_1_prev.integer, 10) -
		parseInt(b_newCommitmentValue.integer, 10);

	b_change = generalise(b_change);

	let b_2_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(b_2_newSalt.hex(32)),
	]);

	b_2_newCommitment = generalise(b_2_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		value1.integer,
		secretKey.limbs(32, 8),
		secretKey.limbs(32, 8),
		a_0_nullifier.integer,
		a_1_nullifier.integer,
		a_0_prev.integer,
		a_0_prevSalt.integer,
		a_1_prev.integer,
		a_1_prevSalt.integer,
		a_root.integer,
		a_0_index.integer,
		a_0_path.integer,
		a_1_index.integer,
		a_1_path.integer,
		a_newOwnerPublicKey.integer,
		a_2_newSalt.integer,
		a_2_newCommitment.integer,

		secretKey.limbs(32, 8),
		secretKey.limbs(32, 8),
		b_0_nullifier.integer,
		b_1_nullifier.integer,
		b_0_prev.integer,
		b_0_prevSalt.integer,
		b_1_prev.integer,
		b_1_prevSalt.integer,

		b_0_index.integer,
		b_0_path.integer,
		b_1_index.integer,
		b_1_path.integer,
		b_newOwnerPublicKey.integer,
		b_2_newSalt.integer,
		b_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("remove", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.remove(
			[
				a_0_nullifier.integer,
				a_1_nullifier.integer,
				b_0_nullifier.integer,
				b_1_nullifier.integer,
			],
			a_root.integer,
			[a_2_newCommitment.integer, b_2_newCommitment.integer],
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

	preimage.a[generalise(a_0_oldCommitment).hex(32)].isNullified = true;

	preimage.a[generalise(a_1_oldCommitment).hex(32)].isNullified = true;

	preimage.a[a_2_newCommitment.hex(32)] = {
		value: a_change.integer,
		salt: a_2_newSalt.integer,
		publicKey: a_newOwnerPublicKey.integer,
		commitment: a_2_newCommitment.integer,
	};

	preimage.b[generalise(b_0_oldCommitment).hex(32)].isNullified = true;

	preimage.b[generalise(b_1_oldCommitment).hex(32)].isNullified = true;

	preimage.b[b_2_newCommitment.hex(32)] = {
		value: b_change.integer,
		salt: b_2_newSalt.integer,
		publicKey: b_newOwnerPublicKey.integer,
		commitment: b_2_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return {
		tx,
		b_2_newCommitment: b_2_newCommitment.integer,
		a_2_newCommitment: a_2_newCommitment.integer,
	};
}
