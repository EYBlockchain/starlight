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

export default async function decrement(
	_param3,
	_a_msg_newOwnerPublicKey = 0,
	_a_msg_0_oldCommitment = 0,
	_a_msg_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");
	const param3 = generalise(_param3);
	let a_msg_newOwnerPublicKey = generalise(_a_msg_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "MyContractShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for decremented state

	a_msg_newOwnerPublicKey = publicKey;

	let a_msg_stateVarId = 5;

	const a_msg_stateVarId_key = generalise(config.web3.options.defaultAccount); // emulates msg.sender

	a_msg_stateVarId = generalise(
		utils.mimcHash(
			[generalise(a_msg_stateVarId).bigInt, a_msg_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let a_msg_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).a[a_msg_stateVarId_key.integer];

	const a_msg_newCommitmentValue = generalise(parseInt(param3.integer, 10));
	// First check if required commitments exist or not

	let commitmentFlag = getInputCommitments(
		publicKey.integer,
		a_msg_newCommitmentValue.integer,
		a_msg_preimage
	)[0];

	let a_msg_0_oldCommitment =
		_a_msg_0_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					a_msg_newCommitmentValue.integer,
					a_msg_preimage
			  )[1]
			: generalise(_a_msg_0_oldCommitment).hex(32);

	let a_msg_1_oldCommitment =
		_a_msg_1_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					a_msg_newCommitmentValue.integer,
					a_msg_preimage
			  )[2]
			: generalise(_a_msg_1_oldCommitment).hex(32);

	let a_msg_witness_0;

	let a_msg_witness_1;

	while (commitmentFlag === false) {
		a_msg_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_msg_0_oldCommitment).integer
		);

		a_msg_witness_1 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_msg_1_oldCommitment).integer
		);

		const tx = await joinCommitments(
			"MyContractShield",
			"a[a_msg_stateVarId_key.integer]",
			secretKey,
			publicKey,
			[5, a_msg_stateVarId_key],
			a_msg_preimage,
			[a_msg_0_oldCommitment, a_msg_1_oldCommitment],
			[a_msg_witness_0, a_msg_witness_1],
			instance
		);

		a_msg_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).a[a_msg_stateVarId_key.integer];

		commitmentFlag = getInputCommitments(
			publicKey.integer,
			a_msg_newCommitmentValue.integer,
			a_msg_preimage
		)[0];

		a_msg_0_oldCommitment =
			_a_msg_0_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						a_msg_newCommitmentValue.integer,
						a_msg_preimage
				  )[1]
				: generalise(_a_msg_0_oldCommitment).hex(32);

		a_msg_1_oldCommitment =
			_a_msg_1_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						a_msg_newCommitmentValue.integer,
						a_msg_preimage
				  )[2]
				: generalise(_a_msg_1_oldCommitment).hex(32);
	}
	const a_msg_0_prevSalt = generalise(
		a_msg_preimage[a_msg_0_oldCommitment].salt
	);
	const a_msg_1_prevSalt = generalise(
		a_msg_preimage[a_msg_1_oldCommitment].salt
	);
	const a_msg_0_prev = generalise(a_msg_preimage[a_msg_0_oldCommitment].value);
	const a_msg_1_prev = generalise(a_msg_preimage[a_msg_1_oldCommitment].value);

	// Extract set membership witness:

	// generate witness for partitioned state
	a_msg_witness_0 = await getMembershipWitness(
		"MyContractShield",
		generalise(a_msg_0_oldCommitment).integer
	);
	a_msg_witness_1 = await getMembershipWitness(
		"MyContractShield",
		generalise(a_msg_1_oldCommitment).integer
	);
	const a_msg_0_index = generalise(a_msg_witness_0.index);
	const a_msg_1_index = generalise(a_msg_witness_1.index);
	const a_msg_root = generalise(a_msg_witness_0.root);
	const a_msg_0_path = generalise(a_msg_witness_0.path).all;
	const a_msg_1_path = generalise(a_msg_witness_1.path).all;

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let a_msg_0_nullifier = poseidonHash([
		BigInt(a_msg_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_msg_0_prevSalt.hex(32)),
	]);
	let a_msg_1_nullifier = poseidonHash([
		BigInt(a_msg_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_msg_1_prevSalt.hex(32)),
	]);
	a_msg_0_nullifier = generalise(a_msg_0_nullifier.hex(32)); // truncate
	a_msg_1_nullifier = generalise(a_msg_1_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const a_msg_2_newSalt = generalise(utils.randomHex(32));

	let a_msg_change =
		parseInt(a_msg_0_prev.integer, 10) +
		parseInt(a_msg_1_prev.integer, 10) -
		parseInt(a_msg_newCommitmentValue.integer, 10);

	a_msg_change = generalise(a_msg_change);

	let a_msg_2_newCommitment = poseidonHash([
		BigInt(a_msg_stateVarId),
		BigInt(a_msg_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(a_msg_2_newSalt.hex(32)),
	]);

	a_msg_2_newCommitment = generalise(a_msg_2_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param3.integer,
		a_msg_stateVarId_key.integer,
		secretKey.limbs(32, 8),
		secretKey.limbs(32, 8),
		a_msg_0_nullifier.integer,
		a_msg_1_nullifier.integer,
		a_msg_0_prev.integer,
		a_msg_0_prevSalt.integer,
		a_msg_1_prev.integer,
		a_msg_1_prevSalt.integer,
		a_msg_root.integer,
		a_msg_0_index.integer,
		a_msg_0_path.integer,
		a_msg_1_index.integer,
		a_msg_1_path.integer,
		a_msg_newOwnerPublicKey.integer,
		a_msg_2_newSalt.integer,
		a_msg_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("decrement", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.decrement(
			[a_msg_0_nullifier.integer, a_msg_1_nullifier.integer],
			a_msg_root.integer,
			[a_msg_2_newCommitment.integer],
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

	preimage.a[a_msg_stateVarId_key.integer][
		generalise(a_msg_0_oldCommitment).hex(32)
	].isNullified = true;

	preimage.a[a_msg_stateVarId_key.integer][
		generalise(a_msg_1_oldCommitment).hex(32)
	].isNullified = true;

	preimage.a[a_msg_stateVarId_key.integer][a_msg_2_newCommitment.hex(32)] = {
		value: a_msg_change.integer,
		salt: a_msg_2_newSalt.integer,
		publicKey: a_msg_newOwnerPublicKey.integer,
		commitment: a_msg_2_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
