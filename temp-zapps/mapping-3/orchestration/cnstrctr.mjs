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

export default async function cnstrctr(
	_admin_newOwnerPublicKey = 0,
	_adminstartor_newOwnerPublicKey = 0
) {
	const msgSender = generalise(config.web3.options.defaultAccount);
	let admin_newOwnerPublicKey = generalise(_admin_newOwnerPublicKey);
	let adminstartor_newOwnerPublicKey = generalise(
		_adminstartor_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "OwnerShield", false);
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

	// Initialise commitment preimage of whole state:

	const adminstartor_stateVarId = generalise(7).hex(32);

	let adminstartor_commitmentExists = true;
	let adminstartor_witnessRequired = true;

	let adminstartor_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).adminstartor ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).adminstartor
	) {
		adminstartor_commitmentExists = false;
		adminstartor_witnessRequired = false;
	} else {
		adminstartor_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).adminstartor;
	}

	// read preimage for whole state
	admin_newOwnerPublicKey =
		_admin_newOwnerPublicKey === 0 ? publicKey : admin_newOwnerPublicKey;

	const admin_currentCommitment = generalise(admin_preimage.commitment);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// read preimage for whole state
	adminstartor_newOwnerPublicKey =
		_adminstartor_newOwnerPublicKey === 0
			? publicKey
			: adminstartor_newOwnerPublicKey;

	const adminstartor_currentCommitment = generalise(
		adminstartor_preimage.commitment
	);
	const adminstartor_prev = generalise(adminstartor_preimage.value);
	const adminstartor_prevSalt = generalise(adminstartor_preimage.salt);

	// Extract set membership witness:

	const admin_index = generalise(0);
	const admin_root = generalise(0);
	const admin_path = generalise(new Array(32).fill(0)).all;

	const adminstartor_index = generalise(0);
	const adminstartor_root = generalise(0);
	const adminstartor_path = generalise(new Array(32).fill(0)).all;

	let admin = msgSender.integer;

	admin = generalise(admin);

	let adminstartor = msgSender.integer;

	adminstartor = generalise(adminstartor);

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
	let adminstartor_nullifier = adminstartor_commitmentExists
		? poseidonHash([
				BigInt(adminstartor_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(adminstartor_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(adminstartor_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(adminstartor_prevSalt.hex(32)),
		  ]);

	adminstartor_nullifier = generalise(adminstartor_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const admin_newSalt = generalise(utils.randomHex(32));

	let admin_newCommitment = poseidonHash([
		BigInt(admin_stateVarId),
		BigInt(admin.hex(32)),
		BigInt(admin_newOwnerPublicKey.hex(32)),
		BigInt(admin_newSalt.hex(32)),
	]);

	admin_newCommitment = generalise(admin_newCommitment.hex(32)); // truncate

	const adminstartor_newSalt = generalise(utils.randomHex(32));

	let adminstartor_newCommitment = poseidonHash([
		BigInt(adminstartor_stateVarId),
		BigInt(adminstartor.hex(32)),
		BigInt(adminstartor_newOwnerPublicKey.hex(32)),
		BigInt(adminstartor_newSalt.hex(32)),
	]);

	adminstartor_newCommitment = generalise(adminstartor_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		admin_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		admin_nullifier.integer,
		admin_prev.integer,
		admin_prevSalt.integer,
		admin_commitmentExists ? 0 : 1,
		admin_root.integer,
		admin_index.integer,
		admin_path.integer,
		admin_newOwnerPublicKey.integer,
		admin_newSalt.integer,
		admin_newCommitment.integer,

		adminstartor_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		adminstartor_nullifier.integer,
		adminstartor_prev.integer,
		adminstartor_prevSalt.integer,
		adminstartor_commitmentExists ? 0 : 1,

		adminstartor_index.integer,
		adminstartor_path.integer,
		adminstartor_newOwnerPublicKey.integer,
		adminstartor_newSalt.integer,
		adminstartor_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("cnstrctr", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Save transaction for the constructor:

	const tx = {
		proofInput: [
			[admin_nullifier.integer, adminstartor_nullifier.integer],
			admin_root.integer,
			[admin_newCommitment.integer, adminstartor_newCommitment.integer],
			proof,
		],
	};

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

	if (!preimage.adminstartor) preimage.adminstartor = {};

	preimage.adminstartor = {
		value: adminstartor.integer,
		salt: adminstartor_newSalt.integer,
		publicKey: adminstartor_newOwnerPublicKey.integer,
		commitment: adminstartor_newCommitment.integer,
	};

	fs.writeFileSync(
		"/app/orchestration/common/db/constructorTx.json",
		JSON.stringify(tx, null, 4)
	);
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	process.exit(0);
}
