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
	_y,
	_x_msg_newOwnerPublicKey = 0,
	_z_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("TestShield");
	const y = generalise(_y);
	let x_msg_newOwnerPublicKey = generalise(_x_msg_newOwnerPublicKey);
	let z_newOwnerPublicKey = generalise(_z_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "TestShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	let x_msg_stateVarId = 5;

	const x_msg_stateVarId_key = generalise(config.web3.options.defaultAccount); // emulates msg.sender

	x_msg_stateVarId = generalise(
		utils.mimcHash(
			[generalise(x_msg_stateVarId).bigInt, x_msg_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let x_msg_commitmentExists = true;
	let x_msg_witnessRequired = true;

	let x_msg_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).x ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).x[x_msg_stateVarId_key.integer]
	) {
		x_msg_commitmentExists = false;
		x_msg_witnessRequired = false;
	} else {
		x_msg_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).x[x_msg_stateVarId_key.integer];
	}

	// Initialise commitment preimage of whole state:

	const z_stateVarId = generalise(7).hex(32);

	let z_commitmentExists = true;
	let z_witnessRequired = true;

	let z_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).z ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).z
	) {
		z_commitmentExists = false;
		z_witnessRequired = false;
	} else {
		z_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).z;
	}

	// read preimage for whole state
	x_msg_newOwnerPublicKey = publicKey;

	const x_msg_currentCommitment = generalise(x_msg_preimage.commitment);
	const x_msg_prev = generalise(x_msg_preimage.value);
	const x_msg_prevSalt = generalise(x_msg_preimage.salt);

	// read preimage for whole state
	z_newOwnerPublicKey =
		_z_newOwnerPublicKey === 0 ? publicKey : z_newOwnerPublicKey;

	const z_currentCommitment = generalise(z_preimage.commitment);
	const z_prev = generalise(z_preimage.value);
	const z_prevSalt = generalise(z_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const x_msg_emptyPath = new Array(32).fill(0);
	const x_msg_witness = x_msg_witnessRequired
		? await getMembershipWitness("TestShield", x_msg_currentCommitment.integer)
		: {
				index: 0,
				path: x_msg_emptyPath,
				root: (await getRoot("TestShield")) || 0,
		  };
	const x_msg_index = generalise(x_msg_witness.index);
	const x_msg_root = generalise(x_msg_witness.root);
	const x_msg_path = generalise(x_msg_witness.path).all;

	// generate witness for whole state
	const z_emptyPath = new Array(32).fill(0);
	const z_witness = z_witnessRequired
		? await getMembershipWitness("TestShield", z_currentCommitment.integer)
		: { index: 0, path: z_emptyPath, root: (await getRoot("TestShield")) || 0 };
	const z_index = generalise(z_witness.index);
	const z_root = generalise(z_witness.root);
	const z_path = generalise(z_witness.path).all;

	let x_msg = generalise(x_msg_preimage.value);

	let z = generalise(z_preimage.value);

	if (parseInt(x_msg.integer, 10) > 5) {
		z = parseInt(y.integer, 10) + 3;
	} else {
		x_msg = parseInt(y.integer, 10) + 1;
	}

	z = generalise(z);

	x_msg = generalise(x_msg);

	// Calculate nullifier(s):

	let x_msg_nullifier = x_msg_commitmentExists
		? poseidonHash([
				BigInt(x_msg_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(x_msg_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(x_msg_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(x_msg_prevSalt.hex(32)),
		  ]);

	x_msg_nullifier = generalise(x_msg_nullifier.hex(32)); // truncate
	let z_nullifier = z_commitmentExists
		? poseidonHash([
				BigInt(z_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(z_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(z_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(z_prevSalt.hex(32)),
		  ]);

	z_nullifier = generalise(z_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const x_msg_newSalt = generalise(utils.randomHex(32));

	let x_msg_newCommitment = poseidonHash([
		BigInt(x_msg_stateVarId),
		BigInt(x_msg.hex(32)),
		BigInt(x_msg_newOwnerPublicKey.hex(32)),
		BigInt(x_msg_newSalt.hex(32)),
	]);

	x_msg_newCommitment = generalise(x_msg_newCommitment.hex(32)); // truncate

	const z_newSalt = generalise(utils.randomHex(32));

	let z_newCommitment = poseidonHash([
		BigInt(z_stateVarId),
		BigInt(z.hex(32)),
		BigInt(z_newOwnerPublicKey.hex(32)),
		BigInt(z_newSalt.hex(32)),
	]);

	z_newCommitment = generalise(z_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		y.integer,
		x_msg_stateVarId_key.integer,
		x_msg_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		x_msg_nullifier.integer,
		x_msg_prev.integer,
		x_msg_prevSalt.integer,
		x_msg_commitmentExists ? 0 : 1,
		x_msg_root.integer,
		x_msg_index.integer,
		x_msg_path.integer,
		x_msg_newOwnerPublicKey.integer,
		x_msg_newSalt.integer,
		x_msg_newCommitment.integer,

		z_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
		z_nullifier.integer,
		z_prev.integer,
		z_prevSalt.integer,
		z_commitmentExists ? 0 : 1,

		z_index.integer,
		z_path.integer,
		z_newOwnerPublicKey.integer,
		z_newSalt.integer,
		z_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.add(
			y.integer,
			[x_msg_nullifier.integer, z_nullifier.integer],
			x_msg_root.integer,
			[x_msg_newCommitment.integer, z_newCommitment.integer],
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

	if (!preimage.x) preimage.x = {};

	if (!preimage.x[x_msg_stateVarId_key.integer])
		preimage.x[x_msg_stateVarId_key.integer] = {};

	preimage.x[x_msg_stateVarId_key.integer] = {
		value: x_msg.integer,
		salt: x_msg_newSalt.integer,
		publicKey: x_msg_newOwnerPublicKey.integer,
		commitment: x_msg_newCommitment.integer,
	};

	if (!preimage.z) preimage.z = {};

	preimage.z = {
		value: z.integer,
		salt: z_newSalt.integer,
		publicKey: z_newOwnerPublicKey.integer,
		commitment: z_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
