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
	_a_newOwnerPublicKey = 0
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
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);

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

	// read preimage for incremented state
	b_newOwnerPublicKey =
		_b_newOwnerPublicKey === 0 ? publicKey : b_newOwnerPublicKey;

	const b_stateVarId = generalise(5).hex(32);

	const b_newCommitmentValue = generalise(parseInt(value.integer, 10));

	// read preimage for whole state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_currentCommitment = a_commitmentExists
		? generalise(a_commitment._id)
		: generalise(0);
	const a_prev = generalise(a_preimage.value);
	const a_prevSalt = generalise(a_preimage.salt);

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

	// increment would go here but has been filtered out

	// non-secret line would go here but has been filtered out

	let a = generalise(a_preimage.value);

	a = generalise(parseInt(a.integer, 10) + parseInt(value.integer, 10));

	a = generalise(a);

	a = generalise(parseInt(a.integer, 10) + parseInt(value1.integer, 10));

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

	const b_newSalt = generalise(utils.randomHex(31));

	let b_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b_newCommitmentValue.hex(32)),
		BigInt(b_newOwnerPublicKey.hex(32)),
		BigInt(b_newSalt.hex(32)),
	]);

	b_newCommitment = generalise(b_newCommitment.hex(32)); // truncate

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
		value.integer,
		value1.integer,
		b_newOwnerPublicKey.integer,
		b_newSalt.integer,
		b_newCommitment.integer,

		a_commitmentExists ? secretKey.integer : generalise(0).integer,
		a_commitmentExists ? secretKey.integer : generalise(0).integer,
		a_nullifierRoot.integer,
		a_newNullifierRoot.integer,
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
	const res = await generateProof("remove", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.remove(
			value.integer,
			value1.integer,
			a_nullifierRoot.integer,
			a_newNullifierRoot.integer,
			[a_nullifier.integer],
			a_root.integer,
			[b_newCommitment.integer, a_newCommitment.integer],
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

	await storeCommitment({
		hash: b_newCommitment,
		name: "b",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(b_stateVarId),
			value: b_newCommitmentValue,
			salt: b_newSalt,
			publicKey: b_newOwnerPublicKey,
		},
		secretKey:
			b_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		secretKey:
			b_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	if (a_commitmentExists)
		await markNullified(a_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

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
		secretKey:
			a_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
