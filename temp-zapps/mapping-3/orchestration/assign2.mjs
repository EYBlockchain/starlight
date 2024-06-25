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

export default async function assign2(
	_param3,
	_a_msgSender_newOwnerPublicKey = 0,
	_b_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const contract = new Contract("MyContractShield");

	await contract.init();

	const instance = contract.getInstance();

	if (!instance) {
		throw new Error("Contract instance is not initialized");
	}

	const contractAddr = await contract.getContractAddress();

	const msgValue = 0;
	const param3 = generalise(_param3);
	let a_msgSender_newOwnerPublicKey = generalise(
		_a_msgSender_newOwnerPublicKey
	);
	let b_newOwnerPublicKey = generalise(_b_newOwnerPublicKey);

	// Initialize the contract

	const contract = new Contract("MyContractShield");

	await contract.init();

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await contract.registerKey(utils.randomHex(31), "MyContractShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	const b_stateVarId = generalise(7).hex(32);

	let b_commitmentExists = true;
	let b_witnessRequired = true;

	const b_commitment = await getCurrentWholeCommitment(b_stateVarId);

	let b_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!b_commitment) {
		b_commitmentExists = false;
		b_witnessRequired = false;
	} else {
		b_preimage = b_commitment.preimage;
	}

	// read preimage for incremented state
	a_msgSender_newOwnerPublicKey =
		_a_msgSender_newOwnerPublicKey === 0
			? publicKey
			: a_msgSender_newOwnerPublicKey;

	let a_msgSender_stateVarId = 5;

	const a_msgSender_stateVarId_key = generalise(
		config.web3.options.defaultAccount
	); // emulates msg.sender

	a_msgSender_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(a_msgSender_stateVarId).bigInt,
				a_msgSender_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	const a_msgSender_newCommitmentValue = generalise(
		parseInt(param3.integer, 10)
	);

	// read preimage for whole state
	b_newOwnerPublicKey =
		_b_newOwnerPublicKey === 0
			? generalise(
					await instance.methods
						.zkpPublicKeys(await instance.methods.admin().call())
						.call()
			  )
			: b_newOwnerPublicKey;

	const b_currentCommitment = b_commitmentExists
		? generalise(b_commitment._id)
		: generalise(0);
	const b_prev = generalise(b_preimage.value);
	const b_prevSalt = generalise(b_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const b_emptyPath = new Array(32).fill(0);
	const b_witness = b_witnessRequired
		? await getMembershipWitness(
				"MyContractShield",
				b_currentCommitment.integer
		  )
		: {
				index: 0,
				path: b_emptyPath,
				root: (await getRoot("MyContractShield")) || 0,
		  };
	const b_index = generalise(b_witness.index);
	const b_root = generalise(b_witness.root);
	const b_path = generalise(b_witness.path).all;

	// increment would go here but has been filtered out

	let b = generalise(b_preimage.value);
	b = generalise(parseInt(b.integer, 10) + parseInt(param3.integer, 10));

	b = generalise(b);

	// Calculate nullifier(s):

	let b_nullifier = b_commitmentExists
		? poseidonHash([
				BigInt(b_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(b_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(b_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(b_prevSalt.hex(32)),
		  ]);
	let b_nullifier = b_commitmentExists
		? poseidonHash([
				BigInt(b_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(b_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(b_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(b_prevSalt.hex(32)),
		  ]);

	b_nullifier = generalise(b_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const b_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		b_nullifier
	);

	const b_nullifierRoot = generalise(b_nullifier_NonMembership_witness.root);
	const b_nullifier_path = generalise(b_nullifier_NonMembership_witness.path)
		.all;

	await temporaryUpdateNullifier(b_nullifier);

	// Get the new updated nullifier Paths
	const b_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		b_nullifier
	);
	const b_nullifier_updatedpath = generalise(
		b_updated_nullifier_NonMembership_witness.path
	).all;
	const b_newNullifierRoot = generalise(
		b_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const a_msgSender_newSalt = generalise(utils.randomHex(31));

	let a_msgSender_newCommitment = poseidonHash([
		BigInt(a_msgSender_stateVarId),
		BigInt(a_msgSender_newCommitmentValue.hex(32)),
		BigInt(a_msgSender_newOwnerPublicKey.hex(32)),
		BigInt(a_msgSender_newSalt.hex(32)),
	]);

	a_msgSender_newCommitment = generalise(a_msgSender_newCommitment.hex(32)); // truncate

	const b_newSalt = generalise(utils.randomHex(31));

	let b_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b.hex(32)),
		BigInt(b_newOwnerPublicKey.hex(32)),
		BigInt(b_newSalt.hex(32)),
	]);

	b_newCommitment = generalise(b_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param3.integer,
		a_msgSender_stateVarId_key.integer,
		a_msgSender_newOwnerPublicKey.integer,
		a_msgSender_newSalt.integer,
		a_msgSender_newCommitment.integer,

		b_commitmentExists ? secretKey.integer : generalise(0).integer,
		b_commitmentExists ? secretKey.integer : generalise(0).integer,
		b_nullifierRoot.integer,
		b_newNullifierRoot.integer,
		b_newNullifierRoot.integer,
		b_nullifier.integer,
		b_nullifier_path.integer,
		b_nullifier_updatedpath.integer,
		b_prev.integer,
		b_prevSalt.integer,
		b_commitmentExists ? 0 : 1,
		b_root.integer,
		b_index.integer,
		b_path.integer,
		b_newOwnerPublicKey.integer,
		b_newSalt.integer,
		b_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("assign2", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.assign2(
			b_nullifierRoot.integer,
			b_newNullifierRoot.integer,
			[b_nullifier.integer],
			b_root.integer,
			[a_msgSender_newCommitment.integer, b_newCommitment.integer],
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
		hash: a_msgSender_newCommitment,
		name: "a",
		mappingKey: a_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(a_msgSender_stateVarId),
			value: a_msgSender_newCommitmentValue,
			salt: a_msgSender_newSalt,
			publicKey: a_msgSender_newOwnerPublicKey,
		},
		secretKey:
			a_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		secretKey:
			a_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	if (b_commitmentExists)
		await markNullified(b_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	if (b_commitmentExists)
		await markNullified(b_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: b_newCommitment,
		name: "b",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(b_stateVarId),
			value: b,
			salt: b_newSalt,
			publicKey: b_newOwnerPublicKey,
		},
		secretKey:
			b_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		secretKey:
			b_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
