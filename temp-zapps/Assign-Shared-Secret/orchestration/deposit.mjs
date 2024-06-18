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
	_amount,
	_tokenId,
	_balances_msgSender_newOwnerPublicKey = 0,
	_tokenOwners_tokenId_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("SwapShield");

	const contractAddr = await getContractAddress("SwapShield");

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	const amount = generalise(_amount);
	const tokenId = generalise(_tokenId);
	let balances_msgSender_newOwnerPublicKey = generalise(
		_balances_msgSender_newOwnerPublicKey
	);
	let tokenOwners_tokenId_newOwnerPublicKey = generalise(
		_tokenOwners_tokenId_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "SwapShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for incremented state
	balances_msgSender_newOwnerPublicKey =
		_balances_msgSender_newOwnerPublicKey === 0
			? publicKey
			: balances_msgSender_newOwnerPublicKey;

	let balances_msgSender_stateVarId = 5;

	const balances_msgSender_stateVarId_key = generalise(
		config.web3.options.defaultAccount
	); // emulates msg.sender

	balances_msgSender_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(balances_msgSender_stateVarId).bigInt,
				balances_msgSender_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	const balances_msgSender_newCommitmentValue = generalise(
		parseInt(amount.integer, 10)
	);

	// read preimage for reinitialised state
	tokenOwners_tokenId_newOwnerPublicKey =
		_tokenOwners_tokenId_newOwnerPublicKey === 0
			? publicKey
			: tokenOwners_tokenId_newOwnerPublicKey;

	let tokenOwners_tokenId_stateVarId = 9;

	const tokenOwners_tokenId_stateVarId_key = tokenId;

	tokenOwners_tokenId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(tokenOwners_tokenId_stateVarId).bigInt,
				tokenOwners_tokenId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	// increment would go here but has been filtered out

	let tokenOwners_tokenId = generalise(msgSender.integer);

	tokenOwners_tokenId = generalise(tokenOwners_tokenId);

	// Calculate commitment(s):

	const balances_msgSender_newSalt = generalise(utils.randomHex(31));

	let balances_msgSender_newCommitment = poseidonHash([
		BigInt(balances_msgSender_stateVarId),
		BigInt(balances_msgSender_newCommitmentValue.hex(32)),
		BigInt(balances_msgSender_newOwnerPublicKey.hex(32)),
		BigInt(balances_msgSender_newSalt.hex(32)),
	]);

	balances_msgSender_newCommitment = generalise(
		balances_msgSender_newCommitment.hex(32)
	); // truncate

	const tokenOwners_tokenId_newSalt = generalise(utils.randomHex(31));

	let tokenOwners_tokenId_newCommitment = poseidonHash([
		BigInt(tokenOwners_tokenId_stateVarId),
		BigInt(tokenOwners_tokenId.hex(32)),
		BigInt(tokenOwners_tokenId_newOwnerPublicKey.hex(32)),
		BigInt(tokenOwners_tokenId_newSalt.hex(32)),
	]);

	tokenOwners_tokenId_newCommitment = generalise(
		tokenOwners_tokenId_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		amount.integer,
		tokenId.integer,
		balances_msgSender_newOwnerPublicKey.integer,
		balances_msgSender_newSalt.integer,
		balances_msgSender_newCommitment.integer,

		tokenOwners_tokenId_newOwnerPublicKey.integer,
		tokenOwners_tokenId_newSalt.integer,
		tokenOwners_tokenId_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("deposit", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.deposit(
			[
				balances_msgSender_newCommitment.integer,
				tokenOwners_tokenId_newCommitment.integer,
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

	await storeCommitment({
		hash: balances_msgSender_newCommitment,
		name: "balances",
		mappingKey: balances_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(balances_msgSender_stateVarId),
			value: balances_msgSender_newCommitmentValue,
			salt: balances_msgSender_newSalt,
			publicKey: balances_msgSender_newOwnerPublicKey,
		},
		secretKey:
			balances_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	await storeCommitment({
		hash: tokenOwners_tokenId_newCommitment,
		name: "tokenOwners",
		mappingKey: tokenOwners_tokenId_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(tokenOwners_tokenId_stateVarId),
			value: tokenOwners_tokenId,
			salt: tokenOwners_tokenId_newSalt,
			publicKey: tokenOwners_tokenId_newOwnerPublicKey,
		},
		secretKey:
			tokenOwners_tokenId_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
