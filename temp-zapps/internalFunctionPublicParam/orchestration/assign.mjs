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

export default async function assign(_value, _x_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");
	const value = generalise(_value);
	let x_newOwnerPublicKey = generalise(_x_newOwnerPublicKey);

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

	// Initialise commitment preimage of whole state:

	const x_stateVarId = generalise(3).hex(32);

	let x_commitmentExists = true;
	let x_witnessRequired = true;

	let x_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).x ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).x
	) {
		x_commitmentExists = false;
		x_witnessRequired = false;
	} else {
		x_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).x;
	}

	// read preimage for whole state
	x_newOwnerPublicKey =
		_x_newOwnerPublicKey === 0 ? publicKey : x_newOwnerPublicKey;

	const x_currentCommitment = generalise(x_preimage.commitment);
	const x_prev = generalise(x_preimage.value);
	const x_prevSalt = generalise(x_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const x_emptyPath = new Array(32).fill(0);
	const x_witness = x_witnessRequired
		? await getMembershipWitness("AssignShield", x_currentCommitment.integer)
		: {
				index: 0,
				path: x_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const x_index = generalise(x_witness.index);
	const x_root = generalise(x_witness.root);
	const x_path = generalise(x_witness.path).all;

	let y = generalise(parseInt(value.integer, 10) ** 2);

	let x = parseInt(y.integer, 10);

	x = generalise(x);

	// Calculate nullifier(s):

	let x_nullifier = x_commitmentExists
		? poseidonHash([
				BigInt(x_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(x_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(x_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(x_prevSalt.hex(32)),
		  ]);

	x_nullifier = generalise(x_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const x_newSalt = generalise(utils.randomHex(32));

	let x_newCommitment = poseidonHash([
		BigInt(x_stateVarId),
		BigInt(x.hex(32)),
		BigInt(x_newOwnerPublicKey.hex(32)),
		BigInt(x_newSalt.hex(32)),
	]);

	x_newCommitment = generalise(x_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		x_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
		x_nullifier.integer,
		x_prev.integer,
		x_prevSalt.integer,
		x_commitmentExists ? 0 : 1,
		x_root.integer,
		x_index.integer,
		x_path.integer,
		x_newOwnerPublicKey.integer,
		x_newSalt.integer,
		x_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("assign", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.assign(
			[x_nullifier.integer],
			x_root.integer,
			[x_newCommitment.integer],
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

	preimage.x = {
		value: x.integer,
		salt: x_newSalt.integer,
		publicKey: x_newOwnerPublicKey.integer,
		commitment: x_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
