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

export default async function remove(
	_invalidrct,
	_total_msg_newOwnerPublicKey = 0,
	_cmt_newOwnerPublicKey = 0,
	_total_msg_0_oldCommitment = 0,
	_total_msg_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");
	const invalidrct = generalise(_invalidrct);
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

	// read preimage for decremented state

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

	let total_msg_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).total[total_msg_stateVarId_key.integer];

	const total_msg_newCommitmentValue = generalise(
		parseInt(invalidrct.amount.integer, 10) +
			parseInt(invalidrct.tax.integer, 10)
	);
	// First check if required commitments exist or not

	let commitmentFlag = getInputCommitments(
		publicKey.integer,
		total_msg_newCommitmentValue.integer,
		total_msg_preimage
	)[0];

	let total_msg_0_oldCommitment =
		_total_msg_0_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					total_msg_newCommitmentValue.integer,
					total_msg_preimage
			  )[1]
			: generalise(_total_msg_0_oldCommitment).hex(32);

	let total_msg_1_oldCommitment =
		_total_msg_1_oldCommitment === 0
			? getInputCommitments(
					publicKey.integer,
					total_msg_newCommitmentValue.integer,
					total_msg_preimage
			  )[2]
			: generalise(_total_msg_1_oldCommitment).hex(32);

	let total_msg_witness_0;

	let total_msg_witness_1;

	while (commitmentFlag === false) {
		total_msg_witness_0 = await getMembershipWitness(
			"ReceiptShield",
			generalise(total_msg_0_oldCommitment).integer
		);

		total_msg_witness_1 = await getMembershipWitness(
			"ReceiptShield",
			generalise(total_msg_1_oldCommitment).integer
		);

		const tx = await joinCommitments(
			"ReceiptShield",
			"total[total_msg_stateVarId_key.integer]",
			secretKey,
			publicKey,
			[5, total_msg_stateVarId_key],
			total_msg_preimage,
			[total_msg_0_oldCommitment, total_msg_1_oldCommitment],
			[total_msg_witness_0, total_msg_witness_1],
			instance
		);

		total_msg_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).total[total_msg_stateVarId_key.integer];

		commitmentFlag = getInputCommitments(
			publicKey.integer,
			total_msg_newCommitmentValue.integer,
			total_msg_preimage
		)[0];

		total_msg_0_oldCommitment =
			_total_msg_0_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						total_msg_newCommitmentValue.integer,
						total_msg_preimage
				  )[1]
				: generalise(_total_msg_0_oldCommitment).hex(32);

		total_msg_1_oldCommitment =
			_total_msg_1_oldCommitment === 0
				? getInputCommitments(
						publicKey.integer,
						total_msg_newCommitmentValue.integer,
						total_msg_preimage
				  )[2]
				: generalise(_total_msg_1_oldCommitment).hex(32);
	}
	const total_msg_0_prevSalt = generalise(
		total_msg_preimage[total_msg_0_oldCommitment].salt
	);
	const total_msg_1_prevSalt = generalise(
		total_msg_preimage[total_msg_1_oldCommitment].salt
	);
	const total_msg_0_prev = generalise(
		total_msg_preimage[total_msg_0_oldCommitment].value
	);
	const total_msg_1_prev = generalise(
		total_msg_preimage[total_msg_1_oldCommitment].value
	);

	// read preimage for whole state
	cmt_newOwnerPublicKey =
		_cmt_newOwnerPublicKey === 0 ? publicKey : cmt_newOwnerPublicKey;

	const cmt_currentCommitment = generalise(cmt_preimage.commitment);
	const cmt_prev = generalise(cmt_preimage.value);
	const cmt_prevSalt = generalise(cmt_preimage.salt);

	// Extract set membership witness:

	// generate witness for partitioned state
	total_msg_witness_0 = await getMembershipWitness(
		"ReceiptShield",
		generalise(total_msg_0_oldCommitment).integer
	);
	total_msg_witness_1 = await getMembershipWitness(
		"ReceiptShield",
		generalise(total_msg_1_oldCommitment).integer
	);
	const total_msg_0_index = generalise(total_msg_witness_0.index);
	const total_msg_1_index = generalise(total_msg_witness_1.index);
	const total_msg_root = generalise(total_msg_witness_0.root);
	const total_msg_0_path = generalise(total_msg_witness_0.path).all;
	const total_msg_1_path = generalise(total_msg_witness_1.path).all;

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
	cmt.amount = 0;

	cmt.amount = generalise(cmt.amount);

	cmt.tax = 0;

	cmt.tax = generalise(cmt.tax);

	// Calculate nullifier(s):

	let total_msg_0_nullifier = poseidonHash([
		BigInt(total_msg_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(total_msg_0_prevSalt.hex(32)),
	]);
	let total_msg_1_nullifier = poseidonHash([
		BigInt(total_msg_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(total_msg_1_prevSalt.hex(32)),
	]);
	total_msg_0_nullifier = generalise(total_msg_0_nullifier.hex(32)); // truncate
	total_msg_1_nullifier = generalise(total_msg_1_nullifier.hex(32)); // truncate
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

	const total_msg_2_newSalt = generalise(utils.randomHex(32));

	let total_msg_change =
		parseInt(total_msg_0_prev.integer, 10) +
		parseInt(total_msg_1_prev.integer, 10) -
		parseInt(total_msg_newCommitmentValue.integer, 10);

	total_msg_change = generalise(total_msg_change);

	let total_msg_2_newCommitment = poseidonHash([
		BigInt(total_msg_stateVarId),
		BigInt(total_msg_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(total_msg_2_newSalt.hex(32)),
	]);

	total_msg_2_newCommitment = generalise(total_msg_2_newCommitment.hex(32)); // truncate

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
		invalidrct.amount.integer,
		invalidrct.tax.integer,
		total_msg_stateVarId_key.integer,
		secretKey.limbs(32, 8),
		secretKey.limbs(32, 8),
		total_msg_0_nullifier.integer,
		total_msg_1_nullifier.integer,
		total_msg_0_prev.integer,
		total_msg_0_prevSalt.integer,
		total_msg_1_prev.integer,
		total_msg_1_prevSalt.integer,
		total_msg_root.integer,
		total_msg_0_index.integer,
		total_msg_0_path.integer,
		total_msg_1_index.integer,
		total_msg_1_path.integer,
		total_msg_newOwnerPublicKey.integer,
		total_msg_2_newSalt.integer,
		total_msg_2_newCommitment.integer,

		cmt_commitmentExists ? secretKey.limbs(32, 8) : generalise(0).limbs(32, 8),
		cmt_nullifier.integer,
		cmt_prev.amount.integer,
		cmt_prev.tax.integer,
		cmt_prevSalt.integer,
		cmt_commitmentExists ? 0 : 1,

		cmt_index.integer,
		cmt_path.integer,
		cmt_newOwnerPublicKey.integer,
		cmt_newSalt.integer,
		cmt_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("remove", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.remove(
			[
				total_msg_0_nullifier.integer,
				total_msg_1_nullifier.integer,
				cmt_nullifier.integer,
			],
			total_msg_root.integer,
			[total_msg_2_newCommitment.integer, cmt_newCommitment.integer],
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

	preimage.total[total_msg_stateVarId_key.integer][
		generalise(total_msg_0_oldCommitment).hex(32)
	].isNullified = true;

	preimage.total[total_msg_stateVarId_key.integer][
		generalise(total_msg_1_oldCommitment).hex(32)
	].isNullified = true;

	preimage.total[total_msg_stateVarId_key.integer][
		total_msg_2_newCommitment.hex(32)
	] = {
		value: total_msg_change.integer,
		salt: total_msg_2_newSalt.integer,
		publicKey: total_msg_newOwnerPublicKey.integer,
		commitment: total_msg_2_newCommitment.integer,
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
