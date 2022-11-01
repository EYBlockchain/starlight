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

export default async function incrb(
	_a_newOwnerPublicKey = 0,
	_b_newOwnerPublicKey = 0,
	_c_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");

	const msgSender = generalise(config.web3.options.defaultAccount);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
	let b_newOwnerPublicKey = generalise(_b_newOwnerPublicKey);
	let c_newOwnerPublicKey = generalise(_c_newOwnerPublicKey);

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

	let z = generalise(await instance.methods.z().call());

	let y = generalise(await instance.methods.y().call());

	const x_y = generalise(await instance.methods.x(y.hex(20)).call());

	const x_msg = generalise(await instance.methods.x(msgSender.hex(20)).call());

	// Initialise commitment preimage of whole state:

	const c_stateVarId = generalise(15).hex(32);

	let c_commitmentExists = true;
	let c_witnessRequired = true;

	let c_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).c ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).c
	) {
		c_commitmentExists = false;
		c_witnessRequired = false;
	} else {
		c_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).c;
	}

	// read preimage for incremented state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_stateVarId = generalise(11).hex(32);

	const a_newCommitmentValue = generalise(parseInt(x_msg.integer, 10));

	// read preimage for incremented state
	b_newOwnerPublicKey =
		_b_newOwnerPublicKey === 0 ? publicKey : b_newOwnerPublicKey;

	const b_stateVarId = generalise(13).hex(32);

	const b_newCommitmentValue = generalise(
		parseInt(x_y.integer, 10) + parseInt(z.integer, 10)
	);

	// read preimage for whole state
	c_newOwnerPublicKey =
		_c_newOwnerPublicKey === 0 ? publicKey : c_newOwnerPublicKey;

	const c_currentCommitment = generalise(c_preimage.commitment);
	const c_prev = generalise(c_preimage.value);
	const c_prevSalt = generalise(c_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const c_emptyPath = new Array(32).fill(0);
	const c_witness = c_witnessRequired
		? await getMembershipWitness(
				"MyContractShield",
				c_currentCommitment.integer
		  )
		: {
				index: 0,
				path: c_emptyPath,
				root: (await getRoot("MyContractShield")) || 0,
		  };
	const c_index = generalise(c_witness.index);
	const c_root = generalise(c_witness.root);
	const c_path = generalise(c_witness.path).all;

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	let c = parseInt(x_y.integer, 10);

	c = generalise(c);

	// Calculate nullifier(s):

	let c_nullifier = c_commitmentExists
		? poseidonHash([
				BigInt(c_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(c_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(c_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(c_prevSalt.hex(32)),
		  ]);

	c_nullifier = generalise(c_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const a_newSalt = generalise(utils.randomHex(32));

	let a_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a_newCommitmentValue.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	const b_newSalt = generalise(utils.randomHex(32));

	let b_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b_newCommitmentValue.hex(32)),
		BigInt(b_newOwnerPublicKey.hex(32)),
		BigInt(b_newSalt.hex(32)),
	]);

	b_newCommitment = generalise(b_newCommitment.hex(32)); // truncate

	const c_newSalt = generalise(utils.randomHex(32));

	let c_newCommitment = poseidonHash([
		BigInt(c_stateVarId),
		BigInt(c.hex(32)),
		BigInt(c_newOwnerPublicKey.hex(32)),
		BigInt(c_newSalt.hex(32)),
	]);

	c_newCommitment = generalise(c_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		x_msg.integer,
		x_y.integer,
		z.integer,
		a_newOwnerPublicKey.integer,
		a_newSalt.integer,
		a_newCommitment.integer,

		b_newOwnerPublicKey.integer,
		b_newSalt.integer,
		b_newCommitment.integer,

		c_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
		c_nullifier.integer,
		c_prev.integer,
		c_prevSalt.integer,
		c_commitmentExists ? 0 : 1,
		c_root.integer,
		c_index.integer,
		c_path.integer,
		c_newOwnerPublicKey.integer,
		c_newSalt.integer,
		c_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("incrb", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.incrb(
			[c_nullifier.integer],
			c_root.integer,
			[
				a_newCommitment.integer,
				b_newCommitment.integer,
				c_newCommitment.integer,
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

	preimage.a[a_newCommitment.hex(32)] = {
		value: a_newCommitmentValue.integer,
		salt: a_newSalt.integer,
		publicKey: a_newOwnerPublicKey.integer,
		commitment: a_newCommitment.integer,
	};

	if (!preimage.b) preimage.b = {};

	preimage.b[b_newCommitment.hex(32)] = {
		value: b_newCommitmentValue.integer,
		salt: b_newSalt.integer,
		publicKey: b_newOwnerPublicKey.integer,
		commitment: b_newCommitment.integer,
	};

	if (!preimage.c) preimage.c = {};

	preimage.c = {
		value: c.integer,
		salt: c_newSalt.integer,
		publicKey: c_newOwnerPublicKey.integer,
		commitment: c_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
