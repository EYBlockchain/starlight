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

export default async function assign3(_param5, _b_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");
	const param5 = generalise(_param5);
	let b_newOwnerPublicKey = generalise(_b_newOwnerPublicKey);

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

	const b_stateVarId = generalise(7).hex(32);

	let b_commitmentExists = true;
	let b_witnessRequired = true;

	let b_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).b ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).b
	) {
		b_commitmentExists = false;
		b_witnessRequired = false;
	} else {
		b_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).b;
	}

	// read preimage for whole state
	b_newOwnerPublicKey =
		_b_newOwnerPublicKey === 0
			? generalise(
					await instance.methods
						.zkpPublicKeys(await instance.methods.admin().call())
						.call()
			  )
			: b_newOwnerPublicKey;

	const b_currentCommitment = generalise(b_preimage.commitment);
	const b_prev = generalise(b_preimage.value);
	const b_prevSalt = generalise(b_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const b_emptyPath = new Array(32).fill(0);
	const b_witness = b_witnessRequired
		? await getMembershipWitness(
				"MyContractShield",
				b_currentCommitment.integer
		  )
		: {
				index: 0,
				path: b_emptyPath,
				root: (await getRoot("MyContractShield")) || 0,
		  };
	const b_index = generalise(b_witness.index);
	const b_root = generalise(b_witness.root);
	const b_path = generalise(b_witness.path).all;

	let b = generalise(b_preimage.value);
	b = parseInt(b.integer, 10) + parseInt(param5.integer, 10);

	b = generalise(b);

	// Calculate nullifier(s):

	let b_nullifier = b_commitmentExists
		? poseidonHash([
				BigInt(b_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(b_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(b_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(b_prevSalt.hex(32)),
		  ]);

	b_nullifier = generalise(b_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const b_newSalt = generalise(utils.randomHex(32));

	let b_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b.hex(32)),
		BigInt(b_newOwnerPublicKey.hex(32)),
		BigInt(b_newSalt.hex(32)),
	]);

	b_newCommitment = generalise(b_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param5.integer,
		b_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
		b_nullifier.integer,
		b_prev.integer,
		b_prevSalt.integer,
		b_commitmentExists ? 0 : 1,
		b_root.integer,
		b_index.integer,
		b_path.integer,
		b_newOwnerPublicKey.integer,
		b_newSalt.integer,
		b_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("assign3", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.assign3(
			[b_nullifier.integer],
			b_root.integer,
			[b_newCommitment.integer],
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

	if (!preimage.b) preimage.b = {};

	preimage.b = {
		value: b.integer,
		salt: b_newSalt.integer,
		publicKey: b_newOwnerPublicKey.integer,
		commitment: b_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
