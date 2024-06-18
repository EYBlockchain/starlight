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

export default async function remove(
	_myrct,
	_total_msgSender_newOwnerPublicKey = 0,
	_cmt_newOwnerPublicKey = 0,
	_total_msgSender_0_oldCommitment = 0,
	_total_msgSender_1_oldCommitment = 0,
	_cmt_0_oldCommitment = 0,
	_cmt_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");

	const contractAddr = await getContractAddress("ReceiptShield");

	const msgValue = 0;
	const myrct = generalise(_myrct);
	let total_msgSender_newOwnerPublicKey = generalise(
		_total_msgSender_newOwnerPublicKey
	);
	let cmt_newOwnerPublicKey = generalise(_cmt_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "ReceiptShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for decremented state
	total_msgSender_newOwnerPublicKey =
		_total_msgSender_newOwnerPublicKey === 0
			? publicKey
			: total_msgSender_newOwnerPublicKey;

	let total_msgSender_stateVarId = 6;

	const total_msgSender_stateVarId_key = generalise(
		config.web3.options.defaultAccount
	); // emulates msg.sender

	total_msgSender_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(total_msgSender_stateVarId).bigInt,
				total_msgSender_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let total_msgSender_preimage = await getCommitmentsById(
		total_msgSender_stateVarId
	);

	const total_msgSender_newCommitmentValue = generalise([
		generalise(parseInt(myrct.amount.integer, 10)),
		generalise(parseInt(myrct.tax.integer, 10)),
	]).all;

	let [
		total_msgSender_commitmentFlag,
		total_msgSender_0_oldCommitment,
		total_msgSender_1_oldCommitment,
	] = getInputCommitments(
		publicKey.hex(32),
		total_msgSender_newCommitmentValue.integer,
		total_msgSender_preimage,
		true
	);

	let total_msgSender_witness_0;

	let total_msgSender_witness_1;

	const total_msgSender_0_prevSalt = generalise(
		total_msgSender_0_oldCommitment.preimage.salt
	);
	const total_msgSender_1_prevSalt = generalise(
		total_msgSender_1_oldCommitment.preimage.salt
	);
	const total_msgSender_0_prev = generalise(
		total_msgSender_0_oldCommitment.preimage.value
	);
	const total_msgSender_1_prev = generalise(
		total_msgSender_1_oldCommitment.preimage.value
	);

	// read preimage for decremented state
	cmt_newOwnerPublicKey =
		_cmt_newOwnerPublicKey === 0 ? publicKey : cmt_newOwnerPublicKey;

	const cmt_stateVarId = generalise(14).hex(32);

	let cmt_preimage = await getCommitmentsById(cmt_stateVarId);

	const cmt_newCommitmentValue = generalise([
		generalise(parseInt(myrct.amount.integer, 10)),
		generalise(parseInt(myrct.tax.integer, 10)),
	]).all;

	let [cmt_commitmentFlag, cmt_0_oldCommitment, cmt_1_oldCommitment] =
		getInputCommitments(
			publicKey.hex(32),
			cmt_newCommitmentValue.integer,
			cmt_preimage,
			true
		);

	let cmt_witness_0;

	let cmt_witness_1;

	const cmt_0_prevSalt = generalise(cmt_0_oldCommitment.preimage.salt);
	const cmt_1_prevSalt = generalise(cmt_1_oldCommitment.preimage.salt);
	const cmt_0_prev = generalise(cmt_0_oldCommitment.preimage.value);
	const cmt_1_prev = generalise(cmt_1_oldCommitment.preimage.value);

	// Extract set membership witness:

	// generate witness for partitioned state
	total_msgSender_witness_0 = await getMembershipWitness(
		"ReceiptShield",
		generalise(total_msgSender_0_oldCommitment._id).integer
	);
	total_msgSender_witness_1 = await getMembershipWitness(
		"ReceiptShield",
		generalise(total_msgSender_1_oldCommitment._id).integer
	);
	const total_msgSender_0_index = generalise(total_msgSender_witness_0.index);
	const total_msgSender_1_index = generalise(total_msgSender_witness_1.index);
	const total_msgSender_root = generalise(total_msgSender_witness_0.root);
	const total_msgSender_0_path = generalise(total_msgSender_witness_0.path).all;
	const total_msgSender_1_path = generalise(total_msgSender_witness_1.path).all;

	// generate witness for partitioned state
	cmt_witness_0 = await getMembershipWitness(
		"ReceiptShield",
		generalise(cmt_0_oldCommitment._id).integer
	);
	cmt_witness_1 = await getMembershipWitness(
		"ReceiptShield",
		generalise(cmt_1_oldCommitment._id).integer
	);
	const cmt_0_index = generalise(cmt_witness_0.index);
	const cmt_1_index = generalise(cmt_witness_1.index);
	const cmt_root = generalise(cmt_witness_0.root);
	const cmt_0_path = generalise(cmt_witness_0.path).all;
	const cmt_1_path = generalise(cmt_witness_1.path).all;

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let total_msgSender_0_nullifier = poseidonHash([
		BigInt(total_msgSender_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(total_msgSender_0_prevSalt.hex(32)),
	]);
	let total_msgSender_1_nullifier = poseidonHash([
		BigInt(total_msgSender_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(total_msgSender_1_prevSalt.hex(32)),
	]);
	total_msgSender_0_nullifier = generalise(total_msgSender_0_nullifier.hex(32)); // truncate
	total_msgSender_1_nullifier = generalise(total_msgSender_1_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const total_msgSender_0_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(total_msgSender_0_nullifier);
	const total_msgSender_1_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(total_msgSender_1_nullifier);

	const total_msgSender_nullifierRoot = generalise(
		total_msgSender_0_nullifier_NonMembership_witness.root
	);
	const total_msgSender_0_nullifier_path = generalise(
		total_msgSender_0_nullifier_NonMembership_witness.path
	).all;
	const total_msgSender_1_nullifier_path = generalise(
		total_msgSender_1_nullifier_NonMembership_witness.path
	).all;

	let cmt_0_nullifier = poseidonHash([
		BigInt(cmt_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(cmt_0_prevSalt.hex(32)),
	]);
	let cmt_1_nullifier = poseidonHash([
		BigInt(cmt_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(cmt_1_prevSalt.hex(32)),
	]);
	cmt_0_nullifier = generalise(cmt_0_nullifier.hex(32)); // truncate
	cmt_1_nullifier = generalise(cmt_1_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const cmt_0_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(cmt_0_nullifier);
	const cmt_1_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(cmt_1_nullifier);

	const cmt_nullifierRoot = generalise(
		cmt_0_nullifier_NonMembership_witness.root
	);
	const cmt_0_nullifier_path = generalise(
		cmt_0_nullifier_NonMembership_witness.path
	).all;
	const cmt_1_nullifier_path = generalise(
		cmt_1_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(total_msgSender_0_nullifier);
	await temporaryUpdateNullifier(total_msgSender_1_nullifier);

	await temporaryUpdateNullifier(cmt_0_nullifier);
	await temporaryUpdateNullifier(cmt_1_nullifier);

	// Get the new updated nullifier Paths
	const total_msgSender_0_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(total_msgSender_0_nullifier);
	const total_msgSender_1_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(total_msgSender_1_nullifier);

	const total_msgSender_newNullifierRoot = generalise(
		total_msgSender_0_updated_nullifier_NonMembership_witness.root
	);
	const total_msgSender_0_nullifier_updatedpath = generalise(
		total_msgSender_0_updated_nullifier_NonMembership_witness.path
	).all;
	const total_msgSender_1_nullifier_updatedpath = generalise(
		total_msgSender_1_updated_nullifier_NonMembership_witness.path
	).all;

	// Get the new updated nullifier Paths
	const cmt_0_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(cmt_0_nullifier);
	const cmt_1_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(cmt_1_nullifier);

	const cmt_newNullifierRoot = generalise(
		cmt_0_updated_nullifier_NonMembership_witness.root
	);
	const cmt_0_nullifier_updatedpath = generalise(
		cmt_0_updated_nullifier_NonMembership_witness.path
	).all;
	const cmt_1_nullifier_updatedpath = generalise(
		cmt_1_updated_nullifier_NonMembership_witness.path
	).all;

	// Calculate commitment(s):

	const total_msgSender_2_newSalt = generalise(utils.randomHex(31));

	let total_msgSender_change = [
		parseInt(total_msgSender_0_prev.amount.integer, 10) +
			parseInt(total_msgSender_1_prev.amount.integer, 10) -
			parseInt(total_msgSender_newCommitmentValue.integer[0], 10),
		parseInt(total_msgSender_0_prev.tax.integer, 10) +
			parseInt(total_msgSender_1_prev.tax.integer, 10) -
			parseInt(total_msgSender_newCommitmentValue.integer[1], 10),
	];

	total_msgSender_change = generalise(total_msgSender_change).all;

	let total_msgSender_2_newCommitment = poseidonHash([
		BigInt(total_msgSender_stateVarId),
		...total_msgSender_change.hex(32).map((v) => BigInt(v)),
		BigInt(publicKey.hex(32)),
		BigInt(total_msgSender_2_newSalt.hex(32)),
	]);

	total_msgSender_2_newCommitment = generalise(
		total_msgSender_2_newCommitment.hex(32)
	); // truncate

	const cmt_2_newSalt = generalise(utils.randomHex(31));

	let cmt_change = [
		parseInt(cmt_0_prev.amount.integer, 10) +
			parseInt(cmt_1_prev.amount.integer, 10) -
			parseInt(cmt_newCommitmentValue.integer[0], 10),
		parseInt(cmt_0_prev.tax.integer, 10) +
			parseInt(cmt_1_prev.tax.integer, 10) -
			parseInt(cmt_newCommitmentValue.integer[1], 10),
	];

	cmt_change = generalise(cmt_change).all;

	let cmt_2_newCommitment = poseidonHash([
		BigInt(cmt_stateVarId),
		...cmt_change.hex(32).map((v) => BigInt(v)),
		BigInt(publicKey.hex(32)),
		BigInt(cmt_2_newSalt.hex(32)),
	]);

	cmt_2_newCommitment = generalise(cmt_2_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		myrct.amount.integer,
		myrct.tax.integer,
		total_msgSender_stateVarId_key.integer,
		secretKey.integer,
		secretKey.integer,
		total_msgSender_nullifierRoot.integer,
		total_msgSender_newNullifierRoot.integer,
		total_msgSender_0_nullifier.integer,
		total_msgSender_0_nullifier_path.integer,
		total_msgSender_0_nullifier_updatedpath.integer,
		total_msgSender_1_nullifier.integer,
		total_msgSender_1_nullifier_path.integer,
		total_msgSender_1_nullifier_updatedpath.integer,
		total_msgSender_0_prev.amount.integer,
		total_msgSender_0_prev.tax.integer,
		total_msgSender_0_prevSalt.integer,
		total_msgSender_1_prev.amount.integer,
		total_msgSender_1_prev.tax.integer,
		total_msgSender_1_prevSalt.integer,
		total_msgSender_root.integer,
		total_msgSender_0_index.integer,
		total_msgSender_0_path.integer,
		total_msgSender_1_index.integer,
		total_msgSender_1_path.integer,
		total_msgSender_newOwnerPublicKey.integer,
		total_msgSender_2_newSalt.integer,
		total_msgSender_2_newCommitment.integer,

		secretKey.integer,
		secretKey.integer,

		cmt_0_nullifier.integer,
		cmt_0_nullifier_path.integer,
		cmt_0_nullifier_updatedpath.integer,
		cmt_1_nullifier.integer,
		cmt_1_nullifier_path.integer,
		cmt_1_nullifier_updatedpath.integer,
		cmt_0_prev.amount.integer,
		cmt_0_prev.tax.integer,
		cmt_0_prevSalt.integer,
		cmt_1_prev.amount.integer,
		cmt_1_prev.tax.integer,
		cmt_1_prevSalt.integer,

		cmt_0_index.integer,
		cmt_0_path.integer,
		cmt_1_index.integer,
		cmt_1_path.integer,
		cmt_newOwnerPublicKey.integer,
		cmt_2_newSalt.integer,
		cmt_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("remove", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.remove(
			total_msgSender_nullifierRoot.integer,
			total_msgSender_newNullifierRoot.integer,
			[
				total_msgSender_0_nullifier.integer,
				total_msgSender_1_nullifier.integer,
				cmt_0_nullifier.integer,
				cmt_1_nullifier.integer,
			],
			total_msgSender_root.integer,
			[total_msgSender_2_newCommitment.integer, cmt_2_newCommitment.integer],
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

	await markNullified(
		generalise(total_msgSender_0_oldCommitment._id),
		secretKey.hex(32)
	);

	await markNullified(
		generalise(total_msgSender_1_oldCommitment._id),
		secretKey.hex(32)
	);

	await storeCommitment({
		hash: total_msgSender_2_newCommitment,
		name: "total",
		mappingKey: total_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(total_msgSender_stateVarId),
			value: {
				amount: total_msgSender_change.integer[0],
				tax: total_msgSender_change.integer[1],
			},
			salt: total_msgSender_2_newSalt,
			publicKey: total_msgSender_newOwnerPublicKey,
		},
		secretKey:
			total_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	await markNullified(generalise(cmt_0_oldCommitment._id), secretKey.hex(32));

	await markNullified(generalise(cmt_1_oldCommitment._id), secretKey.hex(32));

	await storeCommitment({
		hash: cmt_2_newCommitment,
		name: "cmt",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(cmt_stateVarId),
			value: { amount: cmt_change.integer[0], tax: cmt_change.integer[1] },
			salt: cmt_2_newSalt,
			publicKey: cmt_newOwnerPublicKey,
		},
		secretKey:
			cmt_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
