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

export default async function beta(_a_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const instance = await getContractInstance("OwnerShield");

	const msgSender = generalise(config.web3.options.defaultAccount);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "OwnerShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	const a_stateVarId = generalise(3).hex(32);

	let a_commitmentExists = true;
	let a_witnessRequired = true;

	let a_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).a ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).a
	) {
		a_commitmentExists = false;
		a_witnessRequired = false;
	} else {
		a_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).a;
	}

	// Initialise commitment preimage of whole accessed state:

	const admin_stateVarId = generalise(5).hex(32);

	let admin_commitmentExists = true;

	const admin_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).admin;

	const admin = generalise(admin_preimage.value);

	// Initialise commitment preimage of whole accessed state:

	const adminstartor_stateVarId = generalise(7).hex(32);

	let adminstartor_commitmentExists = true;

	const adminstartor_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).adminstartor;

	const adminstartor = generalise(adminstartor_preimage.value);

	// read preimage for whole state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_currentCommitment = generalise(a_preimage.commitment);
	const a_prev = generalise(a_preimage.value);
	const a_prevSalt = generalise(a_preimage.salt);

	// read preimage for accessed state

	const admin_currentCommitment = generalise(admin_preimage.commitment);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// read preimage for accessed state

	const adminstartor_currentCommitment = generalise(
		adminstartor_preimage.commitment
	);
	const adminstartor_prev = generalise(adminstartor_preimage.value);
	const adminstartor_prevSalt = generalise(adminstartor_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const a_emptyPath = new Array(32).fill(0);
	const a_witness = a_witnessRequired
		? await getMembershipWitness("OwnerShield", a_currentCommitment.integer)
		: {
				index: 0,
				path: a_emptyPath,
				root: (await getRoot("OwnerShield")) || 0,
		  };
	const a_index = generalise(a_witness.index);
	const a_root = generalise(a_witness.root);
	const a_path = generalise(a_witness.path).all;

	// generate witness for whole accessed state
	const admin_witness = await getMembershipWitness(
		"OwnerShield",
		admin_currentCommitment.integer
	);
	const admin_index = generalise(admin_witness.index);
	const admin_root = generalise(admin_witness.root);
	const admin_path = generalise(admin_witness.path).all;

	// generate witness for whole accessed state
	const adminstartor_witness = await getMembershipWitness(
		"OwnerShield",
		adminstartor_currentCommitment.integer
	);
	const adminstartor_index = generalise(adminstartor_witness.index);
	const adminstartor_root = generalise(adminstartor_witness.root);
	const adminstartor_path = generalise(adminstartor_witness.path).all;

	let a = generalise(a_preimage.value);
	a = parseInt(a.integer, 10) + 3;

	a = generalise(a);

	a = parseInt(a.integer, 10) + 2;

	a = generalise(a);

	// Calculate nullifier(s):

	let a_nullifier = a_commitmentExists
		? poseidonHash([
				BigInt(a_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(a_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(a_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(a_prevSalt.hex(32)),
		  ]);

	a_nullifier = generalise(a_nullifier.hex(32)); // truncate
	let admin_nullifier = admin_commitmentExists
		? poseidonHash([
				BigInt(admin_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(admin_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(admin_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(admin_prevSalt.hex(32)),
		  ]);

	admin_nullifier = generalise(admin_nullifier.hex(32)); // truncate
	let adminstartor_nullifier = adminstartor_commitmentExists
		? poseidonHash([
				BigInt(adminstartor_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(adminstartor_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(adminstartor_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(adminstartor_prevSalt.hex(32)),
		  ]);

	adminstartor_nullifier = generalise(adminstartor_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const a_newSalt = generalise(utils.randomHex(32));

	let a_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		a_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
		a_nullifier.integer,
		a_prev.integer,
		a_prevSalt.integer,
		a_commitmentExists ? 0 : 1,
		a_root.integer,
		a_index.integer,
		a_path.integer,
		a_newOwnerPublicKey.integer,
		a_newSalt.integer,
		a_newCommitment.integer,

		secretKey.limbs(32, 8),
		admin_nullifier.integer,
		admin_prev.integer,
		admin_prevSalt.integer,

		admin_index.integer,
		admin_path.integer,

		secretKey.limbs(32, 8),
		adminstartor_nullifier.integer,
		adminstartor_prev.integer,
		adminstartor_prevSalt.integer,

		adminstartor_index.integer,
		adminstartor_path.integer,
	].flat(Infinity);
	const res = await generateProof("beta", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.beta(
			[a_nullifier.integer],
			a_root.integer,
			[a_newCommitment.integer],
			[admin_nullifier.integer, adminstartor_nullifier.integer],
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

	if (!preimage.a) preimage.a = {};

	preimage.a = {
		value: a.integer,
		salt: a_newSalt.integer,
		publicKey: a_newOwnerPublicKey.integer,
		commitment: a_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
