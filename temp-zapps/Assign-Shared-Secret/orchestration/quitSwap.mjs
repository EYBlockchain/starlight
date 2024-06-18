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

export default async function quitSwap(
	_sharedAddress,
	_amountSent,
	_tokenIdSent,
	_balances_msgSender_newOwnerPublicKey = 0,
	_tokenOwners_tokenIdSent_newOwnerPublicKey = 0,
	_pendingStatus_newOwnerPublicKey = 0,
	_swapProposals_sharedAddress_newOwnerPublicKey = 0,
	_swapProposals_sharedAddress_0_oldCommitment = 0,
	_swapProposals_sharedAddress_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("SwapShield");

	const contractAddr = await getContractAddress("SwapShield");

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	const sharedAddress = generalise(_sharedAddress);
	const amountSent = generalise(_amountSent);
	const tokenIdSent = generalise(_tokenIdSent);
	let balances_msgSender_newOwnerPublicKey = generalise(
		_balances_msgSender_newOwnerPublicKey
	);
	let tokenOwners_tokenIdSent_newOwnerPublicKey = generalise(
		_tokenOwners_tokenIdSent_newOwnerPublicKey
	);
	let pendingStatus_newOwnerPublicKey = generalise(
		_pendingStatus_newOwnerPublicKey
	);
	let swapProposals_sharedAddress_newOwnerPublicKey = generalise(
		_swapProposals_sharedAddress_newOwnerPublicKey
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

	// Initialise commitment preimage of whole state:

	let tokenOwners_tokenIdSent_stateVarId = 9;

	const tokenOwners_tokenIdSent_stateVarId_key = tokenIdSent;

	tokenOwners_tokenIdSent_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(tokenOwners_tokenIdSent_stateVarId).bigInt,
				tokenOwners_tokenIdSent_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let tokenOwners_tokenIdSent_commitmentExists = true;
	let tokenOwners_tokenIdSent_witnessRequired = true;

	const tokenOwners_tokenIdSent_commitment = await getCurrentWholeCommitment(
		tokenOwners_tokenIdSent_stateVarId
	);

	let tokenOwners_tokenIdSent_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!tokenOwners_tokenIdSent_commitment) {
		tokenOwners_tokenIdSent_commitmentExists = false;
		tokenOwners_tokenIdSent_witnessRequired = false;
	} else {
		tokenOwners_tokenIdSent_preimage =
			tokenOwners_tokenIdSent_commitment.preimage;
	}

	// Initialise commitment preimage of whole state:

	const pendingStatus_stateVarId = generalise(20).hex(32);

	let pendingStatus_commitmentExists = true;
	let pendingStatus_witnessRequired = true;

	const pendingStatus_commitment = await getCurrentWholeCommitment(
		pendingStatus_stateVarId
	);

	let pendingStatus_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!pendingStatus_commitment) {
		pendingStatus_commitmentExists = false;
		pendingStatus_witnessRequired = false;
	} else {
		pendingStatus_preimage = pendingStatus_commitment.preimage;
	}

	// Initialise commitment preimage of whole state:

	let swapProposals_sharedAddress_stateVarId = 25;

	const swapProposals_sharedAddress_stateVarId_key = sharedAddress;

	swapProposals_sharedAddress_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(swapProposals_sharedAddress_stateVarId).bigInt,
				swapProposals_sharedAddress_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let swapProposals_sharedAddress_commitmentExists = true;
	let swapProposals_sharedAddress_witnessRequired = true;

	const swapProposals_sharedAddress_commitment =
		await getCurrentWholeCommitment(swapProposals_sharedAddress_stateVarId);

	let swapProposals_sharedAddress_preimage = {
		value: {
			swapAmountSent: 0,
			swapTokenSent: 0,
			swapTokenRecieved: 0,
			swapAmountRecieved: 0,
		},
		salt: 0,
		commitment: 0,
	};
	if (!swapProposals_sharedAddress_commitment) {
		swapProposals_sharedAddress_commitmentExists = false;
		swapProposals_sharedAddress_witnessRequired = false;
	} else {
		swapProposals_sharedAddress_preimage =
			swapProposals_sharedAddress_commitment.preimage;
	}

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
		parseInt(amountSent.integer, 10)
	);

	// read preimage for whole state
	tokenOwners_tokenIdSent_newOwnerPublicKey =
		_tokenOwners_tokenIdSent_newOwnerPublicKey === 0
			? publicKey
			: tokenOwners_tokenIdSent_newOwnerPublicKey;

	const tokenOwners_tokenIdSent_currentCommitment =
		tokenOwners_tokenIdSent_commitmentExists
			? generalise(tokenOwners_tokenIdSent_commitment._id)
			: generalise(0);
	const tokenOwners_tokenIdSent_prev = generalise(
		tokenOwners_tokenIdSent_preimage.value
	);
	const tokenOwners_tokenIdSent_prevSalt = generalise(
		tokenOwners_tokenIdSent_preimage.salt
	);

	// read preimage for whole state
	pendingStatus_newOwnerPublicKey =
		_pendingStatus_newOwnerPublicKey === 0
			? sharedPublicKey
			: pendingStatus_newOwnerPublicKey;

	const pendingStatus_currentCommitment = pendingStatus_commitmentExists
		? generalise(pendingStatus_commitment._id)
		: generalise(0);
	const pendingStatus_prev = generalise(pendingStatus_preimage.value);
	const pendingStatus_prevSalt = generalise(pendingStatus_preimage.salt);

	// read preimage for whole state
	swapProposals_sharedAddress_newOwnerPublicKey =
		_swapProposals_sharedAddress_newOwnerPublicKey === 0
			? sharedPublicKey
			: swapProposals_sharedAddress_newOwnerPublicKey;

	const swapProposals_sharedAddress_currentCommitment =
		swapProposals_sharedAddress_commitmentExists
			? generalise(swapProposals_sharedAddress_commitment._id)
			: generalise(0);
	const swapProposals_sharedAddress_prev = generalise(
		swapProposals_sharedAddress_preimage.value
	);
	const swapProposals_sharedAddress_prevSalt = generalise(
		swapProposals_sharedAddress_preimage.salt
	);

	// Extract set membership witness:

	// generate witness for whole state
	const tokenOwners_tokenIdSent_emptyPath = new Array(32).fill(0);
	const tokenOwners_tokenIdSent_witness =
		tokenOwners_tokenIdSent_witnessRequired
			? await getMembershipWitness(
					"SwapShield",
					tokenOwners_tokenIdSent_currentCommitment.integer
			  )
			: {
					index: 0,
					path: tokenOwners_tokenIdSent_emptyPath,
					root: (await getRoot("SwapShield")) || 0,
			  };
	const tokenOwners_tokenIdSent_index = generalise(
		tokenOwners_tokenIdSent_witness.index
	);
	const tokenOwners_tokenIdSent_root = generalise(
		tokenOwners_tokenIdSent_witness.root
	);
	const tokenOwners_tokenIdSent_path = generalise(
		tokenOwners_tokenIdSent_witness.path
	).all;

	// generate witness for whole state
	const pendingStatus_emptyPath = new Array(32).fill(0);
	const pendingStatus_witness = pendingStatus_witnessRequired
		? await getMembershipWitness(
				"SwapShield",
				pendingStatus_currentCommitment.integer
		  )
		: {
				index: 0,
				path: pendingStatus_emptyPath,
				root: (await getRoot("SwapShield")) || 0,
		  };
	const pendingStatus_index = generalise(pendingStatus_witness.index);
	const pendingStatus_root = generalise(pendingStatus_witness.root);
	const pendingStatus_path = generalise(pendingStatus_witness.path).all;

	// generate witness for whole state
	const swapProposals_sharedAddress_emptyPath = new Array(32).fill(0);
	const swapProposals_sharedAddress_witness =
		swapProposals_sharedAddress_witnessRequired
			? await getMembershipWitness(
					"SwapShield",
					swapProposals_sharedAddress_currentCommitment.integer
			  )
			: {
					index: 0,
					path: swapProposals_sharedAddress_emptyPath,
					root: (await getRoot("SwapShield")) || 0,
			  };
	const swapProposals_sharedAddress_index = generalise(
		swapProposals_sharedAddress_witness.index
	);
	const swapProposals_sharedAddress_root = generalise(
		swapProposals_sharedAddress_witness.root
	);
	const swapProposals_sharedAddress_path = generalise(
		swapProposals_sharedAddress_witness.path
	).all;

	let pendingStatus = generalise(pendingStatus_preimage.value);

	let swapProposals_sharedAddress = generalise(
		swapProposals_sharedAddress_preimage.value
	);

	swapProposals_sharedAddress.swapAmountSent = generalise(
		parseInt(swapProposals_sharedAddress.swapAmountSent.integer, 10) -
			parseInt(amountSent.integer, 10)
	);

	swapProposals_sharedAddress = generalise(swapProposals_sharedAddress);

	// increment would go here but has been filtered out

	let tokenOwners_tokenIdSent = generalise(msgSender.integer);

	tokenOwners_tokenIdSent = generalise(tokenOwners_tokenIdSent);

	swapProposals_sharedAddress.swapTokenSent = generalise(0);

	swapProposals_sharedAddress = generalise(swapProposals_sharedAddress);

	swapProposals_sharedAddress.swapTokenRecieved = generalise(0);

	swapProposals_sharedAddress = generalise(swapProposals_sharedAddress);

	swapProposals_sharedAddress.swapAmountRecieved = generalise(0);

	swapProposals_sharedAddress = generalise(swapProposals_sharedAddress);

	pendingStatus = generalise(0);

	pendingStatus = generalise(pendingStatus);

	// Calculate nullifier(s):

	let tokenOwners_tokenIdSent_nullifier =
		tokenOwners_tokenIdSent_commitmentExists
			? poseidonHash([
					BigInt(tokenOwners_tokenIdSent_stateVarId),
					BigInt(secretKey.hex(32)),
					BigInt(tokenOwners_tokenIdSent_prevSalt.hex(32)),
			  ])
			: poseidonHash([
					BigInt(tokenOwners_tokenIdSent_stateVarId),
					BigInt(generalise(0).hex(32)),
					BigInt(tokenOwners_tokenIdSent_prevSalt.hex(32)),
			  ]);

	tokenOwners_tokenIdSent_nullifier = generalise(
		tokenOwners_tokenIdSent_nullifier.hex(32)
	); // truncate
	// Non-membership witness for Nullifier
	const tokenOwners_tokenIdSent_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(tokenOwners_tokenIdSent_nullifier);

	const tokenOwners_tokenIdSent_nullifierRoot = generalise(
		tokenOwners_tokenIdSent_nullifier_NonMembership_witness.root
	);
	const tokenOwners_tokenIdSent_nullifier_path = generalise(
		tokenOwners_tokenIdSent_nullifier_NonMembership_witness.path
	).all;

	let pendingStatus_nullifier = pendingStatus_commitmentExists
		? poseidonHash([
				BigInt(pendingStatus_stateVarId),
				BigInt(sharedSecretKey.hex(32)),
				BigInt(pendingStatus_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(pendingStatus_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(pendingStatus_prevSalt.hex(32)),
		  ]);

	pendingStatus_nullifier = generalise(pendingStatus_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const pendingStatus_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(pendingStatus_nullifier);

	const pendingStatus_nullifierRoot = generalise(
		pendingStatus_nullifier_NonMembership_witness.root
	);
	const pendingStatus_nullifier_path = generalise(
		pendingStatus_nullifier_NonMembership_witness.path
	).all;

	let swapProposals_sharedAddress_nullifier =
		swapProposals_sharedAddress_commitmentExists
			? poseidonHash([
					BigInt(swapProposals_sharedAddress_stateVarId),
					BigInt(sharedSecretKey.hex(32)),
					BigInt(swapProposals_sharedAddress_prevSalt.hex(32)),
			  ])
			: poseidonHash([
					BigInt(swapProposals_sharedAddress_stateVarId),
					BigInt(generalise(0).hex(32)),
					BigInt(swapProposals_sharedAddress_prevSalt.hex(32)),
			  ]);

	swapProposals_sharedAddress_nullifier = generalise(
		swapProposals_sharedAddress_nullifier.hex(32)
	); // truncate
	// Non-membership witness for Nullifier
	const swapProposals_sharedAddress_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(swapProposals_sharedAddress_nullifier);

	const swapProposals_sharedAddress_nullifierRoot = generalise(
		swapProposals_sharedAddress_nullifier_NonMembership_witness.root
	);
	const swapProposals_sharedAddress_nullifier_path = generalise(
		swapProposals_sharedAddress_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(tokenOwners_tokenIdSent_nullifier);

	await temporaryUpdateNullifier(pendingStatus_nullifier);

	await temporaryUpdateNullifier(swapProposals_sharedAddress_nullifier);

	// Get the new updated nullifier Paths
	const tokenOwners_tokenIdSent_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(tokenOwners_tokenIdSent_nullifier);
	const tokenOwners_tokenIdSent_nullifier_updatedpath = generalise(
		tokenOwners_tokenIdSent_updated_nullifier_NonMembership_witness.path
	).all;
	const tokenOwners_tokenIdSent_newNullifierRoot = generalise(
		tokenOwners_tokenIdSent_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const pendingStatus_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(pendingStatus_nullifier);
	const pendingStatus_nullifier_updatedpath = generalise(
		pendingStatus_updated_nullifier_NonMembership_witness.path
	).all;
	const pendingStatus_newNullifierRoot = generalise(
		pendingStatus_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const swapProposals_sharedAddress_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(swapProposals_sharedAddress_nullifier);
	const swapProposals_sharedAddress_nullifier_updatedpath = generalise(
		swapProposals_sharedAddress_updated_nullifier_NonMembership_witness.path
	).all;
	const swapProposals_sharedAddress_newNullifierRoot = generalise(
		swapProposals_sharedAddress_updated_nullifier_NonMembership_witness.root
	);

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

	const tokenOwners_tokenIdSent_newSalt = generalise(utils.randomHex(31));

	let tokenOwners_tokenIdSent_newCommitment = poseidonHash([
		BigInt(tokenOwners_tokenIdSent_stateVarId),
		BigInt(tokenOwners_tokenIdSent.hex(32)),
		BigInt(tokenOwners_tokenIdSent_newOwnerPublicKey.hex(32)),
		BigInt(tokenOwners_tokenIdSent_newSalt.hex(32)),
	]);

	tokenOwners_tokenIdSent_newCommitment = generalise(
		tokenOwners_tokenIdSent_newCommitment.hex(32)
	); // truncate

	const pendingStatus_newSalt = generalise(utils.randomHex(31));

	let pendingStatus_newCommitment = poseidonHash([
		BigInt(pendingStatus_stateVarId),
		BigInt(pendingStatus.hex(32)),
		BigInt(pendingStatus_newOwnerPublicKey.hex(32)),
		BigInt(pendingStatus_newSalt.hex(32)),
	]);

	pendingStatus_newCommitment = generalise(pendingStatus_newCommitment.hex(32)); // truncate

	swapProposals_sharedAddress.swapAmountSent =
		swapProposals_sharedAddress.swapAmountSent
			? swapProposals_sharedAddress.swapAmountSent
			: swapProposals_sharedAddress_prev.swapAmountSent;
	swapProposals_sharedAddress.swapAmountRecieved =
		swapProposals_sharedAddress.swapAmountRecieved
			? swapProposals_sharedAddress.swapAmountRecieved
			: swapProposals_sharedAddress_prev.swapAmountRecieved;
	swapProposals_sharedAddress.swapTokenSent =
		swapProposals_sharedAddress.swapTokenSent
			? swapProposals_sharedAddress.swapTokenSent
			: swapProposals_sharedAddress_prev.swapTokenSent;
	swapProposals_sharedAddress.swapTokenRecieved =
		swapProposals_sharedAddress.swapTokenRecieved
			? swapProposals_sharedAddress.swapTokenRecieved
			: swapProposals_sharedAddress_prev.swapTokenRecieved;

	const swapProposals_sharedAddress_newSalt = generalise(utils.randomHex(31));

	let swapProposals_sharedAddress_newCommitment = poseidonHash([
		BigInt(swapProposals_sharedAddress_stateVarId),
		BigInt(swapProposals_sharedAddress.swapAmountSent.hex(32)),
		BigInt(swapProposals_sharedAddress.swapAmountRecieved.hex(32)),
		BigInt(swapProposals_sharedAddress.swapTokenSent.hex(32)),
		BigInt(swapProposals_sharedAddress.swapTokenRecieved.hex(32)),
		BigInt(swapProposals_sharedAddress_newOwnerPublicKey.hex(32)),
		BigInt(swapProposals_sharedAddress_newSalt.hex(32)),
	]);

	swapProposals_sharedAddress_newCommitment = generalise(
		swapProposals_sharedAddress_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		sharedAddress.integer,
		amountSent.integer,
		tokenIdSent.integer,
		balances_msgSender_newOwnerPublicKey.integer,
		balances_msgSender_newSalt.integer,
		balances_msgSender_newCommitment.integer,

		tokenOwners_tokenIdSent_commitmentExists
			? secretKey.integer
			: generalise(0).integer,
		tokenOwners_tokenIdSent_nullifierRoot.integer,
		tokenOwners_tokenIdSent_newNullifierRoot.integer,
		tokenOwners_tokenIdSent_nullifier.integer,
		tokenOwners_tokenIdSent_nullifier_path.integer,
		tokenOwners_tokenIdSent_nullifier_updatedpath.integer,
		tokenOwners_tokenIdSent_prev.integer,
		tokenOwners_tokenIdSent_prevSalt.integer,
		tokenOwners_tokenIdSent_commitmentExists ? 0 : 1,
		tokenOwners_tokenIdSent_root.integer,
		tokenOwners_tokenIdSent_index.integer,
		tokenOwners_tokenIdSent_path.integer,
		tokenOwners_tokenIdSent_newOwnerPublicKey.integer,
		tokenOwners_tokenIdSent_newSalt.integer,
		tokenOwners_tokenIdSent_newCommitment.integer,
		pendingStatus_commitmentExists
			? sharedSecretKey.integer
			: generalise(0).integer,

		pendingStatus_nullifier.integer,
		pendingStatus_nullifier_path.integer,
		pendingStatus_nullifier_updatedpath.integer,
		pendingStatus_prev.integer,
		pendingStatus_prevSalt.integer,
		pendingStatus_commitmentExists ? 0 : 1,

		pendingStatus_index.integer,
		pendingStatus_path.integer,
		pendingStatus_newOwnerPublicKey.integer,
		pendingStatus_newSalt.integer,
		pendingStatus_newCommitment.integer,
		swapProposals_sharedAddress_commitmentExists
			? sharedSecretKey.integer
			: generalise(0).integer,

		swapProposals_sharedAddress_nullifier.integer,
		swapProposals_sharedAddress_nullifier_path.integer,
		swapProposals_sharedAddress_nullifier_updatedpath.integer,
		swapProposals_sharedAddress_prev.swapAmountSent.integer,
		swapProposals_sharedAddress_prev.swapAmountRecieved.integer,
		swapProposals_sharedAddress_prev.swapTokenSent.integer,
		swapProposals_sharedAddress_prev.swapTokenRecieved.integer,
		swapProposals_sharedAddress_prevSalt.integer,
		swapProposals_sharedAddress_commitmentExists ? 0 : 1,

		swapProposals_sharedAddress_index.integer,
		swapProposals_sharedAddress_path.integer,
		swapProposals_sharedAddress_newOwnerPublicKey.integer,
		swapProposals_sharedAddress_newSalt.integer,
		swapProposals_sharedAddress_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("quitSwap", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.quitSwap(
			tokenOwners_tokenIdSent_nullifierRoot.integer,
			tokenOwners_tokenIdSent_newNullifierRoot.integer,
			[
				tokenOwners_tokenIdSent_nullifier.integer,
				pendingStatus_nullifier.integer,
				swapProposals_sharedAddress_nullifier.integer,
			],
			tokenOwners_tokenIdSent_root.integer,
			[
				balances_msgSender_newCommitment.integer,
				tokenOwners_tokenIdSent_newCommitment.integer,
				pendingStatus_newCommitment.integer,
				swapProposals_sharedAddress_newCommitment.integer,
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

	if (tokenOwners_tokenIdSent_commitmentExists)
		await markNullified(
			tokenOwners_tokenIdSent_currentCommitment,
			secretKey.hex(32)
		);

	await storeCommitment({
		hash: tokenOwners_tokenIdSent_newCommitment,
		name: "tokenOwners",
		mappingKey: tokenOwners_tokenIdSent_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(tokenOwners_tokenIdSent_stateVarId),
			value: tokenOwners_tokenIdSent,
			salt: tokenOwners_tokenIdSent_newSalt,
			publicKey: tokenOwners_tokenIdSent_newOwnerPublicKey,
		},
		secretKey:
			tokenOwners_tokenIdSent_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	if (pendingStatus_commitmentExists)
		await markNullified(pendingStatus_currentCommitment, secretKey.hex(32));

	await storeCommitment({
		hash: pendingStatus_newCommitment,
		name: "pendingStatus",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(pendingStatus_stateVarId),
			value: pendingStatus,
			salt: pendingStatus_newSalt,
			publicKey: pendingStatus_newOwnerPublicKey,
		},
		secretKey:
			pendingStatus_newOwnerPublicKey.integer === sharedPublicKey.integer
				? sharedSecretKey
				: null,
		isNullified: false,
	});

	if (swapProposals_sharedAddress_commitmentExists)
		await markNullified(
			swapProposals_sharedAddress_currentCommitment,
			secretKey.hex(32)
		);

	await storeCommitment({
		hash: swapProposals_sharedAddress_newCommitment,
		name: "swapProposals",
		mappingKey: swapProposals_sharedAddress_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(swapProposals_sharedAddress_stateVarId),
			value: {
				swapAmountSent: swapProposals_sharedAddress.swapAmountSent,
				swapAmountRecieved: swapProposals_sharedAddress.swapAmountRecieved,
				swapTokenSent: swapProposals_sharedAddress.swapTokenSent,
				swapTokenRecieved: swapProposals_sharedAddress.swapTokenRecieved,
			},
			salt: swapProposals_sharedAddress_newSalt,
			publicKey: swapProposals_sharedAddress_newOwnerPublicKey,
		},
		secretKey:
			swapProposals_sharedAddress_newOwnerPublicKey.integer ===
			sharedPublicKey.integer
				? sharedSecretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
