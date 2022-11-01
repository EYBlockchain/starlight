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

export default async function addPO(
	_newpo,
	_POs_newpodotid_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");

	const msgSender = generalise(config.web3.options.defaultAccount);
	const newpo = generalise(_newpo);
	let POs_newpodotid_newOwnerPublicKey = generalise(
		_POs_newpodotid_newOwnerPublicKey
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

	// Initialise commitment preimage of whole state:

	let POs_newpodotid_stateVarId = 6;

	const POs_newpodotid_stateVarId_key = newpo.id;

	POs_newpodotid_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(POs_newpodotid_stateVarId).bigInt,
				POs_newpodotid_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let POs_newpodotid_commitmentExists = true;
	let POs_newpodotid_witnessRequired = true;

	let POs_newpodotid_preimage = {
		value: { id: 0, count: 0, ppunit: 0, owner: 0 },
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).POs ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).POs[newpo.id.integer]
	) {
		POs_newpodotid_commitmentExists = false;
		POs_newpodotid_witnessRequired = false;
	} else {
		POs_newpodotid_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).POs[newpo.id.integer];
	}

	// read preimage for whole state
	POs_newpodotid_newOwnerPublicKey =
		_POs_newpodotid_newOwnerPublicKey === 0
			? publicKey
			: POs_newpodotid_newOwnerPublicKey;

	const POs_newpodotid_currentCommitment = generalise(
		POs_newpodotid_preimage.commitment
	);
	const POs_newpodotid_prev = generalise(POs_newpodotid_preimage.value);
	const POs_newpodotid_prevSalt = generalise(POs_newpodotid_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const POs_newpodotid_emptyPath = new Array(32).fill(0);
	const POs_newpodotid_witness = POs_newpodotid_witnessRequired
		? await getMembershipWitness(
				"ReceiptShield",
				POs_newpodotid_currentCommitment.integer
		  )
		: {
				index: 0,
				path: POs_newpodotid_emptyPath,
				root: (await getRoot("ReceiptShield")) || 0,
		  };
	const POs_newpodotid_index = generalise(POs_newpodotid_witness.index);
	const POs_newpodotid_root = generalise(POs_newpodotid_witness.root);
	const POs_newpodotid_path = generalise(POs_newpodotid_witness.path).all;

	let POs_newpodotid = generalise(POs_newpodotid_preimage.value);

	POs_newpodotid.count = parseInt(newpo.count.integer, 10);

	POs_newpodotid = generalise(POs_newpodotid);

	POs_newpodotid.ppunit = parseInt(newpo.ppunit.integer, 10);

	POs_newpodotid = generalise(POs_newpodotid);

	POs_newpodotid.id = parseInt(newpo.id.integer, 10);

	POs_newpodotid = generalise(POs_newpodotid);

	POs_newpodotid.owner = newpo.owner.integer;

	POs_newpodotid = generalise(POs_newpodotid);

	// Calculate nullifier(s):

	let POs_newpodotid_nullifier = POs_newpodotid_commitmentExists
		? poseidonHash([
				BigInt(POs_newpodotid_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(POs_newpodotid_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(POs_newpodotid_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(POs_newpodotid_prevSalt.hex(32)),
		  ]);

	POs_newpodotid_nullifier = generalise(POs_newpodotid_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	POs_newpodotid.count = POs_newpodotid.count
		? POs_newpodotid.count
		: POs_newpodotid_prev.count;
	POs_newpodotid.ppunit = POs_newpodotid.ppunit
		? POs_newpodotid.ppunit
		: POs_newpodotid_prev.ppunit;
	POs_newpodotid.id = POs_newpodotid.id
		? POs_newpodotid.id
		: POs_newpodotid_prev.id;
	POs_newpodotid.owner = POs_newpodotid.owner
		? POs_newpodotid.owner
		: POs_newpodotid_prev.owner;

	const POs_newpodotid_newSalt = generalise(utils.randomHex(32));

	let POs_newpodotid_newCommitment = poseidonHash([
		BigInt(POs_newpodotid_stateVarId),
		BigInt(POs_newpodotid.count.hex(32)),
		BigInt(POs_newpodotid.ppunit.hex(32)),
		BigInt(POs_newpodotid.id.hex(32)),
		BigInt(POs_newpodotid.owner.hex(32)),
		BigInt(POs_newpodotid_newOwnerPublicKey.hex(32)),
		BigInt(POs_newpodotid_newSalt.hex(32)),
	]);

	POs_newpodotid_newCommitment = generalise(
		POs_newpodotid_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		newpo.count.integer,
		newpo.ppunit.integer,
		newpo.id.integer,
		newpo.owner.integer,
		POs_newpodotid_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		POs_newpodotid_nullifier.integer,
		POs_newpodotid_prev.count.integer,
		POs_newpodotid_prev.ppunit.integer,
		POs_newpodotid_prev.id.integer,
		POs_newpodotid_prev.owner.integer,
		POs_newpodotid_prevSalt.integer,
		POs_newpodotid_commitmentExists ? 0 : 1,
		POs_newpodotid_root.integer,
		POs_newpodotid_index.integer,
		POs_newpodotid_path.integer,
		POs_newpodotid_newOwnerPublicKey.integer,
		POs_newpodotid_newSalt.integer,
		POs_newpodotid_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("addPO", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.addPO(
			[POs_newpodotid_nullifier.integer],
			POs_newpodotid_root.integer,
			[POs_newpodotid_newCommitment.integer],
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

	if (!preimage.POs) preimage.POs = {};

	if (!preimage.POs[POs_newpodotid_stateVarId_key.integer])
		preimage.POs[POs_newpodotid_stateVarId_key.integer] = {};

	preimage.POs[POs_newpodotid_stateVarId_key.integer] = {
		value: {
			count: POs_newpodotid.count.integer,
			ppunit: POs_newpodotid.ppunit.integer,
			id: POs_newpodotid.id.integer,
			owner: POs_newpodotid.owner.integer,
		},
		salt: POs_newpodotid_newSalt.integer,
		publicKey: POs_newpodotid_newOwnerPublicKey.integer,
		commitment: POs_newpodotid_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
