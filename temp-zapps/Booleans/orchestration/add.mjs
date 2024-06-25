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

export default async function add(
	_value,
	_value_bool,
	_value_publicbool,
	_a_newOwnerPublicKey = 0,
	_c_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const contract = new Contract("AssignShield");

	await contract.init();

	const instance = contract.getInstance();

	if (!instance) {
		throw new Error("Contract instance is not initialized");
	}

	const contractAddr = await contract.getContractAddress();

	const msgValue = 0;
	const value = generalise(_value);
	const value_bool = generalise(_value_bool);
	const value_publicbool = generalise(_value_publicbool);
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
	let c_newOwnerPublicKey = generalise(_c_newOwnerPublicKey);

	// Initialize the contract

	const contract = new Contract("AssignShield");

	await contract.init();

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await contract.registerKey(utils.randomHex(31), "AssignShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	let d = generalise(await instance.methods.d().call());
	let d_init = d;

	d = generalise(d_init);

	// Initialise commitment preimage of whole state:

	const a_stateVarId = generalise(3).hex(32);

	let a_commitmentExists = true;
	let a_witnessRequired = true;

	const a_commitment = await getCurrentWholeCommitment(a_stateVarId);

	let a_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!a_commitment) {
		a_commitmentExists = false;
		a_witnessRequired = false;
	} else {
		a_preimage = a_commitment.preimage;
	}

	// Initialise commitment preimage of whole state:

	const c_stateVarId = generalise(5).hex(32);

	let c_commitmentExists = true;
	let c_witnessRequired = true;

	const c_commitment = await getCurrentWholeCommitment(c_stateVarId);

	let c_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!c_commitment) {
		c_commitmentExists = false;
		c_witnessRequired = false;
	} else {
		c_preimage = c_commitment.preimage;
	}

	// read preimage for whole state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_currentCommitment = a_commitmentExists
		? generalise(a_commitment._id)
		: generalise(0);
	const a_prev = generalise(a_preimage.value);
	const a_prevSalt = generalise(a_preimage.salt);

	// read preimage for whole state
	c_newOwnerPublicKey =
		_c_newOwnerPublicKey === 0 ? publicKey : c_newOwnerPublicKey;

	const c_currentCommitment = c_commitmentExists
		? generalise(c_commitment._id)
		: generalise(0);
	const c_prev = generalise(c_preimage.value);
	const c_prevSalt = generalise(c_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const a_emptyPath = new Array(32).fill(0);
	const a_witness = a_witnessRequired
		? await getMembershipWitness("AssignShield", a_currentCommitment.integer)
		: {
				index: 0,
				path: a_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const a_index = generalise(a_witness.index);
	const a_root = generalise(a_witness.root);
	const a_path = generalise(a_witness.path).all;

	// generate witness for whole state
	const c_emptyPath = new Array(32).fill(0);
	const c_witness = c_witnessRequired
		? await getMembershipWitness("AssignShield", c_currentCommitment.integer)
		: {
				index: 0,
				path: c_emptyPath,
				root: (await getRoot("AssignShield")) || 0,
		  };
	const c_index = generalise(c_witness.index);
	const c_root = generalise(c_witness.root);
	const c_path = generalise(c_witness.path).all;

	let a = generalise(a_preimage.value);

	let l = generalise(true);

	let m = generalise(false);

	let c = generalise(
		!(parseInt(a.integer, 10) === 0) &&
			!(parseInt(m.integer, 10) === 0) &&
			!(parseInt(d.integer, 10) === 0)
	);

	c = generalise(c);

	if (parseInt(value.integer, 10) > 10 && !(parseInt(c.integer, 10) === 1)) {
		c = generalise(true);

		a = generalise(
			!(parseInt(value_bool.integer, 10) === 0) &&
				!(parseInt(value_publicbool.integer, 10) === 0)
		);
	}

	c = generalise(c);

	a = generalise(a);

	if (parseInt(value.integer, 10) < 10) {
		a = generalise(!(parseInt(c.integer, 10) === 1));

		c = generalise(
			!(parseInt(l.integer, 10) === 0) ||
				!(parseInt(a.integer, 10) === 0) ||
				!(parseInt(m.integer, 10) === 0)
		);
	}

	a = generalise(a);

	c = generalise(c);

	// Calculate nullifier(s):

	let a_nullifier = a_commitmentExists
		? poseidonHash([
				BigInt(a_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(a_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(a_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(a_prevSalt.hex(32)),
		  ]);
	let a_nullifier = a_commitmentExists
		? poseidonHash([
				BigInt(a_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(a_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(a_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(a_prevSalt.hex(32)),
		  ]);

	a_nullifier = generalise(a_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const a_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		a_nullifier
	);

	const a_nullifierRoot = generalise(a_nullifier_NonMembership_witness.root);
	const a_nullifier_path = generalise(a_nullifier_NonMembership_witness.path)
		.all;

	let c_nullifier = c_commitmentExists
		? poseidonHash([
				BigInt(c_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(c_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(c_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(c_prevSalt.hex(32)),
		  ]);
	let c_nullifier = c_commitmentExists
		? poseidonHash([
				BigInt(c_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(c_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(c_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(c_prevSalt.hex(32)),
		  ]);

	c_nullifier = generalise(c_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const c_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		c_nullifier
	);

	const c_nullifierRoot = generalise(c_nullifier_NonMembership_witness.root);
	const c_nullifier_path = generalise(c_nullifier_NonMembership_witness.path)
		.all;

	await temporaryUpdateNullifier(a_nullifier);

	await temporaryUpdateNullifier(c_nullifier);

	// Get the new updated nullifier Paths
	const a_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		a_nullifier
	);
	const a_nullifier_updatedpath = generalise(
		a_updated_nullifier_NonMembership_witness.path
	).all;
	const a_newNullifierRoot = generalise(
		a_updated_nullifier_NonMembership_witness.root
	);

	// Get the new updated nullifier Paths
	const c_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		c_nullifier
	);
	const c_nullifier_updatedpath = generalise(
		c_updated_nullifier_NonMembership_witness.path
	).all;
	const c_newNullifierRoot = generalise(
		c_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const a_newSalt = generalise(utils.randomHex(31));

	let a_newCommitment = poseidonHash([
		BigInt(a_stateVarId),
		BigInt(a.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	const c_newSalt = generalise(utils.randomHex(31));

	let c_newCommitment = poseidonHash([
		BigInt(c_stateVarId),
		BigInt(c.hex(32)),
		BigInt(c_newOwnerPublicKey.hex(32)),
		BigInt(c_newSalt.hex(32)),
	]);

	c_newCommitment = generalise(c_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		value.integer,
		value_bool.integer,
		value_publicbool.integer,
		d.integer,
		a_commitmentExists ? secretKey.integer : generalise(0).integer,
		a_commitmentExists ? secretKey.integer : generalise(0).integer,
		a_nullifierRoot.integer,
		a_newNullifierRoot.integer,
		a_newNullifierRoot.integer,
		a_nullifier.integer,
		a_nullifier_path.integer,
		a_nullifier_updatedpath.integer,
		a_prev.integer,
		a_prevSalt.integer,
		a_commitmentExists ? 0 : 1,
		a_root.integer,
		a_index.integer,
		a_path.integer,
		a_newOwnerPublicKey.integer,
		a_newSalt.integer,
		a_newCommitment.integer,
		c_commitmentExists ? secretKey.integer : generalise(0).integer,
		c_commitmentExists ? secretKey.integer : generalise(0).integer,

		c_nullifier.integer,
		c_nullifier_path.integer,
		c_nullifier_updatedpath.integer,
		c_prev.integer,
		c_prevSalt.integer,
		c_commitmentExists ? 0 : 1,

		c_index.integer,
		c_path.integer,
		c_newOwnerPublicKey.integer,
		c_newSalt.integer,
		c_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("add", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.add(
			parseInt(value_publicbool.integer, 10) === 1 ? true : false,
			a_nullifierRoot.integer,
			a_newNullifierRoot.integer,
			[a_nullifier.integer, c_nullifier.integer],
			a_root.integer,
			[a_newCommitment.integer, c_newCommitment.integer],
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

	if (a_commitmentExists)
		await markNullified(a_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	if (a_commitmentExists)
		await markNullified(a_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: a_newCommitment,
		name: "a",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(a_stateVarId),
			value: a,
			salt: a_newSalt,
			publicKey: a_newOwnerPublicKey,
		},
		secretKey:
			a_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		secretKey:
			a_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	if (c_commitmentExists)
		await markNullified(c_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	if (c_commitmentExists)
		await markNullified(c_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: c_newCommitment,
		name: "c",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(c_stateVarId),
			value: c,
			salt: c_newSalt,
			publicKey: c_newOwnerPublicKey,
		},
		secretKey:
			c_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		secretKey:
			c_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
