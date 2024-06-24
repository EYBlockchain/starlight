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

export default async function cnstrctr(_initValue, _a_newOwnerPublicKey = 0) {
	const msgValue = 0;
	const initValue = generalise(_initValue);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "AssignShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	const a_stateVarId = generalise(4).hex(32);

	let a_commitmentExists = true;
	let a_witnessRequired = true;

	const a_commitment = await getCurrentWholeCommitment(a_stateVarId);

	let a_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!a_commitment) {
		a_commitmentExists = false;
		a_witnessRequired = false;
	} else {
		a_preimage = a_commitment.preimage;
	}

	// read preimage for whole state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_currentCommitment = a_commitmentExists
		? generalise(a_commitment._id)
		: generalise(0);
	const a_prev = generalise(a_preimage.value);
	const a_prevSalt = generalise(a_preimage.salt);

	// Extract set membership witness:

	const a_index = generalise(0);
	const a_root = generalise(0);
	const a_path = generalise(new Array(32).fill(0)).all;

	let a = generalise(1);

	a = generalise(parseInt(initValue.integer, 10));

	a = generalise(a);

	// Calculate nullifier(s):

	let a_nullifier = a_commitmentExists
		? poseidonHash([
				BigInt(a_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(a_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(a_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(a_prevSalt.hex(32)),
		  ]);

	a_nullifier = generalise(a_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const a_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		a_nullifier
	);

	const a_nullifierRoot = generalise(a_nullifier_NonMembership_witness.root);
	const a_nullifier_path = generalise(a_nullifier_NonMembership_witness.path)
		.all;

	await temporaryUpdateNullifier(a_nullifier);

	// Get the new updated nullifier Paths
	const a_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		a_nullifier
	);
	const a_nullifier_updatedpath = generalise(
		a_updated_nullifier_NonMembership_witness.path
	).all;
	const a_newNullifierRoot = generalise(
		a_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const a_newSalt = generalise(utils.randomHex(31));

	let a_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		initValue.integer,
		a_commitmentExists ? secretKey.integer : generalise(0).integer,
		a_nullifierRoot.integer,
		a_newNullifierRoot.integer,
		a_nullifier.integer,
		a_nullifier_path.integer,
		a_nullifier_updatedpath.integer,
		a_prev.integer,
		a_prevSalt.integer,
		a_commitmentExists ? 0 : 1,
		a_root.integer,
		a_index.integer,
		a_path.integer,
		a_newOwnerPublicKey.integer,
		a_newSalt.integer,
		a_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("cnstrctr", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Save transaction for the constructor:

	const tx = {
		proofInput: [
			a_nullifierRoot.integer,
			a_newNullifierRoot.integer,
			[a_nullifier.integer],
			a_root.integer,
			[a_newCommitment.integer],
			proof,
		],
		nullifiers: [a_nullifier.integer],
		isNullfiersAdded: false,
	};

	// Write new commitment preimage to db:

	if (a_commitmentExists)
		await markNullified(a_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: a_newCommitment,
		name: "a",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(a_stateVarId),
			value: a,
			salt: a_newSalt,
			publicKey: a_newOwnerPublicKey,
		},
		secretKey:
			a_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	fs.writeFileSync(
		"/app/orchestration/common/db/constructorTx.json",
		JSON.stringify(tx, null, 4)
	);

	process.exit(0);
}
