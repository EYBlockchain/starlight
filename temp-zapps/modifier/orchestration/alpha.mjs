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

export default async function alpha(_a_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const instance = await getContractInstance("OwnerShield");

	const contractAddr = await getContractAddress("OwnerShield");

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);

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

	const a_stateVarId = generalise(3).hex(32);

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

	// Initialise commitment preimage of whole accessed state:

	const admin_stateVarId = generalise(5).hex(32);

	let admin_commitmentExists = true;

	const admin_commitment = await getCurrentWholeCommitment(admin_stateVarId);

	const admin_preimage = admin_commitment.preimage;

	const admin = generalise(admin_preimage.value);

	// Initialise commitment preimage of whole accessed state:

	const adminstartor_stateVarId = generalise(7).hex(32);

	let adminstartor_commitmentExists = true;

	const adminstartor_commitment = await getCurrentWholeCommitment(
		adminstartor_stateVarId
	);

	const adminstartor_preimage = adminstartor_commitment.preimage;

	const adminstartor = generalise(adminstartor_preimage.value);

	// read preimage for whole state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_currentCommitment = a_commitmentExists
		? generalise(a_commitment._id)
		: generalise(0);
	const a_prev = generalise(a_preimage.value);
	const a_prevSalt = generalise(a_preimage.salt);

	// read preimage for accessed state

	const admin_currentCommitment = generalise(admin_commitment._id);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// read preimage for accessed state

	const adminstartor_currentCommitment = generalise(
		adminstartor_commitment._id
	);
	const adminstartor_prev = generalise(adminstartor_preimage.value);
	const adminstartor_prevSalt = generalise(adminstartor_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const a_emptyPath = new Array(32).fill(0);
	const a_witness = a_witnessRequired
		? await getMembershipWitness("OwnerShield", a_currentCommitment.integer)
		: {
				index: 0,
				path: a_emptyPath,
				root: (await getRoot("OwnerShield")) || 0,
		  };
	const a_index = generalise(a_witness.index);
	const a_root = generalise(a_witness.root);
	const a_path = generalise(a_witness.path).all;

	// generate witness for whole accessed state
	const admin_witness = await getMembershipWitness(
		"OwnerShield",
		admin_currentCommitment.integer
	);
	const admin_index = generalise(admin_witness.index);
	const admin_root = generalise(admin_witness.root);
	const admin_path = generalise(admin_witness.path).all;

	// generate witness for whole accessed state
	const adminstartor_witness = await getMembershipWitness(
		"OwnerShield",
		adminstartor_currentCommitment.integer
	);
	const adminstartor_index = generalise(adminstartor_witness.index);
	const adminstartor_root = generalise(adminstartor_witness.root);
	const adminstartor_path = generalise(adminstartor_witness.path).all;

	let a = generalise(a_preimage.value);
	a = generalise(parseInt(a.integer, 10) + 3);

	a = generalise(a);

	a = generalise(parseInt(a.integer, 10) + 1);

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
	const a_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(a_nullifier);

	const a_nullifierRoot = generalise(a_nullifier_NonMembership_witness.root);
	const a_nullifier_path = generalise(
		a_nullifier_NonMembership_witness.path
	).all;

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

	await temporaryUpdateNullifier(a_nullifier);

	// Get the new updated nullifier Paths
	const a_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(a_nullifier);
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
		msgSender.integer,
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
		secretKey.integer,

		admin_nullifier_path.integer,
		admin_prev.integer,
		admin_prevSalt.integer,

		admin_index.integer,
		admin_path.integer,

		secretKey.integer,

		adminstartor_nullifier_path.integer,
		adminstartor_prev.integer,
		adminstartor_prevSalt.integer,

		adminstartor_index.integer,
		adminstartor_path.integer,
	].flat(Infinity);
	const res = await generateProof("alpha", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.alpha(
			a_nullifierRoot.integer,
			a_newNullifierRoot.integer,
			[a_nullifier.integer],
			a_root.integer,
			[a_newCommitment.integer],
			proof
		)
		.encodeABI();

	let txParams = {
		from: config.web3.options.defaultAccount,
		to: contractAddr,
		gas: config.web3.options.defaultGas,
		gasPrice: config.web3.options.defaultGasPrice,
		data: txData,
		chainId: await web3.eth.net.getId(),
	};

	const key = config.web3.key;

	const signed = await web3.eth.accounts.signTransaction(txParams, key);

	const sendTxn = await web3.eth.sendSignedTransaction(signed.rawTransaction);

	let tx = await instance.getPastEvents("NewLeaves");

	tx = tx[0];

	if (!tx) {
		throw new Error(
			"Tx failed - the commitment was not accepted on-chain, or the contract is not deployed."
		);
	}

	let encEvent = "";

	try {
		encEvent = await instance.getPastEvents("EncryptedData");
	} catch (err) {
		console.log("No encrypted event");
	}

	// Write new commitment preimage to db:

	if (a_commitmentExists)
		await markNullified(a_currentCommitment, secretKey.hex(32));

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

	return { tx, encEvent };
}
