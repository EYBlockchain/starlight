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
	_myrct,
	_total_msgSender_newOwnerPublicKey = 0,
	_cmt_newOwnerPublicKey = 0
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

	// Initialise commitment preimage of whole state:

	const cmt_stateVarId = generalise(13).hex(32);

	let cmt_commitmentExists = true;
	let cmt_witnessRequired = true;

	const cmt_commitment = await getCurrentWholeCommitment(cmt_stateVarId);

	let cmt_preimage = {
		value: { amount: 0, tax: 0 },
		salt: 0,
		commitment: 0,
	};
	if (!cmt_commitment) {
		cmt_commitmentExists = false;
		cmt_witnessRequired = false;
	} else {
		cmt_preimage = cmt_commitment.preimage;
	}

	// read preimage for incremented state
	total_msgSender_newOwnerPublicKey =
		_total_msgSender_newOwnerPublicKey === 0
			? publicKey
			: total_msgSender_newOwnerPublicKey;

	let total_msgSender_stateVarId = 5;

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

	const total_msgSender_newCommitmentValue = generalise(
		parseInt(myrct.amount.integer, 10) + parseInt(myrct.tax.integer, 10)
	);

	// read preimage for whole state
	cmt_newOwnerPublicKey =
		_cmt_newOwnerPublicKey === 0 ? publicKey : cmt_newOwnerPublicKey;

	const cmt_currentCommitment = cmt_commitmentExists
		? generalise(cmt_commitment._id)
		: generalise(0);
	const cmt_prev = generalise(cmt_preimage.value);
	const cmt_prevSalt = generalise(cmt_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const cmt_emptyPath = new Array(32).fill(0);
	const cmt_witness = cmt_witnessRequired
		? await getMembershipWitness("ReceiptShield", cmt_currentCommitment.integer)
		: {
				index: 0,
				path: cmt_emptyPath,
				root: (await getRoot("ReceiptShield")) || 0,
		  };
	const cmt_index = generalise(cmt_witness.index);
	const cmt_root = generalise(cmt_witness.root);
	const cmt_path = generalise(cmt_witness.path).all;

	// increment would go here but has been filtered out

	let cmt = {};
	cmt.amount = generalise(parseInt(myrct.amount.integer, 10));

	cmt = generalise(cmt);

	cmt.tax = generalise(parseInt(myrct.tax.integer, 10));

	cmt.tax = generalise(cmt.tax);

	// Calculate nullifier(s):

	let cmt_nullifier = cmt_commitmentExists
		? poseidonHash([
				BigInt(cmt_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(cmt_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(cmt_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(cmt_prevSalt.hex(32)),
		  ]);

	cmt_nullifier = generalise(cmt_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const cmt_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		cmt_nullifier
	);

	const cmt_nullifierRoot = generalise(
		cmt_nullifier_NonMembership_witness.root
	);
	const cmt_nullifier_path = generalise(
		cmt_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(cmt_nullifier);

	// Get the new updated nullifier Paths
	const cmt_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		cmt_nullifier
	);
	const cmt_nullifier_updatedpath = generalise(
		cmt_updated_nullifier_NonMembership_witness.path
	).all;
	const cmt_newNullifierRoot = generalise(
		cmt_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const total_msgSender_newSalt = generalise(utils.randomHex(31));

	let total_msgSender_newCommitment = poseidonHash([
		BigInt(total_msgSender_stateVarId),
		BigInt(total_msgSender_newCommitmentValue.hex(32)),
		BigInt(total_msgSender_newOwnerPublicKey.hex(32)),
		BigInt(total_msgSender_newSalt.hex(32)),
	]);

	total_msgSender_newCommitment = generalise(
		total_msgSender_newCommitment.hex(32)
	); // truncate

	cmt.amount = cmt.amount ? cmt.amount : cmt_prev.amount;
	cmt.tax = cmt.tax ? cmt.tax : cmt_prev.tax;

	const cmt_newSalt = generalise(utils.randomHex(31));

	let cmt_newCommitment = poseidonHash([
		BigInt(cmt_stateVarId),
		BigInt(cmt.amount.hex(32)),
		BigInt(cmt.tax.hex(32)),
		BigInt(cmt_newOwnerPublicKey.hex(32)),
		BigInt(cmt_newSalt.hex(32)),
	]);

	cmt_newCommitment = generalise(cmt_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		myrct.amount.integer,
		myrct.tax.integer,
		total_msgSender_stateVarId_key.integer,
		total_msgSender_newOwnerPublicKey.integer,
		total_msgSender_newSalt.integer,
		total_msgSender_newCommitment.integer,

		cmt_commitmentExists ? secretKey.integer : generalise(0).integer,
		cmt_nullifierRoot.integer,
		cmt_newNullifierRoot.integer,
		cmt_nullifier.integer,
		cmt_nullifier_path.integer,
		cmt_nullifier_updatedpath.integer,
		cmt_prev.amount.integer,
		cmt_prev.tax.integer,
		cmt_prevSalt.integer,
		cmt_commitmentExists ? 0 : 1,
		cmt_root.integer,
		cmt_index.integer,
		cmt_path.integer,
		cmt_newOwnerPublicKey.integer,
		cmt_newSalt.integer,
		cmt_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			cmt_nullifierRoot.integer,
			cmt_newNullifierRoot.integer,
			[cmt_nullifier.integer],
			cmt_root.integer,
			[total_msgSender_newCommitment.integer, cmt_newCommitment.integer],
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
		hash: total_msgSender_newCommitment,
		name: "total",
		mappingKey: total_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(total_msgSender_stateVarId),
			value: total_msgSender_newCommitmentValue,
			salt: total_msgSender_newSalt,
			publicKey: total_msgSender_newOwnerPublicKey,
		},
		secretKey:
			total_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	if (cmt_commitmentExists)
		await markNullified(cmt_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: cmt_newCommitment,
		name: "cmt",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(cmt_stateVarId),
			value: { amount: cmt.amount, tax: cmt.tax },
			salt: cmt_newSalt,
			publicKey: cmt_newOwnerPublicKey,
		},
		secretKey:
			cmt_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
