/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import utils from "zkp-utils";
import GN from "general-number";
import fs from "fs";

import {
	getContractInstance,
	getContractAddress,
	registerKey,
} from "./common/contract.mjs";
import {
	storeCommitment,
	getCurrentWholeCommitment,
	getCommitmentsById,
	getAllCommitments,
	getInputCommitments,
	joinCommitments,
	splitCommitments,
	markNullified,
	getnullifierMembershipWitness,
	getupdatedNullifierPaths,
	temporaryUpdateNullifier,
	updateNullifierTree,
} from "./common/commitment-storage.mjs";
import { generateProof } from "./common/zokrates.mjs";
import { getMembershipWitness, getRoot } from "./common/timber.mjs";
import Web3 from "./common/web3.mjs";
import {
	decompressStarlightKey,
	poseidonHash,
} from "./common/number-theory.mjs";

const { generalise } = GN;
const db = "/app/orchestration/common/db/preimage.json";
const web3 = Web3.connection();
const keyDb = "/app/orchestration/common/db/key.json";

export default async function cnstrctr(
	_admin_newOwnerPublicKey = 0,
	_adminstartor_newOwnerPublicKey = 0
) {
	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	let admin_newOwnerPublicKey = generalise(_admin_newOwnerPublicKey);
	let adminstartor_newOwnerPublicKey = generalise(
		_adminstartor_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "OwnerShield", false);
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

	const admin_commitment = await getCurrentWholeCommitment(admin_stateVarId);

	let admin_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!admin_commitment) {
		admin_commitmentExists = false;
		admin_witnessRequired = false;
	} else {
		admin_preimage = admin_commitment.preimage;
	}

	// Initialise commitment preimage of whole state:

	const adminstartor_stateVarId = generalise(7).hex(32);

	let adminstartor_commitmentExists = true;
	let adminstartor_witnessRequired = true;

	const adminstartor_commitment = await getCurrentWholeCommitment(
		adminstartor_stateVarId
	);

	let adminstartor_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!adminstartor_commitment) {
		adminstartor_commitmentExists = false;
		adminstartor_witnessRequired = false;
	} else {
		adminstartor_preimage = adminstartor_commitment.preimage;
	}

	// read preimage for whole state
	admin_newOwnerPublicKey =
		_admin_newOwnerPublicKey === 0 ? publicKey : admin_newOwnerPublicKey;

	const admin_currentCommitment = admin_commitmentExists
		? generalise(admin_commitment._id)
		: generalise(0);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// read preimage for whole state
	adminstartor_newOwnerPublicKey =
		_adminstartor_newOwnerPublicKey === 0
			? publicKey
			: adminstartor_newOwnerPublicKey;

	const adminstartor_currentCommitment = adminstartor_commitmentExists
		? generalise(adminstartor_commitment._id)
		: generalise(0);
	const adminstartor_prev = generalise(adminstartor_preimage.value);
	const adminstartor_prevSalt = generalise(adminstartor_preimage.salt);

	// Extract set membership witness:

	const admin_index = generalise(0);
	const admin_root = generalise(0);
	const admin_path = generalise(new Array(32).fill(0)).all;

	const adminstartor_index = generalise(0);
	const adminstartor_root = generalise(0);
	const adminstartor_path = generalise(new Array(32).fill(0)).all;

	let admin = generalise(msgSender.integer);

	admin = generalise(admin);

	let adminstartor = generalise(msgSender.integer);

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
	// Non-membership witness for Nullifier
	const admin_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(admin_nullifier);

	const admin_nullifierRoot = generalise(
		admin_nullifier_NonMembership_witness.root
	);
	const admin_nullifier_path = generalise(
		admin_nullifier_NonMembership_witness.path
	).all;

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
	// Non-membership witness for Nullifier
	const adminstartor_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(adminstartor_nullifier);

	const adminstartor_nullifierRoot = generalise(
		adminstartor_nullifier_NonMembership_witness.root
	);
	const adminstartor_nullifier_path = generalise(
		adminstartor_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(admin_nullifier);

	await temporaryUpdateNullifier(adminstartor_nullifier);

	// Get the new updated nullifier Paths
	const admin_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(admin_nullifier);
	const admin_nullifier_updatedpath = generalise(
		admin_updated_nullifier_NonMembership_witness.path
	).all;
	const admin_newNullifierRoot = generalise(
		admin_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const adminstartor_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(adminstartor_nullifier);
	const adminstartor_nullifier_updatedpath = generalise(
		adminstartor_updated_nullifier_NonMembership_witness.path
	).all;
	const adminstartor_newNullifierRoot = generalise(
		adminstartor_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const admin_newSalt = generalise(utils.randomHex(31));

	let admin_newCommitment = poseidonHash([
		BigInt(admin_stateVarId),
		BigInt(admin.hex(32)),
		BigInt(admin_newOwnerPublicKey.hex(32)),
		BigInt(admin_newSalt.hex(32)),
	]);

	admin_newCommitment = generalise(admin_newCommitment.hex(32)); // truncate

	const adminstartor_newSalt = generalise(utils.randomHex(31));

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
		admin_commitmentExists ? secretKey.integer : generalise(0).integer,
		admin_nullifierRoot.integer,
		admin_newNullifierRoot.integer,
		admin_nullifier.integer,
		admin_nullifier_path.integer,
		admin_nullifier_updatedpath.integer,
		admin_prev.integer,
		admin_prevSalt.integer,
		admin_commitmentExists ? 0 : 1,
		admin_root.integer,
		admin_index.integer,
		admin_path.integer,
		admin_newOwnerPublicKey.integer,
		admin_newSalt.integer,
		admin_newCommitment.integer,
		adminstartor_commitmentExists ? secretKey.integer : generalise(0).integer,

		adminstartor_nullifier.integer,
		adminstartor_nullifier_path.integer,
		adminstartor_nullifier_updatedpath.integer,
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
			admin_nullifierRoot.integer,
			admin_newNullifierRoot.integer,
			[admin_nullifier.integer, adminstartor_nullifier.integer],
			admin_root.integer,
			[admin_newCommitment.integer, adminstartor_newCommitment.integer],
			proof,
		],
		nullifiers: [admin_nullifier.integer, adminstartor_nullifier.integer],
		isNullfiersAdded: false,
	};

	// Write new commitment preimage to db:

	if (admin_commitmentExists)
		await markNullified(admin_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: admin_newCommitment,
		name: "admin",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(admin_stateVarId),
			value: admin,
			salt: admin_newSalt,
			publicKey: admin_newOwnerPublicKey,
		},
		secretKey:
			admin_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	if (adminstartor_commitmentExists)
		await markNullified(adminstartor_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: adminstartor_newCommitment,
		name: "adminstartor",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(adminstartor_stateVarId),
			value: adminstartor,
			salt: adminstartor_newSalt,
			publicKey: adminstartor_newOwnerPublicKey,
		},
		secretKey:
			adminstartor_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	fs.writeFileSync(
		"/app/orchestration/common/db/constructorTx.json",
		JSON.stringify(tx, null, 4)
	);

	process.exit(0);
}
