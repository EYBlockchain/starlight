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

export default async function addPO(
	_newpo,
	_POs_newpodotid_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const contract = new Contract("ReceiptShield");

	await contract.init();

	const instance = contract.getInstance();

	if (!instance) {
		throw new Error("Contract instance is not initialized");
	}

	const contractAddr = await contract.getContractAddress();

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	const newpo = generalise(_newpo);
	let POs_newpodotid_newOwnerPublicKey = generalise(
		_POs_newpodotid_newOwnerPublicKey
	);

	// Initialize the contract

	const contract = new Contract("ReceiptShield");

	await contract.init();

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await contract.registerKey(utils.randomHex(31), "ReceiptShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	let POs_newpodotid_stateVarId = 6;

	const POs_newpodotid_stateVarId_key = newpo.id;

	POs_newpodotid_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(POs_newpodotid_stateVarId).bigInt,
				POs_newpodotid_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let POs_newpodotid_commitmentExists = true;
	let POs_newpodotid_witnessRequired = true;

	const POs_newpodotid_commitment = await getCurrentWholeCommitment(
		POs_newpodotid_stateVarId
	);

	let POs_newpodotid_preimage = {
		value: { id: 0, count: 0, ppunit: 0, owner: 0 },
		salt: 0,
		commitment: 0,
	};
	if (!POs_newpodotid_commitment) {
		POs_newpodotid_commitmentExists = false;
		POs_newpodotid_witnessRequired = false;
	} else {
		POs_newpodotid_preimage = POs_newpodotid_commitment.preimage;
	}

	// read preimage for whole state
	POs_newpodotid_newOwnerPublicKey =
		_POs_newpodotid_newOwnerPublicKey === 0
			? publicKey
			: POs_newpodotid_newOwnerPublicKey;

	const POs_newpodotid_currentCommitment = POs_newpodotid_commitmentExists
		? generalise(POs_newpodotid_commitment._id)
		: generalise(0);
	const POs_newpodotid_prev = generalise(POs_newpodotid_preimage.value);
	const POs_newpodotid_prevSalt = generalise(POs_newpodotid_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const POs_newpodotid_emptyPath = new Array(32).fill(0);
	const POs_newpodotid_witness = POs_newpodotid_witnessRequired
		? await getMembershipWitness(
				"ReceiptShield",
				POs_newpodotid_currentCommitment.integer
		  )
		: {
				index: 0,
				path: POs_newpodotid_emptyPath,
				root: (await getRoot("ReceiptShield")) || 0,
		  };
	const POs_newpodotid_index = generalise(POs_newpodotid_witness.index);
	const POs_newpodotid_root = generalise(POs_newpodotid_witness.root);
	const POs_newpodotid_path = generalise(POs_newpodotid_witness.path).all;

	let POs_newpodotid = generalise(POs_newpodotid_preimage.value);

	POs_newpodotid.count = generalise(parseInt(newpo.count.integer, 10));

	POs_newpodotid = generalise(POs_newpodotid);

	POs_newpodotid.ppunit = generalise(parseInt(newpo.ppunit.integer, 10));

	POs_newpodotid = generalise(POs_newpodotid);

	POs_newpodotid.id = generalise(parseInt(newpo.id.integer, 10));

	POs_newpodotid = generalise(POs_newpodotid);

	POs_newpodotid.owner = generalise(newpo.owner.integer);

	POs_newpodotid = generalise(POs_newpodotid);

	// Calculate nullifier(s):

	let POs_newpodotid_nullifier = POs_newpodotid_commitmentExists
		? poseidonHash([
				BigInt(POs_newpodotid_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(POs_newpodotid_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(POs_newpodotid_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(POs_newpodotid_prevSalt.hex(32)),
		  ]);
	let POs_newpodotid_nullifier = POs_newpodotid_commitmentExists
		? poseidonHash([
				BigInt(POs_newpodotid_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(POs_newpodotid_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(POs_newpodotid_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(POs_newpodotid_prevSalt.hex(32)),
		  ]);

	POs_newpodotid_nullifier = generalise(POs_newpodotid_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const POs_newpodotid_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		POs_newpodotid_nullifier
	);

	const POs_newpodotid_nullifierRoot = generalise(
		POs_newpodotid_nullifier_NonMembership_witness.root
	);
	const POs_newpodotid_nullifier_path = generalise(
		POs_newpodotid_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(POs_newpodotid_nullifier);

	// Get the new updated nullifier Paths
	const POs_newpodotid_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		POs_newpodotid_nullifier
	);
	const POs_newpodotid_nullifier_updatedpath = generalise(
		POs_newpodotid_updated_nullifier_NonMembership_witness.path
	).all;
	const POs_newpodotid_newNullifierRoot = generalise(
		POs_newpodotid_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	POs_newpodotid.count = POs_newpodotid.count
		? POs_newpodotid.count
		: POs_newpodotid_prev.count;
	POs_newpodotid.ppunit = POs_newpodotid.ppunit
		? POs_newpodotid.ppunit
		: POs_newpodotid_prev.ppunit;
	POs_newpodotid.id = POs_newpodotid.id
		? POs_newpodotid.id
		: POs_newpodotid_prev.id;
	POs_newpodotid.owner = POs_newpodotid.owner
		? POs_newpodotid.owner
		: POs_newpodotid_prev.owner;

	const POs_newpodotid_newSalt = generalise(utils.randomHex(31));

	let POs_newpodotid_newCommitment = poseidonHash([
		BigInt(POs_newpodotid_stateVarId),
		BigInt(POs_newpodotid.count.hex(32)),
		BigInt(POs_newpodotid.ppunit.hex(32)),
		BigInt(POs_newpodotid.id.hex(32)),
		BigInt(POs_newpodotid.owner.hex(32)),
		BigInt(POs_newpodotid_newOwnerPublicKey.hex(32)),
		BigInt(POs_newpodotid_newSalt.hex(32)),
	]);

	POs_newpodotid_newCommitment = generalise(
		POs_newpodotid_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		newpo.count.integer,
		newpo.ppunit.integer,
		newpo.id.integer,
		newpo.owner.integer,
		POs_newpodotid_commitmentExists ? secretKey.integer : generalise(0).integer,
		POs_newpodotid_commitmentExists ? secretKey.integer : generalise(0).integer,
		POs_newpodotid_nullifierRoot.integer,
		POs_newpodotid_newNullifierRoot.integer,
		POs_newpodotid_newNullifierRoot.integer,
		POs_newpodotid_nullifier.integer,
		POs_newpodotid_nullifier_path.integer,
		POs_newpodotid_nullifier_updatedpath.integer,
		POs_newpodotid_prev.count.integer,
		POs_newpodotid_prev.ppunit.integer,
		POs_newpodotid_prev.id.integer,
		POs_newpodotid_prev.owner.integer,
		POs_newpodotid_prevSalt.integer,
		POs_newpodotid_commitmentExists ? 0 : 1,
		POs_newpodotid_root.integer,
		POs_newpodotid_index.integer,
		POs_newpodotid_path.integer,
		POs_newpodotid_newOwnerPublicKey.integer,
		POs_newpodotid_newSalt.integer,
		POs_newpodotid_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("addPO", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.addPO(
			POs_newpodotid_nullifierRoot.integer,
			POs_newpodotid_newNullifierRoot.integer,
			[POs_newpodotid_nullifier.integer],
			POs_newpodotid_root.integer,
			[POs_newpodotid_newCommitment.integer],
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

	if (POs_newpodotid_commitmentExists)
		await markNullified(POs_newpodotid_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	if (POs_newpodotid_commitmentExists)
		await markNullified(POs_newpodotid_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: POs_newpodotid_newCommitment,
		name: "POs",
		mappingKey: POs_newpodotid_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(POs_newpodotid_stateVarId),
			value: {
				count: POs_newpodotid.count,
				ppunit: POs_newpodotid.ppunit,
				id: POs_newpodotid.id,
				owner: POs_newpodotid.owner,
			},
			salt: POs_newpodotid_newSalt,
			publicKey: POs_newpodotid_newOwnerPublicKey,
		},
		secretKey:
			POs_newpodotid_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		secretKey:
			POs_newpodotid_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
