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
		await registerKey(utils.randomHex(32), "ReceiptShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	const cmt_stateVarId = generalise(13).hex(32);

	let cmt_commitmentExists = true;
	let cmt_witnessRequired = true;

	let cmt_preimage = {
		value: { amount: 0, tax: 0 },
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).cmt ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).cmt
	) {
		cmt_commitmentExists = false;
		cmt_witnessRequired = false;
	} else {
		cmt_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).cmt;
	}

	// read preimage for incremented state
	total_msg_newOwnerPublicKey = publicKey;

	let total_msg_stateVarId = 5;

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

	const total_msg_newCommitmentValue = generalise(
		parseInt(myrct.amount.integer, 10) + parseInt(myrct.tax.integer, 10)
	);

	// read preimage for whole state
	cmt_newOwnerPublicKey =
		_cmt_newOwnerPublicKey === 0 ? publicKey : cmt_newOwnerPublicKey;

	const cmt_currentCommitment = generalise(cmt_preimage.commitment);
	const cmt_prev = generalise(cmt_preimage.value);
	const cmt_prevSalt = generalise(cmt_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const cmt_emptyPath = new Array(32).fill(0);
	const cmt_witness = cmt_witnessRequired
		? await getMembershipWitness("ReceiptShield", cmt_currentCommitment.integer)
		: {
				index: 0,
				path: cmt_emptyPath,
				root: (await getRoot("ReceiptShield")) || 0,
		  };
	const cmt_index = generalise(cmt_witness.index);
	const cmt_root = generalise(cmt_witness.root);
	const cmt_path = generalise(cmt_witness.path).all;

	// increment would go here but has been filtered out

	let cmt = {};
	cmt.amount = parseInt(myrct.amount.integer, 10);

	cmt.amount = generalise(cmt.amount);

	cmt.tax = parseInt(myrct.tax.integer, 10);

	cmt.tax = generalise(cmt.tax);

	// Calculate nullifier(s):

	let cmt_nullifier = cmt_commitmentExists
		? poseidonHash([
				BigInt(cmt_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(cmt_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(cmt_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(cmt_prevSalt.hex(32)),
		  ]);

	cmt_nullifier = generalise(cmt_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const total_msg_newSalt = generalise(utils.randomHex(32));

	let total_msg_newCommitment = poseidonHash([
		BigInt(total_msg_stateVarId),
		BigInt(total_msg_newCommitmentValue.hex(32)),
		BigInt(total_msg_newOwnerPublicKey.hex(32)),
		BigInt(total_msg_newSalt.hex(32)),
	]);

	total_msg_newCommitment = generalise(total_msg_newCommitment.hex(32)); // truncate

	cmt.amount = cmt.amount ? cmt.amount : cmt_prev.amount;
	cmt.tax = cmt.tax ? cmt.tax : cmt_prev.tax;

	const cmt_newSalt = generalise(utils.randomHex(32));

	let cmt_newCommitment = poseidonHash([
		BigInt(cmt_stateVarId),
		BigInt(cmt.amount.hex(32)),
		BigInt(cmt.tax.hex(32)),
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

		cmt_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
		cmt_nullifier.integer,
		cmt_prev.amount.integer,
		cmt_prev.tax.integer,
		cmt_prevSalt.integer,
		cmt_commitmentExists ? 0 : 1,
		cmt_root.integer,
		cmt_index.integer,
		cmt_path.integer,
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
		.add(
			[cmt_nullifier.integer],
			cmt_root.integer,
			[total_msg_newCommitment.integer, cmt_newCommitment.integer],
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

	if (!preimage.total) preimage.total = {};

	if (!preimage.total[total_msg_stateVarId_key.integer])
		preimage.total[total_msg_stateVarId_key.integer] = {};

	preimage.total[total_msg_stateVarId_key.integer][
		total_msg_newCommitment.hex(32)
	] = {
		value: total_msg_newCommitmentValue.integer,
		salt: total_msg_newSalt.integer,
		publicKey: total_msg_newOwnerPublicKey.integer,
		commitment: total_msg_newCommitment.integer,
	};

	if (!preimage.cmt) preimage.cmt = {};

	preimage.cmt = {
		value: { amount: cmt.amount.integer, tax: cmt.tax.integer },
		salt: cmt_newSalt.integer,
		publicKey: cmt_newOwnerPublicKey.integer,
		commitment: cmt_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
