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

export default async function add(
	_a_newOwnerPublicKey = 0,
	_b_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");

	const contractAddr = await getContractAddress("AssignShield");

	const msgValue = 0;
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
	let b_newOwnerPublicKey = generalise(_b_newOwnerPublicKey);

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

	let index = generalise(await instance.methods.index().call());
	let index_init = index;

	index = generalise(0);

	let index_1 = generalise(index);

	index = generalise(10);

	let index_2 = generalise(index);

	index = generalise(index_init);

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

	// Initialise commitment preimage of whole state:

	const b_stateVarId = generalise(5).hex(32);

	let b_commitmentExists = true;
	let b_witnessRequired = true;

	const b_commitment = await getCurrentWholeCommitment(b_stateVarId);

	let b_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!b_commitment) {
		b_commitmentExists = false;
		b_witnessRequired = false;
	} else {
		b_preimage = b_commitment.preimage;
	}

	// read preimage for whole state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_currentCommitment = a_commitmentExists
		? generalise(a_commitment._id)
		: generalise(0);
	const a_prev = generalise(a_preimage.value);
	const a_prevSalt = generalise(a_preimage.salt);

	// read preimage for whole state
	b_newOwnerPublicKey =
		_b_newOwnerPublicKey === 0 ? publicKey : b_newOwnerPublicKey;

	const b_currentCommitment = b_commitmentExists
		? generalise(b_commitment._id)
		: generalise(0);
	const b_prev = generalise(b_preimage.value);
	const b_prevSalt = generalise(b_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const a_emptyPath = new Array(32).fill(0);
	const a_witness = a_witnessRequired
		? await getMembershipWitness("AssignShield", a_currentCommitment.integer)
		: {
				index: 0,
				path: a_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const a_index = generalise(a_witness.index);
	const a_root = generalise(a_witness.root);
	const a_path = generalise(a_witness.path).all;

	// generate witness for whole state
	const b_emptyPath = new Array(32).fill(0);
	const b_witness = b_witnessRequired
		? await getMembershipWitness("AssignShield", b_currentCommitment.integer)
		: {
				index: 0,
				path: b_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const b_index = generalise(b_witness.index);
	const b_root = generalise(b_witness.root);
	const b_path = generalise(b_witness.path).all;

	let a = generalise(parseInt(index_1.integer, 10));

	a = generalise(a);

	let b = generalise(parseInt(index_2.integer, 10));

	b = generalise(b);

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

	let b_nullifier = b_commitmentExists
		? poseidonHash([
				BigInt(b_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(b_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(b_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(b_prevSalt.hex(32)),
		  ]);

	b_nullifier = generalise(b_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const b_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(b_nullifier);

	const b_nullifierRoot = generalise(b_nullifier_NonMembership_witness.root);
	const b_nullifier_path = generalise(
		b_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(a_nullifier);

	await temporaryUpdateNullifier(b_nullifier);

	// Get the new updated nullifier Paths
	const a_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(a_nullifier);
	const a_nullifier_updatedpath = generalise(
		a_updated_nullifier_NonMembership_witness.path
	).all;
	const a_newNullifierRoot = generalise(
		a_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const b_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(b_nullifier);
	const b_nullifier_updatedpath = generalise(
		b_updated_nullifier_NonMembership_witness.path
	).all;
	const b_newNullifierRoot = generalise(
		b_updated_nullifier_NonMembership_witness.root
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

	const b_newSalt = generalise(utils.randomHex(31));

	let b_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b.hex(32)),
		BigInt(b_newOwnerPublicKey.hex(32)),
		BigInt(b_newSalt.hex(32)),
	]);

	b_newCommitment = generalise(b_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		index.integer,
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
		b_commitmentExists ? secretKey.integer : generalise(0).integer,

		b_nullifier.integer,
		b_nullifier_path.integer,
		b_nullifier_updatedpath.integer,
		b_prev.integer,
		b_prevSalt.integer,
		b_commitmentExists ? 0 : 1,

		b_index.integer,
		b_path.integer,
		b_newOwnerPublicKey.integer,
		b_newSalt.integer,
		b_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			a_nullifierRoot.integer,
			a_newNullifierRoot.integer,
			[a_nullifier.integer, b_nullifier.integer],
			a_root.integer,
			[a_newCommitment.integer, b_newCommitment.integer],
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

	if (b_commitmentExists)
		await markNullified(b_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: b_newCommitment,
		name: "b",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(b_stateVarId),
			value: b,
			salt: b_newSalt,
			publicKey: b_newOwnerPublicKey,
		},
		secretKey:
			b_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
