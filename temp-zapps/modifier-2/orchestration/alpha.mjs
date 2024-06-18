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

export default async function alpha(
	_gm_account_newOwnerPublicKey = 0,
	_admin12_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("OwnerShield");

	const contractAddr = await getContractAddress("OwnerShield");

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	let gm_account_newOwnerPublicKey = generalise(_gm_account_newOwnerPublicKey);
	let admin12_newOwnerPublicKey = generalise(_admin12_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "OwnerShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	const gm_account_stateVarId = generalise(3).hex(32);

	let gm_account_commitmentExists = true;
	let gm_account_witnessRequired = true;

	const gm_account_commitment = await getCurrentWholeCommitment(
		gm_account_stateVarId
	);

	let gm_account_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!gm_account_commitment) {
		gm_account_commitmentExists = false;
		gm_account_witnessRequired = false;
	} else {
		gm_account_preimage = gm_account_commitment.preimage;
	}

	// Initialise commitment preimage of whole state:

	const admin12_stateVarId = generalise(5).hex(32);

	let admin12_commitmentExists = true;
	let admin12_witnessRequired = true;

	const admin12_commitment = await getCurrentWholeCommitment(
		admin12_stateVarId
	);

	let admin12_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!admin12_commitment) {
		admin12_commitmentExists = false;
		admin12_witnessRequired = false;
	} else {
		admin12_preimage = admin12_commitment.preimage;
	}

	// Initialise commitment preimage of whole accessed state:

	const admin_stateVarId = generalise(7).hex(32);

	let admin_commitmentExists = true;

	const admin_commitment = await getCurrentWholeCommitment(admin_stateVarId);

	const admin_preimage = admin_commitment.preimage;

	const admin = generalise(admin_preimage.value);

	// Initialise commitment preimage of whole accessed state:

	const gamer_stateVarId = generalise(9).hex(32);

	let gamer_commitmentExists = true;

	const gamer_commitment = await getCurrentWholeCommitment(gamer_stateVarId);

	const gamer_preimage = gamer_commitment.preimage;

	const gamer = generalise(gamer_preimage.value);

	// read preimage for whole state
	gm_account_newOwnerPublicKey =
		_gm_account_newOwnerPublicKey === 0
			? publicKey
			: gm_account_newOwnerPublicKey;

	const gm_account_currentCommitment = gm_account_commitmentExists
		? generalise(gm_account_commitment._id)
		: generalise(0);
	const gm_account_prev = generalise(gm_account_preimage.value);
	const gm_account_prevSalt = generalise(gm_account_preimage.salt);

	// read preimage for whole state
	admin12_newOwnerPublicKey =
		_admin12_newOwnerPublicKey === 0 ? publicKey : admin12_newOwnerPublicKey;

	const admin12_currentCommitment = admin12_commitmentExists
		? generalise(admin12_commitment._id)
		: generalise(0);
	const admin12_prev = generalise(admin12_preimage.value);
	const admin12_prevSalt = generalise(admin12_preimage.salt);

	// read preimage for accessed state

	const admin_currentCommitment = generalise(admin_commitment._id);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// read preimage for accessed state

	const gamer_currentCommitment = generalise(gamer_commitment._id);
	const gamer_prev = generalise(gamer_preimage.value);
	const gamer_prevSalt = generalise(gamer_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const gm_account_emptyPath = new Array(32).fill(0);
	const gm_account_witness = gm_account_witnessRequired
		? await getMembershipWitness(
				"OwnerShield",
				gm_account_currentCommitment.integer
		  )
		: {
				index: 0,
				path: gm_account_emptyPath,
				root: (await getRoot("OwnerShield")) || 0,
		  };
	const gm_account_index = generalise(gm_account_witness.index);
	const gm_account_root = generalise(gm_account_witness.root);
	const gm_account_path = generalise(gm_account_witness.path).all;

	// generate witness for whole state
	const admin12_emptyPath = new Array(32).fill(0);
	const admin12_witness = admin12_witnessRequired
		? await getMembershipWitness(
				"OwnerShield",
				admin12_currentCommitment.integer
		  )
		: {
				index: 0,
				path: admin12_emptyPath,
				root: (await getRoot("OwnerShield")) || 0,
		  };
	const admin12_index = generalise(admin12_witness.index);
	const admin12_root = generalise(admin12_witness.root);
	const admin12_path = generalise(admin12_witness.path).all;

	// generate witness for whole accessed state
	const admin_witness = await getMembershipWitness(
		"OwnerShield",
		admin_currentCommitment.integer
	);
	const admin_index = generalise(admin_witness.index);
	const admin_root = generalise(admin_witness.root);
	const admin_path = generalise(admin_witness.path).all;

	// generate witness for whole accessed state
	const gamer_witness = await getMembershipWitness(
		"OwnerShield",
		gamer_currentCommitment.integer
	);
	const gamer_index = generalise(gamer_witness.index);
	const gamer_root = generalise(gamer_witness.root);
	const gamer_path = generalise(gamer_witness.path).all;

	let gm_account = generalise(gm_account_preimage.value);
	gm_account = generalise(parseInt(gm_account.integer, 10) + 3);

	gm_account = generalise(gm_account);

	let admin12 = generalise(3);

	admin12 = generalise(admin12);

	admin12 = generalise(parseInt(admin12.integer, 10) + 1);

	admin12 = generalise(admin12);

	// Calculate nullifier(s):

	let gm_account_nullifier = gm_account_commitmentExists
		? poseidonHash([
				BigInt(gm_account_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(gm_account_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(gm_account_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(gm_account_prevSalt.hex(32)),
		  ]);

	gm_account_nullifier = generalise(gm_account_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const gm_account_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(gm_account_nullifier);

	const gm_account_nullifierRoot = generalise(
		gm_account_nullifier_NonMembership_witness.root
	);
	const gm_account_nullifier_path = generalise(
		gm_account_nullifier_NonMembership_witness.path
	).all;

	let admin12_nullifier = admin12_commitmentExists
		? poseidonHash([
				BigInt(admin12_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(admin12_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(admin12_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(admin12_prevSalt.hex(32)),
		  ]);

	admin12_nullifier = generalise(admin12_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const admin12_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(admin12_nullifier);

	const admin12_nullifierRoot = generalise(
		admin12_nullifier_NonMembership_witness.root
	);
	const admin12_nullifier_path = generalise(
		admin12_nullifier_NonMembership_witness.path
	).all;

	let admin_nullifier = admin_commitmentExists
		? poseidonHash([
				BigInt(admin_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(admin_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(admin_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(admin_prevSalt.hex(32)),
		  ]);

	admin_nullifier = generalise(admin_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const admin_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(admin_nullifier);

	const admin_nullifierRoot = generalise(
		admin_nullifier_NonMembership_witness.root
	);
	const admin_nullifier_path = generalise(
		admin_nullifier_NonMembership_witness.path
	).all;

	let gamer_nullifier = gamer_commitmentExists
		? poseidonHash([
				BigInt(gamer_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(gamer_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(gamer_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(gamer_prevSalt.hex(32)),
		  ]);

	gamer_nullifier = generalise(gamer_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const gamer_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(gamer_nullifier);

	const gamer_nullifierRoot = generalise(
		gamer_nullifier_NonMembership_witness.root
	);
	const gamer_nullifier_path = generalise(
		gamer_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(gm_account_nullifier);

	await temporaryUpdateNullifier(admin12_nullifier);

	// Get the new updated nullifier Paths
	const gm_account_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(gm_account_nullifier);
	const gm_account_nullifier_updatedpath = generalise(
		gm_account_updated_nullifier_NonMembership_witness.path
	).all;
	const gm_account_newNullifierRoot = generalise(
		gm_account_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const admin12_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(admin12_nullifier);
	const admin12_nullifier_updatedpath = generalise(
		admin12_updated_nullifier_NonMembership_witness.path
	).all;
	const admin12_newNullifierRoot = generalise(
		admin12_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const gm_account_newSalt = generalise(utils.randomHex(31));

	let gm_account_newCommitment = poseidonHash([
		BigInt(gm_account_stateVarId),
		BigInt(gm_account.hex(32)),
		BigInt(gm_account_newOwnerPublicKey.hex(32)),
		BigInt(gm_account_newSalt.hex(32)),
	]);

	gm_account_newCommitment = generalise(gm_account_newCommitment.hex(32)); // truncate

	const admin12_newSalt = generalise(utils.randomHex(31));

	let admin12_newCommitment = poseidonHash([
		BigInt(admin12_stateVarId),
		BigInt(admin12.hex(32)),
		BigInt(admin12_newOwnerPublicKey.hex(32)),
		BigInt(admin12_newSalt.hex(32)),
	]);

	admin12_newCommitment = generalise(admin12_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		gm_account_commitmentExists ? secretKey.integer : generalise(0).integer,
		gm_account_nullifierRoot.integer,
		gm_account_newNullifierRoot.integer,
		gm_account_nullifier.integer,
		gm_account_nullifier_path.integer,
		gm_account_nullifier_updatedpath.integer,
		gm_account_prev.integer,
		gm_account_prevSalt.integer,
		gm_account_commitmentExists ? 0 : 1,
		gm_account_root.integer,
		gm_account_index.integer,
		gm_account_path.integer,
		gm_account_newOwnerPublicKey.integer,
		gm_account_newSalt.integer,
		gm_account_newCommitment.integer,
		admin12_commitmentExists ? secretKey.integer : generalise(0).integer,

		admin12_nullifier.integer,
		admin12_nullifier_path.integer,
		admin12_nullifier_updatedpath.integer,
		admin12_prev.integer,
		admin12_prevSalt.integer,
		admin12_commitmentExists ? 0 : 1,

		admin12_index.integer,
		admin12_path.integer,
		admin12_newOwnerPublicKey.integer,
		admin12_newSalt.integer,
		admin12_newCommitment.integer,
		secretKey.integer,

		admin_nullifier_path.integer,
		admin_prev.integer,
		admin_prevSalt.integer,

		admin_index.integer,
		admin_path.integer,

		secretKey.integer,

		gamer_nullifier_path.integer,
		gamer_prev.integer,
		gamer_prevSalt.integer,

		gamer_index.integer,
		gamer_path.integer,
	].flat(Infinity);
	const res = await generateProof("alpha", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.alpha(
			gm_account_nullifierRoot.integer,
			gm_account_newNullifierRoot.integer,
			[gm_account_nullifier.integer, admin12_nullifier.integer],
			gm_account_root.integer,
			[gm_account_newCommitment.integer, admin12_newCommitment.integer],
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

	if (gm_account_commitmentExists)
		await markNullified(gm_account_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: gm_account_newCommitment,
		name: "gm_account",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(gm_account_stateVarId),
			value: gm_account,
			salt: gm_account_newSalt,
			publicKey: gm_account_newOwnerPublicKey,
		},
		secretKey:
			gm_account_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	if (admin12_commitmentExists)
		await markNullified(admin12_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: admin12_newCommitment,
		name: "admin12",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(admin12_stateVarId),
			value: admin12,
			salt: admin12_newSalt,
			publicKey: admin12_newOwnerPublicKey,
		},
		secretKey:
			admin12_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
