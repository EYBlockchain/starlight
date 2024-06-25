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

export default async function add(_j, _m, _k_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const instance = await getContractInstance("TestShield");

	const contractAddr = await getContractAddress("TestShield");

	const msgValue = 0;
	const j = generalise(_j);
	const m = generalise(_m);
	let k_newOwnerPublicKey = generalise(_k_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "TestShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	const k_stateVarId = generalise(5).hex(32);

	let k_commitmentExists = true;
	let k_witnessRequired = true;

	const k_commitment = await getCurrentWholeCommitment(k_stateVarId);

	let k_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!k_commitment) {
		k_commitmentExists = false;
		k_witnessRequired = false;
	} else {
		k_preimage = k_commitment.preimage;
	}

	// read preimage for whole state
	k_newOwnerPublicKey =
		_k_newOwnerPublicKey === 0 ? publicKey : k_newOwnerPublicKey;

	const k_currentCommitment = k_commitmentExists
		? generalise(k_commitment._id)
		: generalise(0);
	const k_prev = generalise(k_preimage.value);
	const k_prevSalt = generalise(k_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const k_emptyPath = new Array(32).fill(0);
	const k_witness = k_witnessRequired
		? await getMembershipWitness("TestShield", k_currentCommitment.integer)
		: { index: 0, path: k_emptyPath, root: (await getRoot("TestShield")) || 0 };
	const k_index = generalise(k_witness.index);
	const k_root = generalise(k_witness.root);
	const k_path = generalise(k_witness.path).all;

	let k = generalise(k_preimage.value);

	// non-secret line would go here but has been filtered out

	for (let i = 0; i < 5; i++) {
		k = generalise(parseInt(k.integer, 10) + parseInt(j.integer, 10));

		k = generalise(k);

		// non-secret line would go here but has been filtered out
	}

	k = generalise(k);

	// Send transaction to the blockchain:

	const txData = await instance.methods.add(j, m).encodeABI();

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

	const tx = await web3.eth.sendSignedTransaction(signed.rawTransaction);

	const encEvent = {};

	// Calculate nullifier(s):

	let k_nullifier = k_commitmentExists
		? poseidonHash([
				BigInt(k_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(k_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(k_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(k_prevSalt.hex(32)),
		  ]);

	k_nullifier = generalise(k_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const k_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		k_nullifier
	);

	const k_nullifierRoot = generalise(k_nullifier_NonMembership_witness.root);
	const k_nullifier_path = generalise(k_nullifier_NonMembership_witness.path)
		.all;

	await temporaryUpdateNullifier(k_nullifier);

	// Get the new updated nullifier Paths
	const k_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		k_nullifier
	);
	const k_nullifier_updatedpath = generalise(
		k_updated_nullifier_NonMembership_witness.path
	).all;
	const k_newNullifierRoot = generalise(
		k_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const k_newSalt = generalise(utils.randomHex(31));

	let k_newCommitment = poseidonHash([
		BigInt(k_stateVarId),
		BigInt(k.hex(32)),
		BigInt(k_newOwnerPublicKey.hex(32)),
		BigInt(k_newSalt.hex(32)),
	]);

	k_newCommitment = generalise(k_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		j.integer,
		k_commitmentExists ? secretKey.integer : generalise(0).integer,
		k_nullifierRoot.integer,
		k_newNullifierRoot.integer,
		k_nullifier.integer,
		k_nullifier_path.integer,
		k_nullifier_updatedpath.integer,
		k_prev.integer,
		k_prevSalt.integer,
		k_commitmentExists ? 0 : 1,
		k_root.integer,
		k_index.integer,
		k_path.integer,
		k_newOwnerPublicKey.integer,
		k_newSalt.integer,
		k_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			j.integer,
			m.integer,
			k_nullifierRoot.integer,
			k_newNullifierRoot.integer,
			[k_nullifier.integer],
			k_root.integer,
			[k_newCommitment.integer],
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

	if (k_commitmentExists)
		await markNullified(k_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: k_newCommitment,
		name: "k",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(k_stateVarId),
			value: k,
			salt: k_newSalt,
			publicKey: k_newOwnerPublicKey,
		},
		secretKey:
			k_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
