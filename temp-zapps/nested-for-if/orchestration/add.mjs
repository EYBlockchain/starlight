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
	_j,
	_iterate,
	_total_newOwnerPublicKey = 0,
	_structs_msgSender_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("TestShield");

	const contractAddr = await getContractAddress("TestShield");

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	const j = generalise(_j);
	const iterate = generalise(_iterate);
	let total_newOwnerPublicKey = generalise(_total_newOwnerPublicKey);
	let structs_msgSender_newOwnerPublicKey = generalise(
		_structs_msgSender_newOwnerPublicKey
	);

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

	const total_stateVarId = generalise(3).hex(32);

	let total_commitmentExists = true;
	let total_witnessRequired = true;

	const total_commitment = await getCurrentWholeCommitment(total_stateVarId);

	let total_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!total_commitment) {
		total_commitmentExists = false;
		total_witnessRequired = false;
	} else {
		total_preimage = total_commitment.preimage;
	}

	// Initialise commitment preimage of whole state:

	let structs_msgSender_stateVarId = 8;

	const structs_msgSender_stateVarId_key = generalise(
		config.web3.options.defaultAccount
	); // emulates msg.sender

	structs_msgSender_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(structs_msgSender_stateVarId).bigInt,
				structs_msgSender_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let structs_msgSender_commitmentExists = true;
	let structs_msgSender_witnessRequired = true;

	const structs_msgSender_commitment = await getCurrentWholeCommitment(
		structs_msgSender_stateVarId
	);

	let structs_msgSender_preimage = {
		value: { a: 0, b: 0, c: 0 },
		salt: 0,
		commitment: 0,
	};
	if (!structs_msgSender_commitment) {
		structs_msgSender_commitmentExists = false;
		structs_msgSender_witnessRequired = false;
	} else {
		structs_msgSender_preimage = structs_msgSender_commitment.preimage;
	}

	// read preimage for whole state
	total_newOwnerPublicKey =
		_total_newOwnerPublicKey === 0 ? publicKey : total_newOwnerPublicKey;

	const total_currentCommitment = total_commitmentExists
		? generalise(total_commitment._id)
		: generalise(0);
	const total_prev = generalise(total_preimage.value);
	const total_prevSalt = generalise(total_preimage.salt);

	// read preimage for whole state
	structs_msgSender_newOwnerPublicKey =
		_structs_msgSender_newOwnerPublicKey === 0
			? publicKey
			: structs_msgSender_newOwnerPublicKey;

	const structs_msgSender_currentCommitment = structs_msgSender_commitmentExists
		? generalise(structs_msgSender_commitment._id)
		: generalise(0);
	const structs_msgSender_prev = generalise(structs_msgSender_preimage.value);
	const structs_msgSender_prevSalt = generalise(
		structs_msgSender_preimage.salt
	);

	// Extract set membership witness:

	// generate witness for whole state
	const total_emptyPath = new Array(32).fill(0);
	const total_witness = total_witnessRequired
		? await getMembershipWitness("TestShield", total_currentCommitment.integer)
		: {
				index: 0,
				path: total_emptyPath,
				root: (await getRoot("TestShield")) || 0,
		  };
	const total_index = generalise(total_witness.index);
	const total_root = generalise(total_witness.root);
	const total_path = generalise(total_witness.path).all;

	// generate witness for whole state
	const structs_msgSender_emptyPath = new Array(32).fill(0);
	const structs_msgSender_witness = structs_msgSender_witnessRequired
		? await getMembershipWitness(
				"TestShield",
				structs_msgSender_currentCommitment.integer
		  )
		: {
				index: 0,
				path: structs_msgSender_emptyPath,
				root: (await getRoot("TestShield")) || 0,
		  };
	const structs_msgSender_index = generalise(structs_msgSender_witness.index);
	const structs_msgSender_root = generalise(structs_msgSender_witness.root);
	const structs_msgSender_path = generalise(structs_msgSender_witness.path).all;

	let structs_msgSender = generalise(structs_msgSender_preimage.value);

	let total = generalise(total_preimage.value);

	// non-secret line would go here but has been filtered out

	for (let i = 0; i < 5; i++) {
		if (!(parseInt(iterate.integer, 10) === 0) == true) {
			total = generalise(parseInt(total.integer, 10) + parseInt(j.integer, 10));
			total = generalise(total);

			structs_msgSender.a = generalise(5 * parseInt(j.integer, 10));
			structs_msgSender = generalise(structs_msgSender);

			structs_msgSender.b = generalise(parseInt(total.integer, 10));
			structs_msgSender = generalise(structs_msgSender);

			structs_msgSender.c = generalise(msgSender.integer);
			structs_msgSender = generalise(structs_msgSender);
		}
	}

	total = generalise(total);

	structs_msgSender = generalise(structs_msgSender);

	structs_msgSender = generalise(structs_msgSender);

	structs_msgSender = generalise(structs_msgSender);

	if (!(parseInt(iterate.integer, 10) === 0) == false) {
		total = generalise(parseInt(j.integer, 10));

		structs_msgSender.a = generalise(parseInt(j.integer, 10));

		structs_msgSender.b = generalise(parseInt(total.integer, 10));

		structs_msgSender.c = generalise(msgSender.integer);
	}

	total = generalise(total);

	structs_msgSender = generalise(structs_msgSender);

	structs_msgSender = generalise(structs_msgSender);

	structs_msgSender = generalise(structs_msgSender);

	// Calculate nullifier(s):

	let total_nullifier = total_commitmentExists
		? poseidonHash([
				BigInt(total_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(total_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(total_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(total_prevSalt.hex(32)),
		  ]);

	total_nullifier = generalise(total_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const total_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		total_nullifier
	);

	const total_nullifierRoot = generalise(
		total_nullifier_NonMembership_witness.root
	);
	const total_nullifier_path = generalise(
		total_nullifier_NonMembership_witness.path
	).all;

	let structs_msgSender_nullifier = structs_msgSender_commitmentExists
		? poseidonHash([
				BigInt(structs_msgSender_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(structs_msgSender_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(structs_msgSender_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(structs_msgSender_prevSalt.hex(32)),
		  ]);

	structs_msgSender_nullifier = generalise(structs_msgSender_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const structs_msgSender_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		structs_msgSender_nullifier
	);

	const structs_msgSender_nullifierRoot = generalise(
		structs_msgSender_nullifier_NonMembership_witness.root
	);
	const structs_msgSender_nullifier_path = generalise(
		structs_msgSender_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(total_nullifier);

	await temporaryUpdateNullifier(structs_msgSender_nullifier);

	// Get the new updated nullifier Paths
	const total_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		total_nullifier
	);
	const total_nullifier_updatedpath = generalise(
		total_updated_nullifier_NonMembership_witness.path
	).all;
	const total_newNullifierRoot = generalise(
		total_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const structs_msgSender_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		structs_msgSender_nullifier
	);
	const structs_msgSender_nullifier_updatedpath = generalise(
		structs_msgSender_updated_nullifier_NonMembership_witness.path
	).all;
	const structs_msgSender_newNullifierRoot = generalise(
		structs_msgSender_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const total_newSalt = generalise(utils.randomHex(31));

	let total_newCommitment = poseidonHash([
		BigInt(total_stateVarId),
		BigInt(total.hex(32)),
		BigInt(total_newOwnerPublicKey.hex(32)),
		BigInt(total_newSalt.hex(32)),
	]);

	total_newCommitment = generalise(total_newCommitment.hex(32)); // truncate

	structs_msgSender.a = structs_msgSender.a
		? structs_msgSender.a
		: structs_msgSender_prev.a;
	structs_msgSender.b = structs_msgSender.b
		? structs_msgSender.b
		: structs_msgSender_prev.b;
	structs_msgSender.c = structs_msgSender.c
		? structs_msgSender.c
		: structs_msgSender_prev.c;

	const structs_msgSender_newSalt = generalise(utils.randomHex(31));

	let structs_msgSender_newCommitment = poseidonHash([
		BigInt(structs_msgSender_stateVarId),
		BigInt(structs_msgSender.a.hex(32)),
		BigInt(structs_msgSender.b.hex(32)),
		BigInt(structs_msgSender.c.hex(32)),
		BigInt(structs_msgSender_newOwnerPublicKey.hex(32)),
		BigInt(structs_msgSender_newSalt.hex(32)),
	]);

	structs_msgSender_newCommitment = generalise(
		structs_msgSender_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		j.integer,
		iterate.integer,
		total_commitmentExists ? secretKey.integer : generalise(0).integer,
		total_nullifierRoot.integer,
		total_newNullifierRoot.integer,
		total_nullifier.integer,
		total_nullifier_path.integer,
		total_nullifier_updatedpath.integer,
		total_prev.integer,
		total_prevSalt.integer,
		total_commitmentExists ? 0 : 1,
		total_root.integer,
		total_index.integer,
		total_path.integer,
		total_newOwnerPublicKey.integer,
		total_newSalt.integer,
		total_newCommitment.integer,
		structs_msgSender_commitmentExists
			? secretKey.integer
			: generalise(0).integer,

		structs_msgSender_nullifier.integer,
		structs_msgSender_nullifier_path.integer,
		structs_msgSender_nullifier_updatedpath.integer,
		structs_msgSender_prev.a.integer,
		structs_msgSender_prev.b.integer,
		structs_msgSender_prev.c.integer,
		structs_msgSender_prevSalt.integer,
		structs_msgSender_commitmentExists ? 0 : 1,

		structs_msgSender_index.integer,
		structs_msgSender_path.integer,
		structs_msgSender_newOwnerPublicKey.integer,
		structs_msgSender_newSalt.integer,
		structs_msgSender_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			total_nullifierRoot.integer,
			total_newNullifierRoot.integer,
			[total_nullifier.integer, structs_msgSender_nullifier.integer],
			total_root.integer,
			[total_newCommitment.integer, structs_msgSender_newCommitment.integer],
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

	if (total_commitmentExists)
		await markNullified(total_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: total_newCommitment,
		name: "total",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(total_stateVarId),
			value: total,
			salt: total_newSalt,
			publicKey: total_newOwnerPublicKey,
		},
		secretKey:
			total_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	if (structs_msgSender_commitmentExists)
		await markNullified(structs_msgSender_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: structs_msgSender_newCommitment,
		name: "structs",
		mappingKey: structs_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(structs_msgSender_stateVarId),
			value: {
				a: structs_msgSender.a,
				b: structs_msgSender.b,
				c: structs_msgSender.c,
			},
			salt: structs_msgSender_newSalt,
			publicKey: structs_msgSender_newOwnerPublicKey,
		},
		secretKey:
			structs_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
