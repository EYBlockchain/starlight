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

export default async function cnstrctr(_admin_newOwnerPublicKey = 0) {
	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	let admin_newOwnerPublicKey = generalise(_admin_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "MyContractShield", false);
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

	// read preimage for whole state
	admin_newOwnerPublicKey =
		_admin_newOwnerPublicKey === 0 ? publicKey : admin_newOwnerPublicKey;

	const admin_currentCommitment = admin_commitmentExists
		? generalise(admin_commitment._id)
		: generalise(0);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// Extract set membership witness:

	const admin_index = generalise(0);
	const admin_root = generalise(0);
	const admin_path = generalise(new Array(32).fill(0)).all;

	let admin = generalise(msgSender.integer);

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
	// Non-membership witness for Nullifier
	const admin_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(admin_nullifier);

	const admin_nullifierRoot = generalise(
		admin_nullifier_NonMembership_witness.root
	);
	const admin_nullifier_path = generalise(
		admin_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(admin_nullifier);

	// Get the new updated nullifier Paths
	const admin_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(admin_nullifier);
	const admin_nullifier_updatedpath = generalise(
		admin_updated_nullifier_NonMembership_witness.path
	).all;
	const admin_newNullifierRoot = generalise(
		admin_updated_nullifier_NonMembership_witness.root
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
			[admin_nullifier.integer],
			admin_root.integer,
			[admin_newCommitment.integer],
			proof,
		],
		nullifiers: [admin_nullifier.integer],
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

	fs.writeFileSync(
		"/app/orchestration/common/db/constructorTx.json",
		JSON.stringify(tx, null, 4)
	);

	process.exit(0);
}
