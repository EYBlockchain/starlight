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

export default async function setAdmin(
	_newAdmin,
	_admin_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");

	const msgSender = generalise(config.web3.options.defaultAccount);
	const newAdmin = generalise(_newAdmin);
	let admin_newOwnerPublicKey = generalise(_admin_newOwnerPublicKey);

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

	const admin_stateVarId = generalise(5).hex(32);

	let admin_commitmentExists = true;
	let admin_witnessRequired = true;

	let admin_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).admin ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).admin
	) {
		admin_commitmentExists = false;
		admin_witnessRequired = false;
	} else {
		admin_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).admin;
	}

	// read preimage for whole state
	admin_newOwnerPublicKey =
		_admin_newOwnerPublicKey === 0 ? publicKey : admin_newOwnerPublicKey;

	const admin_currentCommitment = generalise(admin_preimage.commitment);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const admin_emptyPath = new Array(32).fill(0);
	const admin_witness = admin_witnessRequired
		? await getMembershipWitness(
				"MyContractShield",
				admin_currentCommitment.integer
		  )
		: {
				index: 0,
				path: admin_emptyPath,
				root: (await getRoot("MyContractShield")) || 0,
		  };
	const admin_index = generalise(admin_witness.index);
	const admin_root = generalise(admin_witness.root);
	const admin_path = generalise(admin_witness.path).all;

	let admin = generalise(admin_preimage.value);

	admin = newAdmin.integer;

	admin = generalise(admin);

	// Calculate nullifier(s):

	let admin_nullifier = admin_commitmentExists
		? poseidonHash([
				BigInt(admin_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(admin_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(admin_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(admin_prevSalt.hex(32)),
		  ]);

	admin_nullifier = generalise(admin_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const admin_newSalt = generalise(utils.randomHex(32));

	let admin_newCommitment = poseidonHash([
		BigInt(admin_stateVarId),
		BigInt(admin.hex(32)),
		BigInt(admin_newOwnerPublicKey.hex(32)),
		BigInt(admin_newSalt.hex(32)),
	]);

	admin_newCommitment = generalise(admin_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		newAdmin.integer,
		admin_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		admin_nullifier.integer,
		admin_prev.integer,
		admin_prevSalt.integer,

		admin_root.integer,
		admin_index.integer,
		admin_path.integer,
		admin_newOwnerPublicKey.integer,
		admin_newSalt.integer,
		admin_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("setAdmin", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.setAdmin(
			[admin_nullifier.integer],
			admin_root.integer,
			[admin_newCommitment.integer],
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

	if (!preimage.admin) preimage.admin = {};

	preimage.admin = {
		value: admin.integer,
		salt: admin_newSalt.integer,
		publicKey: admin_newOwnerPublicKey.integer,
		commitment: admin_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
