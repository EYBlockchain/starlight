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

export default async function addInvoice(
	_inv,
	_invoices_invdotid_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("ReceiptShield");

	const contractAddr = await getContractAddress("ReceiptShield");

	const msgValue = 0;
	const inv = generalise(_inv);
	let invoices_invdotid_newOwnerPublicKey = generalise(
		_invoices_invdotid_newOwnerPublicKey
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

	let POs_invdotid_stateVarId = 6;

	const POs_invdotid_stateVarId_key = inv.id;

	POs_invdotid_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(POs_invdotid_stateVarId).bigInt,
				POs_invdotid_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let POs_invdotid_commitmentExists = true;

	const POs_invdotid_commitment = await getCurrentWholeCommitment(
		POs_invdotid_stateVarId
	);

	const POs_invdotid_preimage = POs_invdotid_commitment.preimage;

	const POs_invdotid = generalise(POs_invdotid_preimage.value);

	// Initialise commitment preimage of whole state:

	let invoices_invdotid_stateVarId = 11;

	const invoices_invdotid_stateVarId_key = inv.id;

	invoices_invdotid_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(invoices_invdotid_stateVarId).bigInt,
				invoices_invdotid_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let invoices_invdotid_commitmentExists = true;
	let invoices_invdotid_witnessRequired = true;

	const invoices_invdotid_commitment = await getCurrentWholeCommitment(
		invoices_invdotid_stateVarId
	);

	let invoices_invdotid_preimage = {
		value: { id: 0, amount: 0 },
		salt: 0,
		commitment: 0,
	};
	if (!invoices_invdotid_commitment) {
		invoices_invdotid_commitmentExists = false;
		invoices_invdotid_witnessRequired = false;
	} else {
		invoices_invdotid_preimage = invoices_invdotid_commitment.preimage;
	}

	// read preimage for accessed state

	const POs_invdotid_currentCommitment = generalise(
		POs_invdotid_commitment._id
	);
	const POs_invdotid_prev = generalise(POs_invdotid_preimage.value);
	const POs_invdotid_prevSalt = generalise(POs_invdotid_preimage.salt);

	// read preimage for whole state
	invoices_invdotid_newOwnerPublicKey =
		_invoices_invdotid_newOwnerPublicKey === 0
			? publicKey
			: invoices_invdotid_newOwnerPublicKey;

	const invoices_invdotid_currentCommitment = invoices_invdotid_commitmentExists
		? generalise(invoices_invdotid_commitment._id)
		: generalise(0);
	const invoices_invdotid_prev = generalise(invoices_invdotid_preimage.value);
	const invoices_invdotid_prevSalt = generalise(
		invoices_invdotid_preimage.salt
	);

	// Extract set membership witness:

	// generate witness for whole accessed state
	const POs_invdotid_witness = await getMembershipWitness(
		"ReceiptShield",
		POs_invdotid_currentCommitment.integer
	);
	const POs_invdotid_index = generalise(POs_invdotid_witness.index);
	const POs_invdotid_root = generalise(POs_invdotid_witness.root);
	const POs_invdotid_path = generalise(POs_invdotid_witness.path).all;

	// generate witness for whole state
	const invoices_invdotid_emptyPath = new Array(32).fill(0);
	const invoices_invdotid_witness = invoices_invdotid_witnessRequired
		? await getMembershipWitness(
				"ReceiptShield",
				invoices_invdotid_currentCommitment.integer
		  )
		: {
				index: 0,
				path: invoices_invdotid_emptyPath,
				root: (await getRoot("ReceiptShield")) || 0,
		  };
	const invoices_invdotid_index = generalise(invoices_invdotid_witness.index);
	const invoices_invdotid_root = generalise(invoices_invdotid_witness.root);
	const invoices_invdotid_path = generalise(invoices_invdotid_witness.path).all;

	let invoices_invdotid = generalise(invoices_invdotid_preimage.value);

	invoices_invdotid.amount = generalise(parseInt(inv.amount.integer, 10));

	invoices_invdotid = generalise(invoices_invdotid);

	invoices_invdotid.id = generalise(parseInt(inv.id.integer, 10));

	invoices_invdotid = generalise(invoices_invdotid);

	// Calculate nullifier(s):

	let POs_invdotid_nullifier = POs_invdotid_commitmentExists
		? poseidonHash([
				BigInt(POs_invdotid_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(POs_invdotid_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(POs_invdotid_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(POs_invdotid_prevSalt.hex(32)),
		  ]);

	POs_invdotid_nullifier = generalise(POs_invdotid_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const POs_invdotid_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		POs_invdotid_nullifier
	);

	const POs_invdotid_nullifierRoot = generalise(
		POs_invdotid_nullifier_NonMembership_witness.root
	);
	const POs_invdotid_nullifier_path = generalise(
		POs_invdotid_nullifier_NonMembership_witness.path
	).all;

	let invoices_invdotid_nullifier = invoices_invdotid_commitmentExists
		? poseidonHash([
				BigInt(invoices_invdotid_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(invoices_invdotid_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(invoices_invdotid_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(invoices_invdotid_prevSalt.hex(32)),
		  ]);

	invoices_invdotid_nullifier = generalise(invoices_invdotid_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const invoices_invdotid_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		invoices_invdotid_nullifier
	);

	const invoices_invdotid_nullifierRoot = generalise(
		invoices_invdotid_nullifier_NonMembership_witness.root
	);
	const invoices_invdotid_nullifier_path = generalise(
		invoices_invdotid_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(invoices_invdotid_nullifier);

	// Get the new updated nullifier Paths
	const invoices_invdotid_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		invoices_invdotid_nullifier
	);
	const invoices_invdotid_nullifier_updatedpath = generalise(
		invoices_invdotid_updated_nullifier_NonMembership_witness.path
	).all;
	const invoices_invdotid_newNullifierRoot = generalise(
		invoices_invdotid_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	invoices_invdotid.amount = invoices_invdotid.amount
		? invoices_invdotid.amount
		: invoices_invdotid_prev.amount;
	invoices_invdotid.id = invoices_invdotid.id
		? invoices_invdotid.id
		: invoices_invdotid_prev.id;

	const invoices_invdotid_newSalt = generalise(utils.randomHex(31));

	let invoices_invdotid_newCommitment = poseidonHash([
		BigInt(invoices_invdotid_stateVarId),
		BigInt(invoices_invdotid.amount.hex(32)),
		BigInt(invoices_invdotid.id.hex(32)),
		BigInt(invoices_invdotid_newOwnerPublicKey.hex(32)),
		BigInt(invoices_invdotid_newSalt.hex(32)),
	]);

	invoices_invdotid_newCommitment = generalise(
		invoices_invdotid_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		inv.amount.integer,
		inv.id.integer,
		secretKey.integer,
		POs_invdotid_nullifierRoot.integer,
		POs_invdotid_nullifier_path.integer,
		POs_invdotid_prev.count.integer,
		POs_invdotid_prev.ppunit.integer,
		POs_invdotid_prev.id.integer,
		POs_invdotid_prev.owner.integer,
		POs_invdotid_prevSalt.integer,
		POs_invdotid_root.integer,
		POs_invdotid_index.integer,
		POs_invdotid_path.integer,

		invoices_invdotid_commitmentExists
			? secretKey.integer
			: generalise(0).integer,

		invoices_invdotid_newNullifierRoot.integer,
		invoices_invdotid_nullifier.integer,
		invoices_invdotid_nullifier_path.integer,
		invoices_invdotid_nullifier_updatedpath.integer,
		invoices_invdotid_prev.amount.integer,
		invoices_invdotid_prev.id.integer,
		invoices_invdotid_prevSalt.integer,
		invoices_invdotid_commitmentExists ? 0 : 1,

		invoices_invdotid_index.integer,
		invoices_invdotid_path.integer,
		invoices_invdotid_newOwnerPublicKey.integer,
		invoices_invdotid_newSalt.integer,
		invoices_invdotid_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("addInvoice", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.addInvoice(
			invoices_invdotid_nullifierRoot.integer,
			invoices_invdotid_newNullifierRoot.integer,
			[invoices_invdotid_nullifier.integer],
			POs_invdotid_root.integer,
			[invoices_invdotid_newCommitment.integer],
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

	if (invoices_invdotid_commitmentExists)
		await markNullified(invoices_invdotid_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: invoices_invdotid_newCommitment,
		name: "invoices",
		mappingKey: invoices_invdotid_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(invoices_invdotid_stateVarId),
			value: { amount: invoices_invdotid.amount, id: invoices_invdotid.id },
			salt: invoices_invdotid_newSalt,
			publicKey: invoices_invdotid_newOwnerPublicKey,
		},
		secretKey:
			invoices_invdotid_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
