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

export default async function add(_j, _z_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const instance = await getContractInstance("TestShield");
	const j = generalise(_j);
	let z_newOwnerPublicKey = generalise(_z_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "TestShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	const z_stateVarId = generalise(3).hex(32);

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
	z_newOwnerPublicKey =
		_z_newOwnerPublicKey === 0 ? publicKey : z_newOwnerPublicKey;

	const z_currentCommitment = generalise(z_preimage.commitment);
	const z_prev = generalise(z_preimage.value);
	const z_prevSalt = generalise(z_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const z_emptyPath = new Array(32).fill(0);
	const z_witness = z_witnessRequired
		? await getMembershipWitness("TestShield", z_currentCommitment.integer)
		: { index: 0, path: z_emptyPath, root: (await getRoot("TestShield")) || 0 };
	const z_index = generalise(z_witness.index);
	const z_root = generalise(z_witness.root);
	const z_path = generalise(z_witness.path).all;

	let z = generalise(z_preimage.value);

	// non-secret line would go here but has been filtered out

	for (let i = 0; i < 5; i++) {
		z = parseInt(z.integer, 10) + parseInt(j.integer, 10);

		z = generalise(z);
	}

	z = generalise(z);

	// Calculate nullifier(s):

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
		j.integer,
		z_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
		z_nullifier.integer,
		z_prev.integer,
		z_prevSalt.integer,
		z_commitmentExists ? 0 : 1,
		z_root.integer,
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
			j.integer,
			[z_nullifier.integer],
			z_root.integer,
			[z_newCommitment.integer],
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
