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
	_addr,
	_param3,
	_a_addr_newOwnerPublicKey = 0,
	_a_addr_0_oldCommitment = 0,
	_a_addr_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");
	const addr = generalise(_addr);
	const param3 = generalise(_param3);
	let a_addr_newOwnerPublicKey = generalise(_a_addr_newOwnerPublicKey);

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

	// Initialise commitment preimage of whole state:

	const admin_stateVarId = generalise(7).hex(32);

	let admin_commitmentExists = true;
	let admin_witnessRequired = true;

	let admin_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).admin ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).admin
	) {
		admin_commitmentExists = false;
		admin_witnessRequired = false;
	} else {
		admin_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).admin;
	}

	// read preimage for decremented state

	a_addr_newOwnerPublicKey =
		_a_addr_newOwnerPublicKey === 0
			? generalise(
					await instance.methods
						.zkpPublicKeys(await instance.methods.admin().call())
						.call()
			  )
			: a_addr_newOwnerPublicKey;

	let a_addr_stateVarId = 5;

	const a_addr_stateVarId_key = addr;

	a_addr_stateVarId = generalise(
		utils.mimcHash(
			[generalise(a_addr_stateVarId).bigInt, a_addr_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let a_addr_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).a[a_addr_stateVarId_key.integer];

	const a_addr_newCommitmentValue = generalise(parseInt(param3.integer, 10));
	// First check if required commitments exist or not

	let commitmentFlag = getInputCommitments(
		publicKey.integer,
		a_addr_newCommitmentValue.integer,
		a_addr_preimage
	)[0];

	let a_addr_0_oldCommitment =
		_a_addr_0_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					a_addr_newCommitmentValue.integer,
					a_addr_preimage
			  )[1]
			: generalise(_a_addr_0_oldCommitment).hex(32);

	let a_addr_1_oldCommitment =
		_a_addr_1_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					a_addr_newCommitmentValue.integer,
					a_addr_preimage
			  )[2]
			: generalise(_a_addr_1_oldCommitment).hex(32);

	let a_addr_witness_0;

	let a_addr_witness_1;

	while (commitmentFlag === false) {
		a_addr_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_addr_0_oldCommitment).integer
		);

		a_addr_witness_1 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_addr_1_oldCommitment).integer
		);

		const tx = await joinCommitments(
			"MyContractShield",
			"a[a_addr_stateVarId_key.integer]",
			secretKey,
			publicKey,
			[5, a_addr_stateVarId_key],
			a_addr_preimage,
			[a_addr_0_oldCommitment, a_addr_1_oldCommitment],
			[a_addr_witness_0, a_addr_witness_1],
			instance
		);

		a_addr_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).a[a_addr_stateVarId_key.integer];

		commitmentFlag = getInputCommitments(
			publicKey.integer,
			a_addr_newCommitmentValue.integer,
			a_addr_preimage
		)[0];

		a_addr_0_oldCommitment =
			_a_addr_0_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						a_addr_newCommitmentValue.integer,
						a_addr_preimage
				  )[1]
				: generalise(_a_addr_0_oldCommitment).hex(32);

		a_addr_1_oldCommitment =
			_a_addr_1_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						a_addr_newCommitmentValue.integer,
						a_addr_preimage
				  )[2]
				: generalise(_a_addr_1_oldCommitment).hex(32);
	}
	const a_addr_0_prevSalt = generalise(
		a_addr_preimage[a_addr_0_oldCommitment].salt
	);
	const a_addr_1_prevSalt = generalise(
		a_addr_preimage[a_addr_1_oldCommitment].salt
	);
	const a_addr_0_prev = generalise(
		a_addr_preimage[a_addr_0_oldCommitment].value
	);
	const a_addr_1_prev = generalise(
		a_addr_preimage[a_addr_1_oldCommitment].value
	);

	// Extract set membership witness:

	// generate witness for partitioned state
	a_addr_witness_0 = await getMembershipWitness(
		"MyContractShield",
		generalise(a_addr_0_oldCommitment).integer
	);
	a_addr_witness_1 = await getMembershipWitness(
		"MyContractShield",
		generalise(a_addr_1_oldCommitment).integer
	);
	const a_addr_0_index = generalise(a_addr_witness_0.index);
	const a_addr_1_index = generalise(a_addr_witness_1.index);
	const a_addr_root = generalise(a_addr_witness_0.root);
	const a_addr_0_path = generalise(a_addr_witness_0.path).all;
	const a_addr_1_path = generalise(a_addr_witness_1.path).all;

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let a_addr_0_nullifier = poseidonHash([
		BigInt(a_addr_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_addr_0_prevSalt.hex(32)),
	]);
	let a_addr_1_nullifier = poseidonHash([
		BigInt(a_addr_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_addr_1_prevSalt.hex(32)),
	]);
	a_addr_0_nullifier = generalise(a_addr_0_nullifier.hex(32)); // truncate
	a_addr_1_nullifier = generalise(a_addr_1_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const a_addr_2_newSalt = generalise(utils.randomHex(32));

	let a_addr_change =
		parseInt(a_addr_0_prev.integer, 10) +
		parseInt(a_addr_1_prev.integer, 10) -
		parseInt(a_addr_newCommitmentValue.integer, 10);

	a_addr_change = generalise(a_addr_change);

	let a_addr_2_newCommitment = poseidonHash([
		BigInt(a_addr_stateVarId),
		BigInt(a_addr_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(a_addr_2_newSalt.hex(32)),
	]);

	a_addr_2_newCommitment = generalise(a_addr_2_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		addr.integer,
		param3.integer,
		secretKey.limbs(32, 8),
		secretKey.limbs(32, 8),
		a_addr_0_nullifier.integer,
		a_addr_1_nullifier.integer,
		a_addr_0_prev.integer,
		a_addr_0_prevSalt.integer,
		a_addr_1_prev.integer,
		a_addr_1_prevSalt.integer,
		a_addr_root.integer,
		a_addr_0_index.integer,
		a_addr_0_path.integer,
		a_addr_1_index.integer,
		a_addr_1_path.integer,
		a_addr_newOwnerPublicKey.integer,
		a_addr_2_newSalt.integer,
		a_addr_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("decrement", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.decrement(
			[a_addr_0_nullifier.integer, a_addr_1_nullifier.integer],
			a_addr_root.integer,
			[a_addr_2_newCommitment.integer],
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

	preimage.a[a_addr_stateVarId_key.integer][
		generalise(a_addr_0_oldCommitment).hex(32)
	].isNullified = true;

	preimage.a[a_addr_stateVarId_key.integer][
		generalise(a_addr_1_oldCommitment).hex(32)
	].isNullified = true;

	preimage.a[a_addr_stateVarId_key.integer][a_addr_2_newCommitment.hex(32)] = {
		value: a_addr_change.integer,
		salt: a_addr_2_newSalt.integer,
		publicKey: a_addr_newOwnerPublicKey.integer,
		commitment: a_addr_2_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
