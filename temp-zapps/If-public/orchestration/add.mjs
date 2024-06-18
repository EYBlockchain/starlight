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
	_y,
	_x_msgSender_newOwnerPublicKey = 0,
	_z_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("TestShield");

	const contractAddr = await getContractAddress("TestShield");

	const msgValue = 0;
	const y = generalise(_y);
	let x_msgSender_newOwnerPublicKey = generalise(
		_x_msgSender_newOwnerPublicKey
	);
	let z_newOwnerPublicKey = generalise(_z_newOwnerPublicKey);

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

	let x_msgSender_stateVarId = 5;

	const x_msgSender_stateVarId_key = generalise(
		config.web3.options.defaultAccount
	); // emulates msg.sender

	x_msgSender_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(x_msgSender_stateVarId).bigInt,
				x_msgSender_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let x_msgSender_commitmentExists = true;
	let x_msgSender_witnessRequired = true;

	const x_msgSender_commitment = await getCurrentWholeCommitment(
		x_msgSender_stateVarId
	);

	let x_msgSender_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!x_msgSender_commitment) {
		x_msgSender_commitmentExists = false;
		x_msgSender_witnessRequired = false;
	} else {
		x_msgSender_preimage = x_msgSender_commitment.preimage;
	}

	// Initialise commitment preimage of whole state:

	const z_stateVarId = generalise(7).hex(32);

	let z_commitmentExists = true;
	let z_witnessRequired = true;

	const z_commitment = await getCurrentWholeCommitment(z_stateVarId);

	let z_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!z_commitment) {
		z_commitmentExists = false;
		z_witnessRequired = false;
	} else {
		z_preimage = z_commitment.preimage;
	}

	// read preimage for whole state
	x_msgSender_newOwnerPublicKey =
		_x_msgSender_newOwnerPublicKey === 0
			? publicKey
			: x_msgSender_newOwnerPublicKey;

	const x_msgSender_currentCommitment = x_msgSender_commitmentExists
		? generalise(x_msgSender_commitment._id)
		: generalise(0);
	const x_msgSender_prev = generalise(x_msgSender_preimage.value);
	const x_msgSender_prevSalt = generalise(x_msgSender_preimage.salt);

	// read preimage for whole state
	z_newOwnerPublicKey =
		_z_newOwnerPublicKey === 0 ? publicKey : z_newOwnerPublicKey;

	const z_currentCommitment = z_commitmentExists
		? generalise(z_commitment._id)
		: generalise(0);
	const z_prev = generalise(z_preimage.value);
	const z_prevSalt = generalise(z_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const x_msgSender_emptyPath = new Array(32).fill(0);
	const x_msgSender_witness = x_msgSender_witnessRequired
		? await getMembershipWitness(
				"TestShield",
				x_msgSender_currentCommitment.integer
		  )
		: {
				index: 0,
				path: x_msgSender_emptyPath,
				root: (await getRoot("TestShield")) || 0,
		  };
	const x_msgSender_index = generalise(x_msgSender_witness.index);
	const x_msgSender_root = generalise(x_msgSender_witness.root);
	const x_msgSender_path = generalise(x_msgSender_witness.path).all;

	// generate witness for whole state
	const z_emptyPath = new Array(32).fill(0);
	const z_witness = z_witnessRequired
		? await getMembershipWitness("TestShield", z_currentCommitment.integer)
		: { index: 0, path: z_emptyPath, root: (await getRoot("TestShield")) || 0 };
	const z_index = generalise(z_witness.index);
	const z_root = generalise(z_witness.root);
	const z_path = generalise(z_witness.path).all;

	let x_msgSender = generalise(x_msgSender_preimage.value);

	let z = generalise(z_preimage.value);

	if (parseInt(x_msgSender.integer, 10) > 5) {
		z = generalise(parseInt(y.integer, 10) + 3);
	} else {
		x_msgSender = generalise(parseInt(y.integer, 10) + 1);
	}

	z = generalise(z);

	x_msgSender = generalise(x_msgSender);

	// Calculate nullifier(s):

	let x_msgSender_nullifier = x_msgSender_commitmentExists
		? poseidonHash([
				BigInt(x_msgSender_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(x_msgSender_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(x_msgSender_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(x_msgSender_prevSalt.hex(32)),
		  ]);

	x_msgSender_nullifier = generalise(x_msgSender_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const x_msgSender_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(x_msgSender_nullifier);

	const x_msgSender_nullifierRoot = generalise(
		x_msgSender_nullifier_NonMembership_witness.root
	);
	const x_msgSender_nullifier_path = generalise(
		x_msgSender_nullifier_NonMembership_witness.path
	).all;

	let z_nullifier = z_commitmentExists
		? poseidonHash([
				BigInt(z_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(z_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(z_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(z_prevSalt.hex(32)),
		  ]);

	z_nullifier = generalise(z_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const z_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(z_nullifier);

	const z_nullifierRoot = generalise(z_nullifier_NonMembership_witness.root);
	const z_nullifier_path = generalise(
		z_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(x_msgSender_nullifier);

	await temporaryUpdateNullifier(z_nullifier);

	// Get the new updated nullifier Paths
	const x_msgSender_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(x_msgSender_nullifier);
	const x_msgSender_nullifier_updatedpath = generalise(
		x_msgSender_updated_nullifier_NonMembership_witness.path
	).all;
	const x_msgSender_newNullifierRoot = generalise(
		x_msgSender_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const z_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(z_nullifier);
	const z_nullifier_updatedpath = generalise(
		z_updated_nullifier_NonMembership_witness.path
	).all;
	const z_newNullifierRoot = generalise(
		z_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const x_msgSender_newSalt = generalise(utils.randomHex(31));

	let x_msgSender_newCommitment = poseidonHash([
		BigInt(x_msgSender_stateVarId),
		BigInt(x_msgSender.hex(32)),
		BigInt(x_msgSender_newOwnerPublicKey.hex(32)),
		BigInt(x_msgSender_newSalt.hex(32)),
	]);

	x_msgSender_newCommitment = generalise(x_msgSender_newCommitment.hex(32)); // truncate

	const z_newSalt = generalise(utils.randomHex(31));

	let z_newCommitment = poseidonHash([
		BigInt(z_stateVarId),
		BigInt(z.hex(32)),
		BigInt(z_newOwnerPublicKey.hex(32)),
		BigInt(z_newSalt.hex(32)),
	]);

	z_newCommitment = generalise(z_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		y.integer,
		x_msgSender_stateVarId_key.integer,
		x_msgSender_commitmentExists ? secretKey.integer : generalise(0).integer,
		x_msgSender_nullifierRoot.integer,
		x_msgSender_newNullifierRoot.integer,
		x_msgSender_nullifier.integer,
		x_msgSender_nullifier_path.integer,
		x_msgSender_nullifier_updatedpath.integer,
		x_msgSender_prev.integer,
		x_msgSender_prevSalt.integer,
		x_msgSender_commitmentExists ? 0 : 1,
		x_msgSender_root.integer,
		x_msgSender_index.integer,
		x_msgSender_path.integer,
		x_msgSender_newOwnerPublicKey.integer,
		x_msgSender_newSalt.integer,
		x_msgSender_newCommitment.integer,
		z_commitmentExists ? secretKey.integer : generalise(0).integer,

		z_nullifier.integer,
		z_nullifier_path.integer,
		z_nullifier_updatedpath.integer,
		z_prev.integer,
		z_prevSalt.integer,
		z_commitmentExists ? 0 : 1,

		z_index.integer,
		z_path.integer,
		z_newOwnerPublicKey.integer,
		z_newSalt.integer,
		z_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			y.integer,
			x_msgSender_nullifierRoot.integer,
			x_msgSender_newNullifierRoot.integer,
			[x_msgSender_nullifier.integer, z_nullifier.integer],
			x_msgSender_root.integer,
			[x_msgSender_newCommitment.integer, z_newCommitment.integer],
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

	if (x_msgSender_commitmentExists)
		await markNullified(x_msgSender_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: x_msgSender_newCommitment,
		name: "x",
		mappingKey: x_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(x_msgSender_stateVarId),
			value: x_msgSender,
			salt: x_msgSender_newSalt,
			publicKey: x_msgSender_newOwnerPublicKey,
		},
		secretKey:
			x_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	if (z_commitmentExists)
		await markNullified(z_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: z_newCommitment,
		name: "z",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(z_stateVarId),
			value: z,
			salt: z_newSalt,
			publicKey: z_newOwnerPublicKey,
		},
		secretKey:
			z_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
