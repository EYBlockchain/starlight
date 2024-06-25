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

export default async function assign(_value, _x_newOwnerPublicKey = 0) {
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
	let x_newOwnerPublicKey = generalise(_x_newOwnerPublicKey);

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

	const x_stateVarId = generalise(3).hex(32);

	let x_commitmentExists = true;
	let x_witnessRequired = true;

	const x_commitment = await getCurrentWholeCommitment(x_stateVarId);

	let x_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!x_commitment) {
		x_commitmentExists = false;
		x_witnessRequired = false;
	} else {
		x_preimage = x_commitment.preimage;
	}

	// read preimage for whole state
	x_newOwnerPublicKey =
		_x_newOwnerPublicKey === 0 ? publicKey : x_newOwnerPublicKey;

	const x_currentCommitment = x_commitmentExists
		? generalise(x_commitment._id)
		: generalise(0);
	const x_prev = generalise(x_preimage.value);
	const x_prevSalt = generalise(x_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const x_emptyPath = new Array(32).fill(0);
	const x_witness = x_witnessRequired
		? await getMembershipWitness("AssignShield", x_currentCommitment.integer)
		: {
				index: 0,
				path: x_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const x_index = generalise(x_witness.index);
	const x_root = generalise(x_witness.root);
	const x_path = generalise(x_witness.path).all;

	let y = generalise(parseInt(value.integer, 10) ** 2);

	let x = generalise(parseInt(y.integer, 10));

	x = generalise(x);

	// Calculate nullifier(s):

	let x_nullifier = x_commitmentExists
		? poseidonHash([
				BigInt(x_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(x_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(x_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(x_prevSalt.hex(32)),
		  ]);
	let x_nullifier = x_commitmentExists
		? poseidonHash([
				BigInt(x_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(x_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(x_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(x_prevSalt.hex(32)),
		  ]);

	x_nullifier = generalise(x_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const x_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		x_nullifier
	);

	const x_nullifierRoot = generalise(x_nullifier_NonMembership_witness.root);
	const x_nullifier_path = generalise(x_nullifier_NonMembership_witness.path)
		.all;

	await temporaryUpdateNullifier(x_nullifier);

	// Get the new updated nullifier Paths
	const x_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		x_nullifier
	);
	const x_nullifier_updatedpath = generalise(
		x_updated_nullifier_NonMembership_witness.path
	).all;
	const x_newNullifierRoot = generalise(
		x_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const x_newSalt = generalise(utils.randomHex(31));

	let x_newCommitment = poseidonHash([
		BigInt(x_stateVarId),
		BigInt(x.hex(32)),
		BigInt(x_newOwnerPublicKey.hex(32)),
		BigInt(x_newSalt.hex(32)),
	]);

	x_newCommitment = generalise(x_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		x_commitmentExists ? secretKey.integer : generalise(0).integer,
		x_commitmentExists ? secretKey.integer : generalise(0).integer,
		x_nullifierRoot.integer,
		x_newNullifierRoot.integer,
		x_newNullifierRoot.integer,
		x_nullifier.integer,
		x_nullifier_path.integer,
		x_nullifier_updatedpath.integer,
		x_prev.integer,
		x_prevSalt.integer,
		x_commitmentExists ? 0 : 1,
		x_root.integer,
		x_index.integer,
		x_path.integer,
		x_newOwnerPublicKey.integer,
		x_newSalt.integer,
		x_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("assign", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.assign(
			x_nullifierRoot.integer,
			x_newNullifierRoot.integer,
			[x_nullifier.integer],
			x_root.integer,
			[x_newCommitment.integer],
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

	if (x_commitmentExists)
		await markNullified(x_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	if (x_commitmentExists)
		await markNullified(x_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: x_newCommitment,
		name: "x",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(x_stateVarId),
			value: x,
			salt: x_newSalt,
			publicKey: x_newOwnerPublicKey,
		},
		secretKey:
			x_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		secretKey:
			x_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
