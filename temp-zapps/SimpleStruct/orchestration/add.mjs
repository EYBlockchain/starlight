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
	_myrct,
	_total_msg_newOwnerPublicKey = 0,
	_cmt_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");
	const myrct = generalise(_myrct);
	let total_msg_newOwnerPublicKey = generalise(_total_msg_newOwnerPublicKey);
	let cmt_newOwnerPublicKey = generalise(_cmt_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "ReceiptShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for incremented state
	total_msg_newOwnerPublicKey =
		_total_msg_newOwnerPublicKey === 0
			? publicKey
			: total_msg_newOwnerPublicKey;

	let total_msg_stateVarId = 6;

	const total_msg_stateVarId_key = generalise(
		config.web3.options.defaultAccount
	); // emulates msg.sender

	total_msg_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(total_msg_stateVarId).bigInt,
				total_msg_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	const total_msg_newCommitmentValue = generalise([
		generalise(parseInt(myrct.amount.integer, 10)),
		generalise(parseInt(myrct.tax.integer, 10)),
	]).all;

	// read preimage for incremented state
	cmt_newOwnerPublicKey =
		_cmt_newOwnerPublicKey === 0 ? publicKey : cmt_newOwnerPublicKey;

	const cmt_stateVarId = generalise(14).hex(32);

	const cmt_newCommitmentValue = generalise([
		generalise(parseInt(myrct.amount.integer, 10)),
		generalise(parseInt(myrct.tax.integer, 10)),
	]).all;

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// Calculate commitment(s):

	const total_msg_newSalt = generalise(utils.randomHex(32));

	let total_msg_newCommitment = poseidonHash([
		BigInt(total_msg_stateVarId),
		...total_msg_newCommitmentValue.hex(32).map((v) => BigInt(v)),
		BigInt(total_msg_newOwnerPublicKey.hex(32)),
		BigInt(total_msg_newSalt.hex(32)),
	]);

	total_msg_newCommitment = generalise(total_msg_newCommitment.hex(32)); // truncate

	const cmt_newSalt = generalise(utils.randomHex(32));

	let cmt_newCommitment = poseidonHash([
		BigInt(cmt_stateVarId),
		...cmt_newCommitmentValue.hex(32).map((v) => BigInt(v)),
		BigInt(cmt_newOwnerPublicKey.hex(32)),
		BigInt(cmt_newSalt.hex(32)),
	]);

	cmt_newCommitment = generalise(cmt_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		myrct.amount.integer,
		myrct.tax.integer,
		total_msg_stateVarId_key.integer,
		total_msg_newOwnerPublicKey.integer,
		total_msg_newSalt.integer,
		total_msg_newCommitment.integer,

		cmt_newOwnerPublicKey.integer,
		cmt_newSalt.integer,
		cmt_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.add([total_msg_newCommitment.integer, cmt_newCommitment.integer], proof)
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

	if (!preimage.total) preimage.total = {};

	if (!preimage.total[total_msg_stateVarId_key.integer])
		preimage.total[total_msg_stateVarId_key.integer] = {};

	preimage.total[total_msg_stateVarId_key.integer][
		total_msg_newCommitment.hex(32)
	] = {
		value: {
			amount: total_msg_newCommitmentValue.integer[0],
			tax: total_msg_newCommitmentValue.integer[1],
		},
		salt: total_msg_newSalt.integer,
		publicKey: total_msg_newOwnerPublicKey.integer,
		commitment: total_msg_newCommitment.integer,
	};

	if (!preimage.cmt) preimage.cmt = {};

	preimage.cmt[cmt_newCommitment.hex(32)] = {
		value: {
			amount: cmt_newCommitmentValue.integer[0],
			tax: cmt_newCommitmentValue.integer[1],
		},
		salt: cmt_newSalt.integer,
		publicKey: cmt_newOwnerPublicKey.integer,
		commitment: cmt_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
