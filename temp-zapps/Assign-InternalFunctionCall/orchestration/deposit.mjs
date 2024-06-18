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

export default async function deposit(
	_accountId,
	_amountDeposit,
	_account_accountId_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("FakeBankShield");

	const contractAddr = await getContractAddress("FakeBankShield");

	const msgValue = 0;
	const accountId = generalise(_accountId);
	const amountDeposit = generalise(_amountDeposit);
	let account_accountId_newOwnerPublicKey = generalise(
		_account_accountId_newOwnerPublicKey
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

	let account_accountId_stateVarId = 5;

	const account_accountId_stateVarId_key = accountId;

	account_accountId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(account_accountId_stateVarId).bigInt,
				account_accountId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let account_accountId_commitmentExists = true;
	let account_accountId_witnessRequired = true;

	const account_accountId_commitment = await getCurrentWholeCommitment(
		account_accountId_stateVarId
	);

	let account_accountId_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!account_accountId_commitment) {
		account_accountId_commitmentExists = false;
		account_accountId_witnessRequired = false;
	} else {
		account_accountId_preimage = account_accountId_commitment.preimage;
	}

	// read preimage for whole state
	account_accountId_newOwnerPublicKey =
		_account_accountId_newOwnerPublicKey === 0
			? publicKey
			: account_accountId_newOwnerPublicKey;

	const account_accountId_currentCommitment = account_accountId_commitmentExists
		? generalise(account_accountId_commitment._id)
		: generalise(0);
	const account_accountId_prev = generalise(account_accountId_preimage.value);
	const account_accountId_prevSalt = generalise(
		account_accountId_preimage.salt
	);

	// Extract set membership witness:

	// generate witness for whole state
	const account_accountId_emptyPath = new Array(32).fill(0);
	const account_accountId_witness = account_accountId_witnessRequired
		? await getMembershipWitness(
				"FakeBankShield",
				account_accountId_currentCommitment.integer
		  )
		: {
				index: 0,
				path: account_accountId_emptyPath,
				root: (await getRoot("FakeBankShield")) || 0,
		  };
	const account_accountId_index = generalise(account_accountId_witness.index);
	const account_accountId_root = generalise(account_accountId_witness.root);
	const account_accountId_path = generalise(account_accountId_witness.path).all;

	let account_accountId = generalise(account_accountId_preimage.value);
	account_accountId = generalise(
		parseInt(account_accountId.integer, 10) +
			parseInt(amountDeposit.integer, 10)
	);

	account_accountId = generalise(account_accountId);

	// Calculate nullifier(s):

	let account_accountId_nullifier = account_accountId_commitmentExists
		? poseidonHash([
				BigInt(account_accountId_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(account_accountId_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(account_accountId_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(account_accountId_prevSalt.hex(32)),
		  ]);

	account_accountId_nullifier = generalise(account_accountId_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const account_accountId_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(account_accountId_nullifier);

	const account_accountId_nullifierRoot = generalise(
		account_accountId_nullifier_NonMembership_witness.root
	);
	const account_accountId_nullifier_path = generalise(
		account_accountId_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(account_accountId_nullifier);

	// Get the new updated nullifier Paths
	const account_accountId_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(account_accountId_nullifier);
	const account_accountId_nullifier_updatedpath = generalise(
		account_accountId_updated_nullifier_NonMembership_witness.path
	).all;
	const account_accountId_newNullifierRoot = generalise(
		account_accountId_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const account_accountId_newSalt = generalise(utils.randomHex(31));

	let account_accountId_newCommitment = poseidonHash([
		BigInt(account_accountId_stateVarId),
		BigInt(account_accountId.hex(32)),
		BigInt(account_accountId_newOwnerPublicKey.hex(32)),
		BigInt(account_accountId_newSalt.hex(32)),
	]);

	account_accountId_newCommitment = generalise(
		account_accountId_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		accountId.integer,
		amountDeposit.integer,
		account_accountId_commitmentExists
			? secretKey.integer
			: generalise(0).integer,
		account_accountId_nullifierRoot.integer,
		account_accountId_newNullifierRoot.integer,
		account_accountId_nullifier.integer,
		account_accountId_nullifier_path.integer,
		account_accountId_nullifier_updatedpath.integer,
		account_accountId_prev.integer,
		account_accountId_prevSalt.integer,
		account_accountId_commitmentExists ? 0 : 1,
		account_accountId_root.integer,
		account_accountId_index.integer,
		account_accountId_path.integer,
		account_accountId_newOwnerPublicKey.integer,
		account_accountId_newSalt.integer,
		account_accountId_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("deposit", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.deposit(
			account_accountId_nullifierRoot.integer,
			account_accountId_newNullifierRoot.integer,
			[account_accountId_nullifier.integer],
			account_accountId_root.integer,
			[account_accountId_newCommitment.integer],
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

	if (account_accountId_commitmentExists)
		await markNullified(account_accountId_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: account_accountId_newCommitment,
		name: "account",
		mappingKey: account_accountId_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(account_accountId_stateVarId),
			value: account_accountId,
			salt: account_accountId_newSalt,
			publicKey: account_accountId_newOwnerPublicKey,
		},
		secretKey:
			account_accountId_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
