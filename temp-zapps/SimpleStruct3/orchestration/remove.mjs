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
	_invalidrct,
	_total_msgSender_newOwnerPublicKey = 0,
	_cmt_newOwnerPublicKey = 0,
	_total_msgSender_0_oldCommitment = 0,
	_total_msgSender_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");

	const contractAddr = await getContractAddress("ReceiptShield");

	const msgValue = 0;
	const invalidrct = generalise(_invalidrct);
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

	// read preimage for decremented state

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

	let total_msgSender_preimage = await getCommitmentsById(
		total_msgSender_stateVarId
	);

	const total_msgSender_newCommitmentValue = generalise(
		parseInt(invalidrct.amount.integer, 10) +
			parseInt(invalidrct.tax.integer, 10)
	);
	// First check if required commitments exist or not

	let [
		total_msgSender_commitmentFlag,
		total_msgSender_0_oldCommitment,
		total_msgSender_1_oldCommitment,
	] = getInputCommitments(
		publicKey.hex(32),
		total_msgSender_newCommitmentValue.integer,
		total_msgSender_preimage
	);

	let total_msgSender_witness_0;

	let total_msgSender_witness_1;

	if (
		total_msgSender_1_oldCommitment === null &&
		total_msgSender_commitmentFlag
	) {
		total_msgSender_witness_0 = await getMembershipWitness(
			"ReceiptShield",
			generalise(total_msgSender_0_oldCommitment._id).integer
		);

		const tx = await splitCommitments(
			"ReceiptShield",
			"total",
			total_msgSender_newCommitmentValue,
			secretKey,
			publicKey,
			[5, total_msgSender_stateVarId_key],
			total_msgSender_0_oldCommitment,
			total_msgSender_witness_0,
			instance,
			contractAddr,
			web3
		);
		total_msgSender_preimage = await getCommitmentsById(
			total_msgSender_stateVarId
		);

		[
			total_msgSender_commitmentFlag,
			total_msgSender_0_oldCommitment,
			total_msgSender_1_oldCommitment,
		] = getInputCommitments(
			publicKey.hex(32),
			total_msgSender_newCommitmentValue.integer,
			total_msgSender_preimage
		);
	}

	while (total_msgSender_commitmentFlag === false) {
		total_msgSender_witness_0 = await getMembershipWitness(
			"ReceiptShield",
			generalise(total_msgSender_0_oldCommitment._id).integer
		);

		total_msgSender_witness_1 = await getMembershipWitness(
			"ReceiptShield",
			generalise(total_msgSender_1_oldCommitment._id).integer
		);

		const tx = await joinCommitments(
			"ReceiptShield",
			"total",
			secretKey,
			publicKey,
			[5, total_msgSender_stateVarId_key],
			[total_msgSender_0_oldCommitment, total_msgSender_1_oldCommitment],
			[total_msgSender_witness_0, total_msgSender_witness_1],
			instance,
			contractAddr,
			web3
		);

		total_msgSender_preimage = await getCommitmentsById(
			total_msgSender_stateVarId
		);

		[
			total_msgSender_commitmentFlag,
			total_msgSender_0_oldCommitment,
			total_msgSender_1_oldCommitment,
		] = getInputCommitments(
			publicKey.hex(32),
			total_msgSender_newCommitmentValue.integer,
			total_msgSender_preimage
		);
	}
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

	// read preimage for whole state
	cmt_newOwnerPublicKey =
		_cmt_newOwnerPublicKey === 0 ? publicKey : cmt_newOwnerPublicKey;

	const cmt_currentCommitment = cmt_commitmentExists
		? generalise(cmt_commitment._id)
		: generalise(0);
	const cmt_prev = generalise(cmt_preimage.value);
	const cmt_prevSalt = generalise(cmt_preimage.salt);

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
	cmt.amount = generalise(0);

	cmt = generalise(cmt);

	cmt.tax = generalise(0);

	cmt.tax = generalise(cmt.tax);

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
	const total_msgSender_0_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		total_msgSender_0_nullifier
	);
	const total_msgSender_1_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		total_msgSender_1_nullifier
	);

	const total_msgSender_nullifierRoot = generalise(
		total_msgSender_0_nullifier_NonMembership_witness.root
	);
	const total_msgSender_0_nullifier_path = generalise(
		total_msgSender_0_nullifier_NonMembership_witness.path
	).all;
	const total_msgSender_1_nullifier_path = generalise(
		total_msgSender_1_nullifier_NonMembership_witness.path
	).all;

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

	await temporaryUpdateNullifier(total_msgSender_0_nullifier);
	await temporaryUpdateNullifier(total_msgSender_1_nullifier);

	await temporaryUpdateNullifier(cmt_nullifier);

	// Get the new updated nullifier Paths
	const total_msgSender_0_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		total_msgSender_0_nullifier
	);
	const total_msgSender_1_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		total_msgSender_1_nullifier
	);

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

	const total_msgSender_2_newSalt = generalise(utils.randomHex(31));

	let total_msgSender_change =
		parseInt(total_msgSender_0_prev.integer, 10) +
		parseInt(total_msgSender_1_prev.integer, 10) -
		parseInt(total_msgSender_newCommitmentValue.integer, 10);

	total_msgSender_change = generalise(total_msgSender_change);

	let total_msgSender_2_newCommitment = poseidonHash([
		BigInt(total_msgSender_stateVarId),
		BigInt(total_msgSender_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(total_msgSender_2_newSalt.hex(32)),
	]);

	total_msgSender_2_newCommitment = generalise(
		total_msgSender_2_newCommitment.hex(32)
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
		invalidrct.amount.integer,
		invalidrct.tax.integer,
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
		total_msgSender_0_prev.integer,
		total_msgSender_0_prevSalt.integer,
		total_msgSender_1_prev.integer,
		total_msgSender_1_prevSalt.integer,
		total_msgSender_root.integer,
		total_msgSender_0_index.integer,
		total_msgSender_0_path.integer,
		total_msgSender_1_index.integer,
		total_msgSender_1_path.integer,
		total_msgSender_newOwnerPublicKey.integer,
		total_msgSender_2_newSalt.integer,
		total_msgSender_2_newCommitment.integer,

		cmt_commitmentExists ? secretKey.integer : generalise(0).integer,

		cmt_nullifier.integer,
		cmt_nullifier_path.integer,
		cmt_nullifier_updatedpath.integer,
		cmt_prev.amount.integer,
		cmt_prev.tax.integer,
		cmt_prevSalt.integer,
		cmt_commitmentExists ? 0 : 1,

		cmt_index.integer,
		cmt_path.integer,
		cmt_newOwnerPublicKey.integer,
		cmt_newSalt.integer,
		cmt_newCommitment.integer,
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
				cmt_nullifier.integer,
			],
			total_msgSender_root.integer,
			[total_msgSender_2_newCommitment.integer, cmt_newCommitment.integer],
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
			value: total_msgSender_change,
			salt: total_msgSender_2_newSalt,
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
