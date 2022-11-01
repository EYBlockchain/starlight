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

export default async function assign(
	_param1,
	_key,
	_c,
	_a_newOwnerPublicKey = 0,
	_b_key_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");
	const param1 = generalise(_param1);
	const key = generalise(_key);
	const c = generalise(_c);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
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

	// read preimage for incremented state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_stateVarId = generalise(3).hex(32);

	const a_newCommitmentValue = generalise(parseInt(param1.integer, 10));

	// read preimage for incremented state
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

	const b_key_newCommitmentValue = generalise(parseInt(c.integer, 10));

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// Calculate commitment(s):

	const a_newSalt = generalise(utils.randomHex(32));

	let a_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a_newCommitmentValue.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	const b_key_newSalt = generalise(utils.randomHex(32));

	let b_key_newCommitment = poseidonHash([
		BigInt(b_key_stateVarId),
		BigInt(b_key_newCommitmentValue.hex(32)),
		BigInt(b_key_newOwnerPublicKey.hex(32)),
		BigInt(b_key_newSalt.hex(32)),
	]);

	b_key_newCommitment = generalise(b_key_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param1.integer,
		key.integer,
		c.integer,
		a_newOwnerPublicKey.integer,
		a_newSalt.integer,
		a_newCommitment.integer,

		b_key_newOwnerPublicKey.integer,
		b_key_newSalt.integer,
		b_key_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("assign", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.assign(
			key.integer,
			[a_newCommitment.integer, b_key_newCommitment.integer],
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

	if (!preimage.b[b_key_stateVarId_key.integer])
		preimage.b[b_key_stateVarId_key.integer] = {};

	preimage.b[b_key_stateVarId_key.integer][b_key_newCommitment.hex(32)] = {
		value: b_key_newCommitmentValue.integer,
		salt: b_key_newSalt.integer,
		publicKey: b_key_newOwnerPublicKey.integer,
		commitment: b_key_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
