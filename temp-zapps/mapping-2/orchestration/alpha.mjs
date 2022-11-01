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

export default async function alpha(
	_gm_account_newOwnerPublicKey = 0,
	_admin12_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("OwnerShield");

	const msgSender = generalise(config.web3.options.defaultAccount);
	let gm_account_newOwnerPublicKey = generalise(_gm_account_newOwnerPublicKey);
	let admin12_newOwnerPublicKey = generalise(_admin12_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "OwnerShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	const gm_account_stateVarId = generalise(3).hex(32);

	let gm_account_commitmentExists = true;
	let gm_account_witnessRequired = true;

	let gm_account_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).gm_account ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).gm_account
	) {
		gm_account_commitmentExists = false;
		gm_account_witnessRequired = false;
	} else {
		gm_account_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).gm_account;
	}

	// Initialise commitment preimage of whole state:

	const admin12_stateVarId = generalise(5).hex(32);

	let admin12_commitmentExists = true;
	let admin12_witnessRequired = true;

	let admin12_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).admin12 ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).admin12
	) {
		admin12_commitmentExists = false;
		admin12_witnessRequired = false;
	} else {
		admin12_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).admin12;
	}

	// Initialise commitment preimage of whole accessed state:

	const admin_stateVarId = generalise(7).hex(32);

	let admin_commitmentExists = true;

	const admin_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).admin;

	const admin = generalise(admin_preimage.value);

	// Initialise commitment preimage of whole accessed state:

	const gamer_stateVarId = generalise(9).hex(32);

	let gamer_commitmentExists = true;

	const gamer_preimage = JSON.parse(
		fs.readFileSync(db, "utf-8", (err) => {
			console.log(err);
		})
	).gamer;

	const gamer = generalise(gamer_preimage.value);

	// read preimage for whole state
	gm_account_newOwnerPublicKey =
		_gm_account_newOwnerPublicKey === 0
			? publicKey
			: gm_account_newOwnerPublicKey;

	const gm_account_currentCommitment = generalise(
		gm_account_preimage.commitment
	);
	const gm_account_prev = generalise(gm_account_preimage.value);
	const gm_account_prevSalt = generalise(gm_account_preimage.salt);

	// read preimage for whole state
	admin12_newOwnerPublicKey =
		_admin12_newOwnerPublicKey === 0 ? publicKey : admin12_newOwnerPublicKey;

	const admin12_currentCommitment = generalise(admin12_preimage.commitment);
	const admin12_prev = generalise(admin12_preimage.value);
	const admin12_prevSalt = generalise(admin12_preimage.salt);

	// read preimage for accessed state

	const admin_currentCommitment = generalise(admin_preimage.commitment);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// read preimage for accessed state

	const gamer_currentCommitment = generalise(gamer_preimage.commitment);
	const gamer_prev = generalise(gamer_preimage.value);
	const gamer_prevSalt = generalise(gamer_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const gm_account_emptyPath = new Array(32).fill(0);
	const gm_account_witness = gm_account_witnessRequired
		? await getMembershipWitness(
				"OwnerShield",
				gm_account_currentCommitment.integer
		  )
		: {
				index: 0,
				path: gm_account_emptyPath,
				root: (await getRoot("OwnerShield")) || 0,
		  };
	const gm_account_index = generalise(gm_account_witness.index);
	const gm_account_root = generalise(gm_account_witness.root);
	const gm_account_path = generalise(gm_account_witness.path).all;

	// generate witness for whole state
	const admin12_emptyPath = new Array(32).fill(0);
	const admin12_witness = admin12_witnessRequired
		? await getMembershipWitness(
				"OwnerShield",
				admin12_currentCommitment.integer
		  )
		: {
				index: 0,
				path: admin12_emptyPath,
				root: (await getRoot("OwnerShield")) || 0,
		  };
	const admin12_index = generalise(admin12_witness.index);
	const admin12_root = generalise(admin12_witness.root);
	const admin12_path = generalise(admin12_witness.path).all;

	// generate witness for whole accessed state
	const admin_witness = await getMembershipWitness(
		"OwnerShield",
		admin_currentCommitment.integer
	);
	const admin_index = generalise(admin_witness.index);
	const admin_root = generalise(admin_witness.root);
	const admin_path = generalise(admin_witness.path).all;

	// generate witness for whole accessed state
	const gamer_witness = await getMembershipWitness(
		"OwnerShield",
		gamer_currentCommitment.integer
	);
	const gamer_index = generalise(gamer_witness.index);
	const gamer_root = generalise(gamer_witness.root);
	const gamer_path = generalise(gamer_witness.path).all;

	let gm_account = generalise(gm_account_preimage.value);
	gm_account = parseInt(gm_account.integer, 10) + 3;

	gm_account = generalise(gm_account);

	let admin12 = 3;

	admin12 = generalise(admin12);

	admin12 = parseInt(admin12.integer, 10) + 1;

	admin12 = generalise(admin12);

	// Calculate nullifier(s):

	let gm_account_nullifier = gm_account_commitmentExists
		? poseidonHash([
				BigInt(gm_account_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(gm_account_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(gm_account_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(gm_account_prevSalt.hex(32)),
		  ]);

	gm_account_nullifier = generalise(gm_account_nullifier.hex(32)); // truncate
	let admin12_nullifier = admin12_commitmentExists
		? poseidonHash([
				BigInt(admin12_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(admin12_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(admin12_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(admin12_prevSalt.hex(32)),
		  ]);

	admin12_nullifier = generalise(admin12_nullifier.hex(32)); // truncate
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
	let gamer_nullifier = gamer_commitmentExists
		? poseidonHash([
				BigInt(gamer_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(gamer_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(gamer_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(gamer_prevSalt.hex(32)),
		  ]);

	gamer_nullifier = generalise(gamer_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const gm_account_newSalt = generalise(utils.randomHex(32));

	let gm_account_newCommitment = poseidonHash([
		BigInt(gm_account_stateVarId),
		BigInt(gm_account.hex(32)),
		BigInt(gm_account_newOwnerPublicKey.hex(32)),
		BigInt(gm_account_newSalt.hex(32)),
	]);

	gm_account_newCommitment = generalise(gm_account_newCommitment.hex(32)); // truncate

	const admin12_newSalt = generalise(utils.randomHex(32));

	let admin12_newCommitment = poseidonHash([
		BigInt(admin12_stateVarId),
		BigInt(admin12.hex(32)),
		BigInt(admin12_newOwnerPublicKey.hex(32)),
		BigInt(admin12_newSalt.hex(32)),
	]);

	admin12_newCommitment = generalise(admin12_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		gm_account_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		gm_account_nullifier.integer,
		gm_account_prev.integer,
		gm_account_prevSalt.integer,
		gm_account_commitmentExists ? 0 : 1,
		gm_account_root.integer,
		gm_account_index.integer,
		gm_account_path.integer,
		gm_account_newOwnerPublicKey.integer,
		gm_account_newSalt.integer,
		gm_account_newCommitment.integer,

		admin12_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		admin12_nullifier.integer,
		admin12_prev.integer,
		admin12_prevSalt.integer,
		admin12_commitmentExists ? 0 : 1,

		admin12_index.integer,
		admin12_path.integer,
		admin12_newOwnerPublicKey.integer,
		admin12_newSalt.integer,
		admin12_newCommitment.integer,

		secretKey.limbs(32, 8),
		admin_nullifier.integer,
		admin_prev.integer,
		admin_prevSalt.integer,

		admin_index.integer,
		admin_path.integer,

		secretKey.limbs(32, 8),
		gamer_nullifier.integer,
		gamer_prev.integer,
		gamer_prevSalt.integer,

		gamer_index.integer,
		gamer_path.integer,
	].flat(Infinity);
	const res = await generateProof("alpha", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.alpha(
			[gm_account_nullifier.integer, admin12_nullifier.integer],
			gm_account_root.integer,
			[gm_account_newCommitment.integer, admin12_newCommitment.integer],
			[admin_nullifier.integer, gamer_nullifier.integer],
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

	if (!preimage.gm_account) preimage.gm_account = {};

	preimage.gm_account = {
		value: gm_account.integer,
		salt: gm_account_newSalt.integer,
		publicKey: gm_account_newOwnerPublicKey.integer,
		commitment: gm_account_newCommitment.integer,
	};

	if (!preimage.admin12) preimage.admin12 = {};

	preimage.admin12 = {
		value: admin12.integer,
		salt: admin12_newSalt.integer,
		publicKey: admin12_newOwnerPublicKey.integer,
		commitment: admin12_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
