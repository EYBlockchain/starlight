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

export default async function increment(_param2, _a_msg_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");
	const param2 = generalise(_param2);
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

	// read preimage for incremented state
	a_msg_newOwnerPublicKey = publicKey;

	let a_msg_stateVarId = 5;

	const a_msg_stateVarId_key = generalise(config.web3.options.defaultAccount); // emulates msg.sender

	a_msg_stateVarId = generalise(
		utils.mimcHash(
			[generalise(a_msg_stateVarId).bigInt, a_msg_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	const a_msg_newCommitmentValue = generalise(parseInt(param2.integer, 10));

	// increment would go here but has been filtered out

	// Calculate commitment(s):

	const a_msg_newSalt = generalise(utils.randomHex(32));

	let a_msg_newCommitment = poseidonHash([
		BigInt(a_msg_stateVarId),
		BigInt(a_msg_newCommitmentValue.hex(32)),
		BigInt(a_msg_newOwnerPublicKey.hex(32)),
		BigInt(a_msg_newSalt.hex(32)),
	]);

	a_msg_newCommitment = generalise(a_msg_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param2.integer,
		a_msg_stateVarId_key.integer,
		a_msg_newOwnerPublicKey.integer,
		a_msg_newSalt.integer,
		a_msg_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("increment", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.increment([a_msg_newCommitment.integer], proof)
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

	if (!preimage.a[a_msg_stateVarId_key.integer])
		preimage.a[a_msg_stateVarId_key.integer] = {};

	preimage.a[a_msg_stateVarId_key.integer][a_msg_newCommitment.hex(32)] = {
		value: a_msg_newCommitmentValue.integer,
		salt: a_msg_newSalt.integer,
		publicKey: a_msg_newOwnerPublicKey.integer,
		commitment: a_msg_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
