/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import utils from "zkp-utils";
import GN from "general-number";
import fs from "fs";

import Contract from "./common/contract.mjs";
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
import web3Instance from "./common/web3.mjs";
import {
	decompressStarlightKey,
	poseidonHash,
} from "./common/number-theory.mjs";

const { generalise } = GN;
const db = "/app/orchestration/common/db/preimage.json";
const web3 = web3Instance.getConnection();
const keyDb = "/app/orchestration/common/db/key.json";

export default async function remove(
	_value,
	_value1,
	_b_newOwnerPublicKey = 0,
	_d_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const contract = new Contract("AssignShield");

	await contract.init();

	const instance = contract.getInstance();

	if (!instance) {
		throw new Error("Contract instance is not initialized");
	}

	const contractAddr = await contract.getContractAddress();

	const msgValue = 0;
	const value = generalise(_value);
	const value1 = generalise(_value1);
	let b_newOwnerPublicKey = generalise(_b_newOwnerPublicKey);
	let d_newOwnerPublicKey = generalise(_d_newOwnerPublicKey);

	// Initialize the contract

	const contract = new Contract("AssignShield");

	await contract.init();

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await contract.registerKey(utils.randomHex(31), "AssignShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole accessed state:

	const a_stateVarId = generalise(3).hex(32);

	let a_commitmentExists = true;

	const a_commitment = await getCurrentWholeCommitment(a_stateVarId);

	const a_preimage = a_commitment.preimage;

	const a = generalise(a_preimage.value);

	// Initialise commitment preimage of whole state:

	const b_stateVarId = generalise(7).hex(32);

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

	// Initialise commitment preimage of whole state:

	const d_stateVarId = generalise(5).hex(32);

	let d_commitmentExists = true;
	let d_witnessRequired = true;

	const d_commitment = await getCurrentWholeCommitment(d_stateVarId);

	let d_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!d_commitment) {
		d_commitmentExists = false;
		d_witnessRequired = false;
	} else {
		d_preimage = d_commitment.preimage;
	}

	// read preimage for accessed state

	const a_currentCommitment = generalise(a_commitment._id);
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

	// read preimage for whole state
	d_newOwnerPublicKey =
		_d_newOwnerPublicKey === 0 ? publicKey : d_newOwnerPublicKey;

	const d_currentCommitment = d_commitmentExists
		? generalise(d_commitment._id)
		: generalise(0);
	const d_prev = generalise(d_preimage.value);
	const d_prevSalt = generalise(d_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole accessed state
	const a_witness = await getMembershipWitness(
		"AssignShield",
		a_currentCommitment.integer
	);
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

	// generate witness for whole state
	const d_emptyPath = new Array(32).fill(0);
	const d_witness = d_witnessRequired
		? await getMembershipWitness("AssignShield", d_currentCommitment.integer)
		: {
				index: 0,
				path: d_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const d_index = generalise(d_witness.index);
	const d_root = generalise(d_witness.root);
	const d_path = generalise(d_witness.path).all;

	let b = generalise(b_preimage.value);
	b = generalise(
		parseInt(b.integer, 10) +
			parseInt(value.integer, 10) +
			parseInt(a.integer, 10)
	);

	b = generalise(b);

	// non-secret line would go here but has been filtered out

	let d;

	d = generalise(parseInt(a.integer, 10) + parseInt(value.integer, 10));

	d = generalise(d);

	d = generalise(parseInt(a.integer, 10) + parseInt(value1.integer, 10));

	d = generalise(d);

	b = generalise(
		parseInt(b.integer, 10) +
			parseInt(value.integer, 10) +
			parseInt(a.integer, 10)
	);

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
	const b_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		b_nullifier
	);

	const b_nullifierRoot = generalise(b_nullifier_NonMembership_witness.root);
	const b_nullifier_path = generalise(b_nullifier_NonMembership_witness.path)
		.all;

	let d_nullifier = d_commitmentExists
		? poseidonHash([
				BigInt(d_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(d_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(d_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(d_prevSalt.hex(32)),
		  ]);
	let d_nullifier = d_commitmentExists
		? poseidonHash([
				BigInt(d_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(d_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(d_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(d_prevSalt.hex(32)),
		  ]);

	d_nullifier = generalise(d_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const d_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		d_nullifier
	);

	const d_nullifierRoot = generalise(d_nullifier_NonMembership_witness.root);
	const d_nullifier_path = generalise(d_nullifier_NonMembership_witness.path)
		.all;

	await temporaryUpdateNullifier(b_nullifier);

	await temporaryUpdateNullifier(d_nullifier);

	// Get the new updated nullifier Paths
	const b_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		b_nullifier
	);
	const b_nullifier_updatedpath = generalise(
		b_updated_nullifier_NonMembership_witness.path
	).all;
	const b_newNullifierRoot = generalise(
		b_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const d_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		d_nullifier
	);
	const d_nullifier_updatedpath = generalise(
		d_updated_nullifier_NonMembership_witness.path
	).all;
	const d_newNullifierRoot = generalise(
		d_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const b_newSalt = generalise(utils.randomHex(31));

	let b_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b.hex(32)),
		BigInt(b_newOwnerPublicKey.hex(32)),
		BigInt(b_newSalt.hex(32)),
	]);

	b_newCommitment = generalise(b_newCommitment.hex(32)); // truncate

	const d_newSalt = generalise(utils.randomHex(31));

	let d_newCommitment = poseidonHash([
		BigInt(d_stateVarId),
		BigInt(d.hex(32)),
		BigInt(d_newOwnerPublicKey.hex(32)),
		BigInt(d_newSalt.hex(32)),
	]);

	d_newCommitment = generalise(d_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		value1.integer,
		secretKey.integer,
		secretKey.integer,
		a_nullifierRoot.integer,
		a_nullifier_path.integer,
		a_prev.integer,
		a_prevSalt.integer,
		a_root.integer,
		a_index.integer,
		a_path.integer,

		b_commitmentExists ? secretKey.integer : generalise(0).integer,
		b_commitmentExists ? secretKey.integer : generalise(0).integer,

		b_newNullifierRoot.integer,
		b_newNullifierRoot.integer,
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
		d_commitmentExists ? secretKey.integer : generalise(0).integer,
		d_commitmentExists ? secretKey.integer : generalise(0).integer,

		d_nullifier.integer,
		d_nullifier_path.integer,
		d_nullifier_updatedpath.integer,
		d_prev.integer,
		d_prevSalt.integer,
		d_commitmentExists ? 0 : 1,

		d_index.integer,
		d_path.integer,
		d_newOwnerPublicKey.integer,
		d_newSalt.integer,
		d_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("remove", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.remove(
			value.integer,
			value1.integer,
			b_nullifierRoot.integer,
			b_newNullifierRoot.integer,
			[b_nullifier.integer, d_nullifier.integer],
			a_root.integer,
			[b_newCommitment.integer, d_newCommitment.integer],
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

	if (b_commitmentExists)
		await markNullified(b_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	if (b_commitmentExists)
		await markNullified(b_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

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
		secretKey:
			b_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	if (d_commitmentExists)
		await markNullified(d_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	if (d_commitmentExists)
		await markNullified(d_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: d_newCommitment,
		name: "d",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(d_stateVarId),
			value: d,
			salt: d_newSalt,
			publicKey: d_newOwnerPublicKey,
		},
		secretKey:
			d_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		secretKey:
			d_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
