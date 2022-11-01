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

export default async function pay(
	_id,
	_amount,
	_invoices_id_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");

	const msgSender = generalise(config.web3.options.defaultAccount);
	const id = generalise(_id);
	const amount = generalise(_amount);
	let invoices_id_newOwnerPublicKey = generalise(
		_invoices_id_newOwnerPublicKey
	);

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

	// Initialise commitment preimage of whole accessed state:

	let POs_id_stateVarId = 6;

	const POs_id_stateVarId_key = id;

	POs_id_stateVarId = generalise(
		utils.mimcHash(
			[generalise(POs_id_stateVarId).bigInt, POs_id_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let POs_id_commitmentExists = true;

	const POs_id_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).POs[id.integer];

	const POs_id = generalise(POs_id_preimage.value);

	// Initialise commitment preimage of whole state:

	let invoices_id_stateVarId = 11;

	const invoices_id_stateVarId_key = id;

	invoices_id_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(invoices_id_stateVarId).bigInt,
				invoices_id_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let invoices_id_commitmentExists = true;
	let invoices_id_witnessRequired = true;

	let invoices_id_preimage = {
		value: { amount: 0 },
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).invoices ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).invoices[id.integer]
	) {
		invoices_id_commitmentExists = false;
		invoices_id_witnessRequired = false;
	} else {
		invoices_id_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).invoices[id.integer];
	}

	// read preimage for accessed state

	const POs_id_currentCommitment = generalise(POs_id_preimage.commitment);
	const POs_id_prev = generalise(POs_id_preimage.value);
	const POs_id_prevSalt = generalise(POs_id_preimage.salt);

	// read preimage for whole state
	invoices_id_newOwnerPublicKey =
		_invoices_id_newOwnerPublicKey === 0
			? publicKey
			: invoices_id_newOwnerPublicKey;

	const invoices_id_currentCommitment = generalise(
		invoices_id_preimage.commitment
	);
	const invoices_id_prev = generalise(invoices_id_preimage.value);
	const invoices_id_prevSalt = generalise(invoices_id_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole accessed state
	const POs_id_witness = await getMembershipWitness(
		"ReceiptShield",
		POs_id_currentCommitment.integer
	);
	const POs_id_index = generalise(POs_id_witness.index);
	const POs_id_root = generalise(POs_id_witness.root);
	const POs_id_path = generalise(POs_id_witness.path).all;

	// generate witness for whole state
	const invoices_id_emptyPath = new Array(32).fill(0);
	const invoices_id_witness = invoices_id_witnessRequired
		? await getMembershipWitness(
				"ReceiptShield",
				invoices_id_currentCommitment.integer
		  )
		: {
				index: 0,
				path: invoices_id_emptyPath,
				root: (await getRoot("ReceiptShield")) || 0,
		  };
	const invoices_id_index = generalise(invoices_id_witness.index);
	const invoices_id_root = generalise(invoices_id_witness.root);
	const invoices_id_path = generalise(invoices_id_witness.path).all;

	let invoices_id = generalise(invoices_id_preimage.value);

	invoices_id.amount = 0;

	invoices_id = generalise(invoices_id);

	// Calculate nullifier(s):

	let POs_id_nullifier = POs_id_commitmentExists
		? poseidonHash([
				BigInt(POs_id_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(POs_id_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(POs_id_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(POs_id_prevSalt.hex(32)),
		  ]);

	POs_id_nullifier = generalise(POs_id_nullifier.hex(32)); // truncate
	let invoices_id_nullifier = invoices_id_commitmentExists
		? poseidonHash([
				BigInt(invoices_id_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(invoices_id_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(invoices_id_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(invoices_id_prevSalt.hex(32)),
		  ]);

	invoices_id_nullifier = generalise(invoices_id_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	invoices_id.amount = invoices_id.amount
		? invoices_id.amount
		: invoices_id_prev.amount;
	invoices_id.id = invoices_id.id ? invoices_id.id : invoices_id_prev.id;

	const invoices_id_newSalt = generalise(utils.randomHex(32));

	let invoices_id_newCommitment = poseidonHash([
		BigInt(invoices_id_stateVarId),
		BigInt(invoices_id.amount.hex(32)),
		BigInt(invoices_id.id.hex(32)),
		BigInt(invoices_id_newOwnerPublicKey.hex(32)),
		BigInt(invoices_id_newSalt.hex(32)),
	]);

	invoices_id_newCommitment = generalise(invoices_id_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		id.integer,
		amount.integer,
		secretKey.limbs(32, 8),
		POs_id_nullifier.integer,
		POs_id_prev.count.integer,
		POs_id_prev.ppunit.integer,
		POs_id_prev.id.integer,
		POs_id_prev.owner.integer,
		POs_id_prevSalt.integer,
		POs_id_root.integer,
		POs_id_index.integer,
		POs_id_path.integer,

		invoices_id_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		invoices_id_nullifier.integer,
		invoices_id_prev.amount.integer,
		invoices_id_prev.id.integer,
		invoices_id_prevSalt.integer,
		invoices_id_commitmentExists ? 0 : 1,

		invoices_id_index.integer,
		invoices_id_path.integer,
		invoices_id_newOwnerPublicKey.integer,
		invoices_id_newSalt.integer,
		invoices_id_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("pay", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.pay(
			[invoices_id_nullifier.integer],
			POs_id_root.integer,
			[invoices_id_newCommitment.integer],
			[POs_id_nullifier.integer],
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

	if (!preimage.invoices) preimage.invoices = {};

	if (!preimage.invoices[invoices_id_stateVarId_key.integer])
		preimage.invoices[invoices_id_stateVarId_key.integer] = {};

	preimage.invoices[invoices_id_stateVarId_key.integer] = {
		value: { amount: invoices_id.amount.integer, id: invoices_id.id.integer },
		salt: invoices_id_newSalt.integer,
		publicKey: invoices_id_newOwnerPublicKey.integer,
		commitment: invoices_id_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
