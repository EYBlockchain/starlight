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

export default async function add(_y_index_1_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");

	const contractAddr = await getContractAddress("AssignShield");

	const msgValue = 0;
	let y_index_1_newOwnerPublicKey = generalise(_y_index_1_newOwnerPublicKey);

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

	let index_1 = generalise(parseInt(index.integer, 10) + 1);

	index = generalise(index_1);

	index = generalise(index_init);

	// Initialise commitment preimage of whole state:

	let y_index_1_stateVarId = 6;

	const y_index_1_stateVarId_key = index_1;

	y_index_1_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(y_index_1_stateVarId).bigInt,
				y_index_1_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let y_index_1_commitmentExists = true;
	let y_index_1_witnessRequired = true;

	const y_index_1_commitment = await getCurrentWholeCommitment(
		y_index_1_stateVarId
	);

	let y_index_1_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!y_index_1_commitment) {
		y_index_1_commitmentExists = false;
		y_index_1_witnessRequired = false;
	} else {
		y_index_1_preimage = y_index_1_commitment.preimage;
	}

	// read preimage for whole state
	y_index_1_newOwnerPublicKey =
		_y_index_1_newOwnerPublicKey === 0
			? publicKey
			: y_index_1_newOwnerPublicKey;

	const y_index_1_currentCommitment = y_index_1_commitmentExists
		? generalise(y_index_1_commitment._id)
		: generalise(0);
	const y_index_1_prev = generalise(y_index_1_preimage.value);
	const y_index_1_prevSalt = generalise(y_index_1_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const y_index_1_emptyPath = new Array(32).fill(0);
	const y_index_1_witness = y_index_1_witnessRequired
		? await getMembershipWitness(
				"AssignShield",
				y_index_1_currentCommitment.integer
		  )
		: {
				index: 0,
				path: y_index_1_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const y_index_1_index = generalise(y_index_1_witness.index);
	const y_index_1_root = generalise(y_index_1_witness.root);
	const y_index_1_path = generalise(y_index_1_witness.path).all;

	let y_index_1 = generalise(y_index_1_preimage.value);
	y_index_1 = generalise(parseInt(y_index_1.integer, 10) + 1);

	y_index_1 = generalise(y_index_1);

	// Send transaction to the blockchain:

	const txData = await instance.methods.add().encodeABI();

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

	let y_index_1_nullifier = y_index_1_commitmentExists
		? poseidonHash([
				BigInt(y_index_1_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(y_index_1_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(y_index_1_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(y_index_1_prevSalt.hex(32)),
		  ]);

	y_index_1_nullifier = generalise(y_index_1_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const y_index_1_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		y_index_1_nullifier
	);

	const y_index_1_nullifierRoot = generalise(
		y_index_1_nullifier_NonMembership_witness.root
	);
	const y_index_1_nullifier_path = generalise(
		y_index_1_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(y_index_1_nullifier);

	// Get the new updated nullifier Paths
	const y_index_1_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		y_index_1_nullifier
	);
	const y_index_1_nullifier_updatedpath = generalise(
		y_index_1_updated_nullifier_NonMembership_witness.path
	).all;
	const y_index_1_newNullifierRoot = generalise(
		y_index_1_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const y_index_1_newSalt = generalise(utils.randomHex(31));

	let y_index_1_newCommitment = poseidonHash([
		BigInt(y_index_1_stateVarId),
		BigInt(y_index_1.hex(32)),
		BigInt(y_index_1_newOwnerPublicKey.hex(32)),
		BigInt(y_index_1_newSalt.hex(32)),
	]);

	y_index_1_newCommitment = generalise(y_index_1_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		index.integer,
		y_index_1_commitmentExists ? secretKey.integer : generalise(0).integer,
		y_index_1_nullifierRoot.integer,
		y_index_1_newNullifierRoot.integer,
		y_index_1_nullifier.integer,
		y_index_1_nullifier_path.integer,
		y_index_1_nullifier_updatedpath.integer,
		y_index_1_prev.integer,
		y_index_1_prevSalt.integer,
		y_index_1_commitmentExists ? 0 : 1,
		y_index_1_root.integer,
		y_index_1_index.integer,
		y_index_1_path.integer,
		y_index_1_newOwnerPublicKey.integer,
		y_index_1_newSalt.integer,
		y_index_1_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			y_index_1_nullifierRoot.integer,
			y_index_1_newNullifierRoot.integer,
			[y_index_1_nullifier.integer],
			y_index_1_root.integer,
			[y_index_1_newCommitment.integer],
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

	if (y_index_1_commitmentExists)
		await markNullified(y_index_1_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: y_index_1_newCommitment,
		name: "y",
		mappingKey: y_index_1_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(y_index_1_stateVarId),
			value: y_index_1,
			salt: y_index_1_newSalt,
			publicKey: y_index_1_newOwnerPublicKey,
		},
		secretKey:
			y_index_1_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
