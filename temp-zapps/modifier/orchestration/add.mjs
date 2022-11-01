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

export default async function add(
	_value,
	_a_newOwnerPublicKey = 0,
	_b_index_newOwnerPublicKey = 0,
	_b_index_1_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");
	const value = generalise(_value);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
	let b_index_newOwnerPublicKey = generalise(_b_index_newOwnerPublicKey);
	let b_index_1_newOwnerPublicKey = generalise(_b_index_1_newOwnerPublicKey);

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

	let index = generalise(await instance.methods.index().call());

	let index_1 = generalise(index.integer++);

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

	// Initialise commitment preimage of whole state:

	let b_index_stateVarId = 6;

	const b_index_stateVarId_key = index;

	b_index_stateVarId = generalise(
		utils.mimcHash(
			[generalise(b_index_stateVarId).bigInt, b_index_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let b_index_commitmentExists = true;
	let b_index_witnessRequired = true;

	let b_index_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).b ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).b[index.integer]
	) {
		b_index_commitmentExists = false;
		b_index_witnessRequired = false;
	} else {
		b_index_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).b[index.integer];
	}

	// Initialise commitment preimage of whole state:

	let b_index_1_stateVarId = 6;

	const b_index_1_stateVarId_key = index_1;

	b_index_1_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(b_index_1_stateVarId).bigInt,
				b_index_1_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let b_index_1_commitmentExists = true;
	let b_index_1_witnessRequired = true;

	let b_index_1_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).b ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).b[index.integer]
	) {
		b_index_1_commitmentExists = false;
		b_index_1_witnessRequired = false;
	} else {
		b_index_1_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).b[index.integer];
	}

	// read preimage for whole state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_currentCommitment = generalise(a_preimage.commitment);
	const a_prev = generalise(a_preimage.value);
	const a_prevSalt = generalise(a_preimage.salt);

	// read preimage for whole state
	b_index_newOwnerPublicKey =
		_b_index_newOwnerPublicKey === 0 ? publicKey : b_index_newOwnerPublicKey;

	const b_index_currentCommitment = generalise(b_index_preimage.commitment);
	const b_index_prev = generalise(b_index_preimage.value);
	const b_index_prevSalt = generalise(b_index_preimage.salt);

	// read preimage for whole state
	b_index_1_newOwnerPublicKey =
		_b_index_1_newOwnerPublicKey === 0
			? publicKey
			: b_index_1_newOwnerPublicKey;

	const b_index_1_currentCommitment = generalise(b_index_1_preimage.commitment);
	const b_index_1_prev = generalise(b_index_1_preimage.value);
	const b_index_1_prevSalt = generalise(b_index_1_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const a_emptyPath = new Array(32).fill(0);
	const a_witness = a_witnessRequired
		? await getMembershipWitness("AssignShield", a_currentCommitment.integer)
		: {
				index: 0,
				path: a_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const a_index = generalise(a_witness.index);
	const a_root = generalise(a_witness.root);
	const a_path = generalise(a_witness.path).all;

	// generate witness for whole state
	const b_index_emptyPath = new Array(32).fill(0);
	const b_index_witness = b_index_witnessRequired
		? await getMembershipWitness(
				"AssignShield",
				b_index_currentCommitment.integer
		  )
		: {
				index: 0,
				path: b_index_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const b_index_index = generalise(b_index_witness.index);
	const b_index_root = generalise(b_index_witness.root);
	const b_index_path = generalise(b_index_witness.path).all;

	// generate witness for whole state
	const b_index_1_emptyPath = new Array(32).fill(0);
	const b_index_1_witness = b_index_1_witnessRequired
		? await getMembershipWitness(
				"AssignShield",
				b_index_1_currentCommitment.integer
		  )
		: {
				index: 0,
				path: b_index_1_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const b_index_1_index = generalise(b_index_1_witness.index);
	const b_index_1_root = generalise(b_index_1_witness.root);
	const b_index_1_path = generalise(b_index_1_witness.path).all;

	let a = generalise(a_preimage.value);
	a = parseInt(a.integer, 10) + parseInt(value.integer, 10);

	a = generalise(a);

	let b_index = 0;

	b_index = generalise(b_index);

	let b_index_1 = parseInt(value.integer, 10);

	b_index = generalise(b_index);

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
	let b_index_nullifier = b_index_commitmentExists
		? poseidonHash([
				BigInt(b_index_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(b_index_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(b_index_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(b_index_prevSalt.hex(32)),
		  ]);

	b_index_nullifier = generalise(b_index_nullifier.hex(32)); // truncate
	let b_index_1_nullifier = b_index_1_commitmentExists
		? poseidonHash([
				BigInt(b_index_1_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(b_index_1_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(b_index_1_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(b_index_1_prevSalt.hex(32)),
		  ]);

	b_index_1_nullifier = generalise(b_index_1_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const a_newSalt = generalise(utils.randomHex(32));

	let a_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	const b_index_newSalt = generalise(utils.randomHex(32));

	let b_index_newCommitment = poseidonHash([
		BigInt(b_index_stateVarId),
		BigInt(b_index.hex(32)),
		BigInt(b_index_newOwnerPublicKey.hex(32)),
		BigInt(b_index_newSalt.hex(32)),
	]);

	b_index_newCommitment = generalise(b_index_newCommitment.hex(32)); // truncate

	const b_index_1_newSalt = generalise(utils.randomHex(32));

	let b_index_1_newCommitment = poseidonHash([
		BigInt(b_index_1_stateVarId),
		BigInt(b_index_1.hex(32)),
		BigInt(b_index_1_newOwnerPublicKey.hex(32)),
		BigInt(b_index_1_newSalt.hex(32)),
	]);

	b_index_1_newCommitment = generalise(b_index_1_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		index.integer,
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

		b_index_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		b_index_nullifier.integer,
		b_index_prev.integer,
		b_index_prevSalt.integer,
		b_index_commitmentExists ? 0 : 1,

		b_index_index.integer,
		b_index_path.integer,
		b_index_newOwnerPublicKey.integer,
		b_index_newSalt.integer,
		b_index_newCommitment.integer,

		b_index_1_stateVarId_key.integer,
		b_index_1_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		b_index_1_nullifier.integer,
		b_index_1_prev.integer,
		b_index_1_prevSalt.integer,
		b_index_1_commitmentExists ? 0 : 1,

		b_index_1_index.integer,
		b_index_1_path.integer,
		b_index_1_newOwnerPublicKey.integer,
		b_index_1_newSalt.integer,
		b_index_1_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.add(
			[
				a_nullifier.integer,
				b_index_nullifier.integer,
				b_index_1_nullifier.integer,
			],
			a_root.integer,
			[
				a_newCommitment.integer,
				b_index_newCommitment.integer,
				b_index_1_newCommitment.integer,
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

	if (!preimage.a) preimage.a = {};

	preimage.a = {
		value: a.integer,
		salt: a_newSalt.integer,
		publicKey: a_newOwnerPublicKey.integer,
		commitment: a_newCommitment.integer,
	};

	if (!preimage.b) preimage.b = {};

	if (!preimage.b[b_index_stateVarId_key.integer])
		preimage.b[b_index_stateVarId_key.integer] = {};

	preimage.b[b_index_stateVarId_key.integer] = {
		value: b_index.integer,
		salt: b_index_newSalt.integer,
		publicKey: b_index_newOwnerPublicKey.integer,
		commitment: b_index_newCommitment.integer,
	};

	if (!preimage.b) preimage.b = {};

	if (!preimage.b[b_index_1_stateVarId_key.integer])
		preimage.b[b_index_1_stateVarId_key.integer] = {};

	preimage.b[b_index_1_stateVarId_key.integer] = {
		value: b_index_1.integer,
		salt: b_index_1_newSalt.integer,
		publicKey: b_index_1_newOwnerPublicKey.integer,
		commitment: b_index_1_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
