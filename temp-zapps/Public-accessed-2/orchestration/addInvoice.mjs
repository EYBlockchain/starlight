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

export default async function addInvoice(
	_inv,
	_invoices_invdotid_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");
	const inv = generalise(_inv);
	let invoices_invdotid_newOwnerPublicKey = generalise(
		_invoices_invdotid_newOwnerPublicKey
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

	let POs_invdotid_stateVarId = 6;

	const POs_invdotid_stateVarId_key = inv.id;

	POs_invdotid_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(POs_invdotid_stateVarId).bigInt,
				POs_invdotid_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let POs_invdotid_commitmentExists = true;

	const POs_invdotid_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).POs[inv.id.integer];

	const POs_invdotid = generalise(POs_invdotid_preimage.value);

	// Initialise commitment preimage of whole state:

	let invoices_invdotid_stateVarId = 11;

	const invoices_invdotid_stateVarId_key = inv.id;

	invoices_invdotid_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(invoices_invdotid_stateVarId).bigInt,
				invoices_invdotid_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let invoices_invdotid_commitmentExists = true;
	let invoices_invdotid_witnessRequired = true;

	let invoices_invdotid_preimage = {
		value: { id: 0, amount: 0 },
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).invoices ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).invoices[inv.id.integer]
	) {
		invoices_invdotid_commitmentExists = false;
		invoices_invdotid_witnessRequired = false;
	} else {
		invoices_invdotid_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).invoices[inv.id.integer];
	}

	// read preimage for accessed state

	const POs_invdotid_currentCommitment = generalise(
		POs_invdotid_preimage.commitment
	);
	const POs_invdotid_prev = generalise(POs_invdotid_preimage.value);
	const POs_invdotid_prevSalt = generalise(POs_invdotid_preimage.salt);

	// read preimage for whole state
	invoices_invdotid_newOwnerPublicKey =
		_invoices_invdotid_newOwnerPublicKey === 0
			? publicKey
			: invoices_invdotid_newOwnerPublicKey;

	const invoices_invdotid_currentCommitment = generalise(
		invoices_invdotid_preimage.commitment
	);
	const invoices_invdotid_prev = generalise(invoices_invdotid_preimage.value);
	const invoices_invdotid_prevSalt = generalise(
		invoices_invdotid_preimage.salt
	);

	// Extract set membership witness:

	// generate witness for whole accessed state
	const POs_invdotid_witness = await getMembershipWitness(
		"ReceiptShield",
		POs_invdotid_currentCommitment.integer
	);
	const POs_invdotid_index = generalise(POs_invdotid_witness.index);
	const POs_invdotid_root = generalise(POs_invdotid_witness.root);
	const POs_invdotid_path = generalise(POs_invdotid_witness.path).all;

	// generate witness for whole state
	const invoices_invdotid_emptyPath = new Array(32).fill(0);
	const invoices_invdotid_witness = invoices_invdotid_witnessRequired
		? await getMembershipWitness(
				"ReceiptShield",
				invoices_invdotid_currentCommitment.integer
		  )
		: {
				index: 0,
				path: invoices_invdotid_emptyPath,
				root: (await getRoot("ReceiptShield")) || 0,
		  };
	const invoices_invdotid_index = generalise(invoices_invdotid_witness.index);
	const invoices_invdotid_root = generalise(invoices_invdotid_witness.root);
	const invoices_invdotid_path = generalise(invoices_invdotid_witness.path).all;

	let invoices_invdotid = generalise(invoices_invdotid_preimage.value);

	invoices_invdotid.amount = parseInt(inv.amount.integer, 10);

	invoices_invdotid = generalise(invoices_invdotid);

	invoices_invdotid.id = parseInt(inv.id.integer, 10);

	invoices_invdotid = generalise(invoices_invdotid);

	// Calculate nullifier(s):

	let POs_invdotid_nullifier = POs_invdotid_commitmentExists
		? poseidonHash([
				BigInt(POs_invdotid_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(POs_invdotid_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(POs_invdotid_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(POs_invdotid_prevSalt.hex(32)),
		  ]);

	POs_invdotid_nullifier = generalise(POs_invdotid_nullifier.hex(32)); // truncate
	let invoices_invdotid_nullifier = invoices_invdotid_commitmentExists
		? poseidonHash([
				BigInt(invoices_invdotid_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(invoices_invdotid_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(invoices_invdotid_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(invoices_invdotid_prevSalt.hex(32)),
		  ]);

	invoices_invdotid_nullifier = generalise(invoices_invdotid_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	invoices_invdotid.amount = invoices_invdotid.amount
		? invoices_invdotid.amount
		: invoices_invdotid_prev.amount;
	invoices_invdotid.id = invoices_invdotid.id
		? invoices_invdotid.id
		: invoices_invdotid_prev.id;

	const invoices_invdotid_newSalt = generalise(utils.randomHex(32));

	let invoices_invdotid_newCommitment = poseidonHash([
		BigInt(invoices_invdotid_stateVarId),
		BigInt(invoices_invdotid.amount.hex(32)),
		BigInt(invoices_invdotid.id.hex(32)),
		BigInt(invoices_invdotid_newOwnerPublicKey.hex(32)),
		BigInt(invoices_invdotid_newSalt.hex(32)),
	]);

	invoices_invdotid_newCommitment = generalise(
		invoices_invdotid_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		inv.amount.integer,
		inv.id.integer,
		secretKey.limbs(32, 8),
		POs_invdotid_nullifier.integer,
		POs_invdotid_prev.count.integer,
		POs_invdotid_prev.ppunit.integer,
		POs_invdotid_prev.id.integer,
		POs_invdotid_prev.owner.integer,
		POs_invdotid_prevSalt.integer,
		POs_invdotid_root.integer,
		POs_invdotid_index.integer,
		POs_invdotid_path.integer,

		invoices_invdotid_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		invoices_invdotid_nullifier.integer,
		invoices_invdotid_prev.amount.integer,
		invoices_invdotid_prev.id.integer,
		invoices_invdotid_prevSalt.integer,
		invoices_invdotid_commitmentExists ? 0 : 1,

		invoices_invdotid_index.integer,
		invoices_invdotid_path.integer,
		invoices_invdotid_newOwnerPublicKey.integer,
		invoices_invdotid_newSalt.integer,
		invoices_invdotid_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("addInvoice", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.addInvoice(
			[invoices_invdotid_nullifier.integer],
			POs_invdotid_root.integer,
			[invoices_invdotid_newCommitment.integer],
			[POs_invdotid_nullifier.integer],
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

	if (!preimage.invoices[invoices_invdotid_stateVarId_key.integer])
		preimage.invoices[invoices_invdotid_stateVarId_key.integer] = {};

	preimage.invoices[invoices_invdotid_stateVarId_key.integer] = {
		value: {
			amount: invoices_invdotid.amount.integer,
			id: invoices_invdotid.id.integer,
		},
		salt: invoices_invdotid_newSalt.integer,
		publicKey: invoices_invdotid_newOwnerPublicKey.integer,
		commitment: invoices_invdotid_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
