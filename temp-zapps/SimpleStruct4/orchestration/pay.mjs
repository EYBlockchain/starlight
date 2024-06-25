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

export default async function pay(
	_id,
	_amount,
	_invoices_id_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");

	const contractAddr = await getContractAddress("ReceiptShield");

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	const id = generalise(_id);
	const amount = generalise(_amount);
	let invoices_id_newOwnerPublicKey = generalise(
		_invoices_id_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "ReceiptShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole accessed state:

	let POs_id_stateVarId = 6;

	const POs_id_stateVarId_key = id;

	POs_id_stateVarId = generalise(
		utils.mimcHash(
			[generalise(POs_id_stateVarId).bigInt, POs_id_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let POs_id_commitmentExists = true;

	const POs_id_commitment = await getCurrentWholeCommitment(POs_id_stateVarId);

	const POs_id_preimage = POs_id_commitment.preimage;

	const POs_id = generalise(POs_id_preimage.value);

	// Initialise commitment preimage of whole state:

	let invoices_id_stateVarId = 11;

	const invoices_id_stateVarId_key = id;

	invoices_id_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(invoices_id_stateVarId).bigInt,
				invoices_id_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let invoices_id_commitmentExists = true;
	let invoices_id_witnessRequired = true;

	const invoices_id_commitment = await getCurrentWholeCommitment(
		invoices_id_stateVarId
	);

	let invoices_id_preimage = {
		value: { amount: 0 },
		salt: 0,
		commitment: 0,
	};
	if (!invoices_id_commitment) {
		invoices_id_commitmentExists = false;
		invoices_id_witnessRequired = false;
	} else {
		invoices_id_preimage = invoices_id_commitment.preimage;
	}

	// read preimage for accessed state

	const POs_id_currentCommitment = generalise(POs_id_commitment._id);
	const POs_id_prev = generalise(POs_id_preimage.value);
	const POs_id_prevSalt = generalise(POs_id_preimage.salt);

	// read preimage for whole state
	invoices_id_newOwnerPublicKey =
		_invoices_id_newOwnerPublicKey === 0
			? publicKey
			: invoices_id_newOwnerPublicKey;

	const invoices_id_currentCommitment = invoices_id_commitmentExists
		? generalise(invoices_id_commitment._id)
		: generalise(0);
	const invoices_id_prev = generalise(invoices_id_preimage.value);
	const invoices_id_prevSalt = generalise(invoices_id_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole accessed state
	const POs_id_witness = await getMembershipWitness(
		"ReceiptShield",
		POs_id_currentCommitment.integer
	);
	const POs_id_index = generalise(POs_id_witness.index);
	const POs_id_root = generalise(POs_id_witness.root);
	const POs_id_path = generalise(POs_id_witness.path).all;

	// generate witness for whole state
	const invoices_id_emptyPath = new Array(32).fill(0);
	const invoices_id_witness = invoices_id_witnessRequired
		? await getMembershipWitness(
				"ReceiptShield",
				invoices_id_currentCommitment.integer
		  )
		: {
				index: 0,
				path: invoices_id_emptyPath,
				root: (await getRoot("ReceiptShield")) || 0,
		  };
	const invoices_id_index = generalise(invoices_id_witness.index);
	const invoices_id_root = generalise(invoices_id_witness.root);
	const invoices_id_path = generalise(invoices_id_witness.path).all;

	let invoices_id = generalise(invoices_id_preimage.value);

	invoices_id.amount = generalise(0);

	invoices_id = generalise(invoices_id);

	// Calculate nullifier(s):

	let POs_id_nullifier = POs_id_commitmentExists
		? poseidonHash([
				BigInt(POs_id_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(POs_id_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(POs_id_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(POs_id_prevSalt.hex(32)),
		  ]);

	POs_id_nullifier = generalise(POs_id_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const POs_id_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		POs_id_nullifier
	);

	const POs_id_nullifierRoot = generalise(
		POs_id_nullifier_NonMembership_witness.root
	);
	const POs_id_nullifier_path = generalise(
		POs_id_nullifier_NonMembership_witness.path
	).all;

	let invoices_id_nullifier = invoices_id_commitmentExists
		? poseidonHash([
				BigInt(invoices_id_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(invoices_id_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(invoices_id_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(invoices_id_prevSalt.hex(32)),
		  ]);

	invoices_id_nullifier = generalise(invoices_id_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const invoices_id_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		invoices_id_nullifier
	);

	const invoices_id_nullifierRoot = generalise(
		invoices_id_nullifier_NonMembership_witness.root
	);
	const invoices_id_nullifier_path = generalise(
		invoices_id_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(invoices_id_nullifier);

	// Get the new updated nullifier Paths
	const invoices_id_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		invoices_id_nullifier
	);
	const invoices_id_nullifier_updatedpath = generalise(
		invoices_id_updated_nullifier_NonMembership_witness.path
	).all;
	const invoices_id_newNullifierRoot = generalise(
		invoices_id_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	invoices_id.amount = invoices_id.amount
		? invoices_id.amount
		: invoices_id_prev.amount;
	invoices_id.id = invoices_id.id ? invoices_id.id : invoices_id_prev.id;

	const invoices_id_newSalt = generalise(utils.randomHex(31));

	let invoices_id_newCommitment = poseidonHash([
		BigInt(invoices_id_stateVarId),
		BigInt(invoices_id.amount.hex(32)),
		BigInt(invoices_id.id.hex(32)),
		BigInt(invoices_id_newOwnerPublicKey.hex(32)),
		BigInt(invoices_id_newSalt.hex(32)),
	]);

	invoices_id_newCommitment = generalise(invoices_id_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		id.integer,
		amount.integer,
		secretKey.integer,
		POs_id_nullifierRoot.integer,
		POs_id_nullifier_path.integer,
		POs_id_prev.count.integer,
		POs_id_prev.ppunit.integer,
		POs_id_prev.id.integer,
		POs_id_prev.owner.integer,
		POs_id_prevSalt.integer,
		POs_id_root.integer,
		POs_id_index.integer,
		POs_id_path.integer,

		invoices_id_commitmentExists ? secretKey.integer : generalise(0).integer,

		invoices_id_newNullifierRoot.integer,
		invoices_id_nullifier.integer,
		invoices_id_nullifier_path.integer,
		invoices_id_nullifier_updatedpath.integer,
		invoices_id_prev.amount.integer,
		invoices_id_prev.id.integer,
		invoices_id_prevSalt.integer,
		invoices_id_commitmentExists ? 0 : 1,

		invoices_id_index.integer,
		invoices_id_path.integer,
		invoices_id_newOwnerPublicKey.integer,
		invoices_id_newSalt.integer,
		invoices_id_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("pay", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.pay(
			invoices_id_nullifierRoot.integer,
			invoices_id_newNullifierRoot.integer,
			[invoices_id_nullifier.integer],
			POs_id_root.integer,
			[invoices_id_newCommitment.integer],
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

	if (invoices_id_commitmentExists)
		await markNullified(invoices_id_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: invoices_id_newCommitment,
		name: "invoices",
		mappingKey: invoices_id_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(invoices_id_stateVarId),
			value: { amount: invoices_id.amount, id: invoices_id.id },
			salt: invoices_id_newSalt,
			publicKey: invoices_id_newOwnerPublicKey,
		},
		secretKey:
			invoices_id_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
