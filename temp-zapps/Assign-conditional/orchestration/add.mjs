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
	_value,
	_a_newOwnerPublicKey = 0,
	_result_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("AssignShield");

	const contractAddr = await getContractAddress("AssignShield");

	const msgValue = 0;
	const value = generalise(_value);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
	let result_newOwnerPublicKey = generalise(_result_newOwnerPublicKey);

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

	let b = generalise(await instance.methods.b().call());
	let b_init = b;

	let c = generalise(await instance.methods.c().call());
	let c_init = c;

	c = generalise(c_init);

	b = generalise(b_init);

	// Initialise commitment preimage of whole state:

	const result_stateVarId = generalise(9).hex(32);

	let result_commitmentExists = true;
	let result_witnessRequired = true;

	const result_commitment = await getCurrentWholeCommitment(result_stateVarId);

	let result_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!result_commitment) {
		result_commitmentExists = false;
		result_witnessRequired = false;
	} else {
		result_preimage = result_commitment.preimage;
	}

	// read preimage for incremented state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_stateVarId = generalise(3).hex(32);

	const a_newCommitmentValue = generalise(parseInt(value.integer, 10));

	// read preimage for whole state
	result_newOwnerPublicKey =
		_result_newOwnerPublicKey === 0 ? publicKey : result_newOwnerPublicKey;

	const result_currentCommitment = result_commitmentExists
		? generalise(result_commitment._id)
		: generalise(0);
	const result_prev = generalise(result_preimage.value);
	const result_prevSalt = generalise(result_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const result_emptyPath = new Array(32).fill(0);
	const result_witness = result_witnessRequired
		? await getMembershipWitness(
				"AssignShield",
				result_currentCommitment.integer
		  )
		: {
				index: 0,
				path: result_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const result_index = generalise(result_witness.index);
	const result_root = generalise(result_witness.root);
	const result_path = generalise(result_witness.path).all;

	// increment would go here but has been filtered out

	let result = generalise(
		parseInt(c.integer, 10) > parseInt(b.integer, 10)
			? parseInt(c.integer, 10)
			: parseInt(b.integer, 10)
	);

	result = generalise(result);

	// Calculate nullifier(s):

	let result_nullifier = result_commitmentExists
		? poseidonHash([
				BigInt(result_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(result_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(result_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(result_prevSalt.hex(32)),
		  ]);

	result_nullifier = generalise(result_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const result_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(result_nullifier);

	const result_nullifierRoot = generalise(
		result_nullifier_NonMembership_witness.root
	);
	const result_nullifier_path = generalise(
		result_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(result_nullifier);

	// Get the new updated nullifier Paths
	const result_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(result_nullifier);
	const result_nullifier_updatedpath = generalise(
		result_updated_nullifier_NonMembership_witness.path
	).all;
	const result_newNullifierRoot = generalise(
		result_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const a_newSalt = generalise(utils.randomHex(31));

	let a_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a_newCommitmentValue.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	const result_newSalt = generalise(utils.randomHex(31));

	let result_newCommitment = poseidonHash([
		BigInt(result_stateVarId),
		BigInt(result.hex(32)),
		BigInt(result_newOwnerPublicKey.hex(32)),
		BigInt(result_newSalt.hex(32)),
	]);

	result_newCommitment = generalise(result_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		c.integer,
		b.integer,
		a_newOwnerPublicKey.integer,
		a_newSalt.integer,
		a_newCommitment.integer,

		result_commitmentExists ? secretKey.integer : generalise(0).integer,
		result_nullifierRoot.integer,
		result_newNullifierRoot.integer,
		result_nullifier.integer,
		result_nullifier_path.integer,
		result_nullifier_updatedpath.integer,
		result_prev.integer,
		result_prevSalt.integer,
		result_commitmentExists ? 0 : 1,
		result_root.integer,
		result_index.integer,
		result_path.integer,
		result_newOwnerPublicKey.integer,
		result_newSalt.integer,
		result_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			result_nullifierRoot.integer,
			result_newNullifierRoot.integer,
			[result_nullifier.integer],
			result_root.integer,
			[a_newCommitment.integer, result_newCommitment.integer],
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
		hash: a_newCommitment,
		name: "a",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(a_stateVarId),
			value: a_newCommitmentValue,
			salt: a_newSalt,
			publicKey: a_newOwnerPublicKey,
		},
		secretKey:
			a_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	if (result_commitmentExists)
		await markNullified(result_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: result_newCommitment,
		name: "result",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(result_stateVarId),
			value: result,
			salt: result_newSalt,
			publicKey: result_newOwnerPublicKey,
		},
		secretKey:
			result_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
