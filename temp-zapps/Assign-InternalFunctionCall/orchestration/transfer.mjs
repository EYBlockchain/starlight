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

export default async function transfer(
	_fromAccountId,
	_toAccountId,
	_amount,
	_account_fromAccountId_newOwnerPublicKey = 0,
	_account_toAccountId_newOwnerPublicKey = 0,
	_account_fromAccountId_0_oldCommitment = 0,
	_account_fromAccountId_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("FakeBankShield");

	const contractAddr = await getContractAddress("FakeBankShield");

	const msgValue = 0;
	const fromAccountId = generalise(_fromAccountId);
	const toAccountId = generalise(_toAccountId);
	const amount = generalise(_amount);
	let account_fromAccountId_newOwnerPublicKey = generalise(
		_account_fromAccountId_newOwnerPublicKey
	);
	let account_toAccountId_newOwnerPublicKey = generalise(
		_account_toAccountId_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "FakeBankShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	let account_fromAccountId_stateVarId = 5;

	const account_fromAccountId_stateVarId_key = fromAccountId;

	account_fromAccountId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(account_fromAccountId_stateVarId).bigInt,
				account_fromAccountId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let account_fromAccountId_commitmentExists = true;
	let account_fromAccountId_witnessRequired = true;

	const account_fromAccountId_commitment = await getCurrentWholeCommitment(
		account_fromAccountId_stateVarId
	);

	let account_fromAccountId_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!account_fromAccountId_commitment) {
		account_fromAccountId_commitmentExists = false;
		account_fromAccountId_witnessRequired = false;
	} else {
		account_fromAccountId_preimage = account_fromAccountId_commitment.preimage;
	}

	// Initialise commitment preimage of whole state:

	let account_toAccountId_stateVarId = 5;

	const account_toAccountId_stateVarId_key = toAccountId;

	account_toAccountId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(account_toAccountId_stateVarId).bigInt,
				account_toAccountId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let account_toAccountId_commitmentExists = true;
	let account_toAccountId_witnessRequired = true;

	const account_toAccountId_commitment = await getCurrentWholeCommitment(
		account_toAccountId_stateVarId
	);

	let account_toAccountId_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!account_toAccountId_commitment) {
		account_toAccountId_commitmentExists = false;
		account_toAccountId_witnessRequired = false;
	} else {
		account_toAccountId_preimage = account_toAccountId_commitment.preimage;
	}

	// read preimage for whole state
	account_fromAccountId_newOwnerPublicKey =
		_account_fromAccountId_newOwnerPublicKey === 0
			? publicKey
			: account_fromAccountId_newOwnerPublicKey;

	const account_fromAccountId_currentCommitment = account_fromAccountId_commitmentExists
		? generalise(account_fromAccountId_commitment._id)
		: generalise(0);
	const account_fromAccountId_prev = generalise(
		account_fromAccountId_preimage.value
	);
	const account_fromAccountId_prevSalt = generalise(
		account_fromAccountId_preimage.salt
	);

	// read preimage for whole state
	account_toAccountId_newOwnerPublicKey =
		_account_toAccountId_newOwnerPublicKey === 0
			? publicKey
			: account_toAccountId_newOwnerPublicKey;

	const account_toAccountId_currentCommitment = account_toAccountId_commitmentExists
		? generalise(account_toAccountId_commitment._id)
		: generalise(0);
	const account_toAccountId_prev = generalise(
		account_toAccountId_preimage.value
	);
	const account_toAccountId_prevSalt = generalise(
		account_toAccountId_preimage.salt
	);

	// Extract set membership witness:

	// generate witness for whole state
	const account_fromAccountId_emptyPath = new Array(32).fill(0);
	const account_fromAccountId_witness = account_fromAccountId_witnessRequired
		? await getMembershipWitness(
				"FakeBankShield",
				account_fromAccountId_currentCommitment.integer
		  )
		: {
				index: 0,
				path: account_fromAccountId_emptyPath,
				root: (await getRoot("FakeBankShield")) || 0,
		  };
	const account_fromAccountId_index = generalise(
		account_fromAccountId_witness.index
	);
	const account_fromAccountId_root = generalise(
		account_fromAccountId_witness.root
	);
	const account_fromAccountId_path = generalise(
		account_fromAccountId_witness.path
	).all;

	// generate witness for whole state
	const account_toAccountId_emptyPath = new Array(32).fill(0);
	const account_toAccountId_witness = account_toAccountId_witnessRequired
		? await getMembershipWitness(
				"FakeBankShield",
				account_toAccountId_currentCommitment.integer
		  )
		: {
				index: 0,
				path: account_toAccountId_emptyPath,
				root: (await getRoot("FakeBankShield")) || 0,
		  };
	const account_toAccountId_index = generalise(
		account_toAccountId_witness.index
	);
	const account_toAccountId_root = generalise(account_toAccountId_witness.root);
	const account_toAccountId_path = generalise(account_toAccountId_witness.path)
		.all;

	let account_fromAccountId = generalise(account_fromAccountId_preimage.value);
	account_fromAccountId = generalise(
		parseInt(account_fromAccountId.integer, 10) - parseInt(amount.integer, 10)
	);

	account_fromAccountId = generalise(account_fromAccountId);

	let account_toAccountId = generalise(account_toAccountId_preimage.value);
	account_toAccountId = generalise(
		parseInt(account_toAccountId.integer, 10) + parseInt(amount.integer, 10)
	);

	account_toAccountId = generalise(account_toAccountId);

	// Calculate nullifier(s):

	let account_fromAccountId_nullifier = account_fromAccountId_commitmentExists
		? poseidonHash([
				BigInt(account_fromAccountId_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(account_fromAccountId_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(account_fromAccountId_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(account_fromAccountId_prevSalt.hex(32)),
		  ]);

	account_fromAccountId_nullifier = generalise(
		account_fromAccountId_nullifier.hex(32)
	); // truncate
	// Non-membership witness for Nullifier
	const account_fromAccountId_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		account_fromAccountId_nullifier
	);

	const account_fromAccountId_nullifierRoot = generalise(
		account_fromAccountId_nullifier_NonMembership_witness.root
	);
	const account_fromAccountId_nullifier_path = generalise(
		account_fromAccountId_nullifier_NonMembership_witness.path
	).all;

	let account_toAccountId_nullifier = account_toAccountId_commitmentExists
		? poseidonHash([
				BigInt(account_toAccountId_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(account_toAccountId_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(account_toAccountId_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(account_toAccountId_prevSalt.hex(32)),
		  ]);

	account_toAccountId_nullifier = generalise(
		account_toAccountId_nullifier.hex(32)
	); // truncate
	// Non-membership witness for Nullifier
	const account_toAccountId_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		account_toAccountId_nullifier
	);

	const account_toAccountId_nullifierRoot = generalise(
		account_toAccountId_nullifier_NonMembership_witness.root
	);
	const account_toAccountId_nullifier_path = generalise(
		account_toAccountId_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(account_fromAccountId_nullifier);

	await temporaryUpdateNullifier(account_toAccountId_nullifier);

	// Get the new updated nullifier Paths
	const account_fromAccountId_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		account_fromAccountId_nullifier
	);
	const account_fromAccountId_nullifier_updatedpath = generalise(
		account_fromAccountId_updated_nullifier_NonMembership_witness.path
	).all;
	const account_fromAccountId_newNullifierRoot = generalise(
		account_fromAccountId_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const account_toAccountId_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		account_toAccountId_nullifier
	);
	const account_toAccountId_nullifier_updatedpath = generalise(
		account_toAccountId_updated_nullifier_NonMembership_witness.path
	).all;
	const account_toAccountId_newNullifierRoot = generalise(
		account_toAccountId_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const account_fromAccountId_newSalt = generalise(utils.randomHex(31));

	let account_fromAccountId_newCommitment = poseidonHash([
		BigInt(account_fromAccountId_stateVarId),
		BigInt(account_fromAccountId.hex(32)),
		BigInt(account_fromAccountId_newOwnerPublicKey.hex(32)),
		BigInt(account_fromAccountId_newSalt.hex(32)),
	]);

	account_fromAccountId_newCommitment = generalise(
		account_fromAccountId_newCommitment.hex(32)
	); // truncate

	const account_toAccountId_newSalt = generalise(utils.randomHex(31));

	let account_toAccountId_newCommitment = poseidonHash([
		BigInt(account_toAccountId_stateVarId),
		BigInt(account_toAccountId.hex(32)),
		BigInt(account_toAccountId_newOwnerPublicKey.hex(32)),
		BigInt(account_toAccountId_newSalt.hex(32)),
	]);

	account_toAccountId_newCommitment = generalise(
		account_toAccountId_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		fromAccountId.integer,
		toAccountId.integer,
		amount.integer,
		account_fromAccountId_commitmentExists
			? secretKey.integer
			: generalise(0).integer,
		account_fromAccountId_nullifierRoot.integer,
		account_fromAccountId_newNullifierRoot.integer,
		account_fromAccountId_nullifier.integer,
		account_fromAccountId_nullifier_path.integer,
		account_fromAccountId_nullifier_updatedpath.integer,
		account_fromAccountId_prev.integer,
		account_fromAccountId_prevSalt.integer,
		account_fromAccountId_commitmentExists ? 0 : 1,
		account_fromAccountId_root.integer,
		account_fromAccountId_index.integer,
		account_fromAccountId_path.integer,
		account_fromAccountId_newOwnerPublicKey.integer,
		account_fromAccountId_newSalt.integer,
		account_fromAccountId_newCommitment.integer,
		account_toAccountId_commitmentExists
			? secretKey.integer
			: generalise(0).integer,

		account_toAccountId_nullifier.integer,
		account_toAccountId_nullifier_path.integer,
		account_toAccountId_nullifier_updatedpath.integer,
		account_toAccountId_prev.integer,
		account_toAccountId_prevSalt.integer,
		account_toAccountId_commitmentExists ? 0 : 1,

		account_toAccountId_index.integer,
		account_toAccountId_path.integer,
		account_toAccountId_newOwnerPublicKey.integer,
		account_toAccountId_newSalt.integer,
		account_toAccountId_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("transfer", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.transfer(
			account_fromAccountId_nullifierRoot.integer,
			account_fromAccountId_newNullifierRoot.integer,
			[
				account_fromAccountId_nullifier.integer,
				account_toAccountId_nullifier.integer,
			],
			account_fromAccountId_root.integer,
			[
				account_fromAccountId_newCommitment.integer,
				account_toAccountId_newCommitment.integer,
			],
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

	if (account_fromAccountId_commitmentExists)
		await markNullified(
			account_fromAccountId_currentCommitment,
			secretKey.hex(32)
		);
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: account_fromAccountId_newCommitment,
		name: "account",
		mappingKey: account_fromAccountId_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(account_fromAccountId_stateVarId),
			value: account_fromAccountId,
			salt: account_fromAccountId_newSalt,
			publicKey: account_fromAccountId_newOwnerPublicKey,
		},
		secretKey:
			account_fromAccountId_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	if (account_toAccountId_commitmentExists)
		await markNullified(
			account_toAccountId_currentCommitment,
			secretKey.hex(32)
		);
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: account_toAccountId_newCommitment,
		name: "account",
		mappingKey: account_toAccountId_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(account_toAccountId_stateVarId),
			value: account_toAccountId,
			salt: account_toAccountId_newSalt,
			publicKey: account_toAccountId_newOwnerPublicKey,
		},
		secretKey:
			account_toAccountId_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
