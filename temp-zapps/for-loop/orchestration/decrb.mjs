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

export default async function decrb(
	_param2,
	_key,
	_b_key_newOwnerPublicKey = 0,
	_b_key_0_oldCommitment = 0,
	_b_key_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");
	const param2 = generalise(_param2);
	const key = generalise(_key);
	let b_key_newOwnerPublicKey = generalise(_b_key_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "MyContractShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for decremented state

	b_key_newOwnerPublicKey =
		_b_key_newOwnerPublicKey === 0 ? publicKey : b_key_newOwnerPublicKey;

	let b_key_stateVarId = 7;

	const b_key_stateVarId_key = key;

	b_key_stateVarId = generalise(
		utils.mimcHash(
			[generalise(b_key_stateVarId).bigInt, b_key_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let b_key_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).b[b_key_stateVarId_key.integer];

	const b_key_newCommitmentValue = generalise(parseInt(param2.integer, 10));
	// First check if required commitments exist or not

	let commitmentFlag = getInputCommitments(
		publicKey.integer,
		b_key_newCommitmentValue.integer,
		b_key_preimage
	)[0];

	let b_key_0_oldCommitment =
		_b_key_0_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					b_key_newCommitmentValue.integer,
					b_key_preimage
			  )[1]
			: generalise(_b_key_0_oldCommitment).hex(32);

	let b_key_1_oldCommitment =
		_b_key_1_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					b_key_newCommitmentValue.integer,
					b_key_preimage
			  )[2]
			: generalise(_b_key_1_oldCommitment).hex(32);

	let b_key_witness_0;

	let b_key_witness_1;

	while (commitmentFlag === false) {
		b_key_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(b_key_0_oldCommitment).integer
		);

		b_key_witness_1 = await getMembershipWitness(
			"MyContractShield",
			generalise(b_key_1_oldCommitment).integer
		);

		const tx = await joinCommitments(
			"MyContractShield",
			"b[b_key_stateVarId_key.integer]",
			secretKey,
			publicKey,
			[7, b_key_stateVarId_key],
			b_key_preimage,
			[b_key_0_oldCommitment, b_key_1_oldCommitment],
			[b_key_witness_0, b_key_witness_1],
			instance
		);

		b_key_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).b[b_key_stateVarId_key.integer];

		commitmentFlag = getInputCommitments(
			publicKey.integer,
			b_key_newCommitmentValue.integer,
			b_key_preimage
		)[0];

		b_key_0_oldCommitment =
			_b_key_0_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						b_key_newCommitmentValue.integer,
						b_key_preimage
				  )[1]
				: generalise(_b_key_0_oldCommitment).hex(32);

		b_key_1_oldCommitment =
			_b_key_1_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						b_key_newCommitmentValue.integer,
						b_key_preimage
				  )[2]
				: generalise(_b_key_1_oldCommitment).hex(32);
	}
	const b_key_0_prevSalt = generalise(
		b_key_preimage[b_key_0_oldCommitment].salt
	);
	const b_key_1_prevSalt = generalise(
		b_key_preimage[b_key_1_oldCommitment].salt
	);
	const b_key_0_prev = generalise(b_key_preimage[b_key_0_oldCommitment].value);
	const b_key_1_prev = generalise(b_key_preimage[b_key_1_oldCommitment].value);

	// Extract set membership witness:

	// generate witness for partitioned state
	b_key_witness_0 = await getMembershipWitness(
		"MyContractShield",
		generalise(b_key_0_oldCommitment).integer
	);
	b_key_witness_1 = await getMembershipWitness(
		"MyContractShield",
		generalise(b_key_1_oldCommitment).integer
	);
	const b_key_0_index = generalise(b_key_witness_0.index);
	const b_key_1_index = generalise(b_key_witness_1.index);
	const b_key_root = generalise(b_key_witness_0.root);
	const b_key_0_path = generalise(b_key_witness_0.path).all;
	const b_key_1_path = generalise(b_key_witness_1.path).all;

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let b_key_0_nullifier = poseidonHash([
		BigInt(b_key_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(b_key_0_prevSalt.hex(32)),
	]);
	let b_key_1_nullifier = poseidonHash([
		BigInt(b_key_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(b_key_1_prevSalt.hex(32)),
	]);
	b_key_0_nullifier = generalise(b_key_0_nullifier.hex(32)); // truncate
	b_key_1_nullifier = generalise(b_key_1_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const b_key_2_newSalt = generalise(utils.randomHex(32));

	let b_key_change =
		parseInt(b_key_0_prev.integer, 10) +
		parseInt(b_key_1_prev.integer, 10) -
		parseInt(b_key_newCommitmentValue.integer, 10);

	b_key_change = generalise(b_key_change);

	let b_key_2_newCommitment = poseidonHash([
		BigInt(b_key_stateVarId),
		BigInt(b_key_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(b_key_2_newSalt.hex(32)),
	]);

	b_key_2_newCommitment = generalise(b_key_2_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param2.integer,
		key.integer,
		secretKey.limbs(32, 8),
		secretKey.limbs(32, 8),
		b_key_0_nullifier.integer,
		b_key_1_nullifier.integer,
		b_key_0_prev.integer,
		b_key_0_prevSalt.integer,
		b_key_1_prev.integer,
		b_key_1_prevSalt.integer,
		b_key_root.integer,
		b_key_0_index.integer,
		b_key_0_path.integer,
		b_key_1_index.integer,
		b_key_1_path.integer,
		b_key_newOwnerPublicKey.integer,
		b_key_2_newSalt.integer,
		b_key_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("decrb", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.decrb(
			key.integer,
			[b_key_0_nullifier.integer, b_key_1_nullifier.integer],
			b_key_root.integer,
			[b_key_2_newCommitment.integer],
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

	preimage.b[b_key_stateVarId_key.integer][
		generalise(b_key_0_oldCommitment).hex(32)
	].isNullified = true;

	preimage.b[b_key_stateVarId_key.integer][
		generalise(b_key_1_oldCommitment).hex(32)
	].isNullified = true;

	preimage.b[b_key_stateVarId_key.integer][b_key_2_newCommitment.hex(32)] = {
		value: b_key_change.integer,
		salt: b_key_2_newSalt.integer,
		publicKey: b_key_newOwnerPublicKey.integer,
		commitment: b_key_2_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
