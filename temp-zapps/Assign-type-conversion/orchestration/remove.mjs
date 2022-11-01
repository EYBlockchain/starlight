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
	_a_newOwnerPublicKey = 0,
	_a_0_oldCommitment = 0,
	_a_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");
	const value = generalise(_value);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);

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

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
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
	].flat(Infinity);
	const res = await generateProof("remove", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.remove(
			[a_0_nullifier.integer, a_1_nullifier.integer],
			a_root.integer,
			[a_2_newCommitment.integer],
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
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
