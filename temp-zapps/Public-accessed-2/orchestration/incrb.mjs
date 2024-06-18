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

export default async function incrb(
	_a_newOwnerPublicKey = 0,
	_b_newOwnerPublicKey = 0,
	_c_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");

	const contractAddr = await getContractAddress("MyContractShield");

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);
	let b_newOwnerPublicKey = generalise(_b_newOwnerPublicKey);
	let c_newOwnerPublicKey = generalise(_c_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "MyContractShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	let z = generalise(await instance.methods.z().call());
	let z_init = z;

	let y = generalise(await instance.methods.y().call());
	let y_init = y;

	const x_y = generalise(await instance.methods.x(y.hex(20)).call());

	const x_msgSender = generalise(
		await instance.methods.x(msgSender.hex(20)).call()
	);

	z = generalise(z_init);

	y = generalise(y_init);

	// Initialise commitment preimage of whole state:

	const c_stateVarId = generalise(15).hex(32);

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

	// read preimage for incremented state
	a_newOwnerPublicKey =
		_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

	const a_stateVarId = generalise(11).hex(32);

	const a_newCommitmentValue = generalise(parseInt(x_msgSender.integer, 10));

	// read preimage for incremented state
	b_newOwnerPublicKey =
		_b_newOwnerPublicKey === 0 ? publicKey : b_newOwnerPublicKey;

	const b_stateVarId = generalise(13).hex(32);

	const b_newCommitmentValue = generalise(
		parseInt(x_y.integer, 10) + parseInt(z.integer, 10)
	);

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
	const c_emptyPath = new Array(32).fill(0);
	const c_witness = c_witnessRequired
		? await getMembershipWitness(
				"MyContractShield",
				c_currentCommitment.integer
		  )
		: {
				index: 0,
				path: c_emptyPath,
				root: (await getRoot("MyContractShield")) || 0,
		  };
	const c_index = generalise(c_witness.index);
	const c_root = generalise(c_witness.root);
	const c_path = generalise(c_witness.path).all;

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	// increment would go here but has been filtered out

	let c = generalise(parseInt(x_y.integer, 10));

	c = generalise(c);

	// Calculate nullifier(s):

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
	const c_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(c_nullifier);

	const c_nullifierRoot = generalise(c_nullifier_NonMembership_witness.root);
	const c_nullifier_path = generalise(
		c_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(c_nullifier);

	// Get the new updated nullifier Paths
	const c_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(c_nullifier);
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
		BigInt(a_newCommitmentValue.hex(32)),
		BigInt(a_newOwnerPublicKey.hex(32)),
		BigInt(a_newSalt.hex(32)),
	]);

	a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

	const b_newSalt = generalise(utils.randomHex(31));

	let b_newCommitment = poseidonHash([
		BigInt(b_stateVarId),
		BigInt(b_newCommitmentValue.hex(32)),
		BigInt(b_newOwnerPublicKey.hex(32)),
		BigInt(b_newSalt.hex(32)),
	]);

	b_newCommitment = generalise(b_newCommitment.hex(32)); // truncate

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
		msgSender.integer,
		x_msgSender.integer,
		x_y.integer,
		z.integer,
		a_newOwnerPublicKey.integer,
		a_newSalt.integer,
		a_newCommitment.integer,

		b_newOwnerPublicKey.integer,
		b_newSalt.integer,
		b_newCommitment.integer,

		c_commitmentExists ? secretKey.integer : generalise(0).integer,
		c_nullifierRoot.integer,
		c_newNullifierRoot.integer,
		c_nullifier.integer,
		c_nullifier_path.integer,
		c_nullifier_updatedpath.integer,
		c_prev.integer,
		c_prevSalt.integer,
		c_commitmentExists ? 0 : 1,
		c_root.integer,
		c_index.integer,
		c_path.integer,
		c_newOwnerPublicKey.integer,
		c_newSalt.integer,
		c_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("incrb", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.incrb(
			c_nullifierRoot.integer,
			c_newNullifierRoot.integer,
			[c_nullifier.integer],
			c_root.integer,
			[
				a_newCommitment.integer,
				b_newCommitment.integer,
				c_newCommitment.integer,
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
		hash: a_newCommitment,
		name: "a",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(a_stateVarId),
			value: a_newCommitmentValue,
			salt: a_newSalt,
			publicKey: a_newOwnerPublicKey,
		},
		secretKey:
			a_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	await storeCommitment({
		hash: b_newCommitment,
		name: "b",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(b_stateVarId),
			value: b_newCommitmentValue,
			salt: b_newSalt,
			publicKey: b_newOwnerPublicKey,
		},
		secretKey:
			b_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	if (c_commitmentExists)
		await markNullified(c_currentCommitment, secretKey.hex(32));

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
		isNullified: false,
	});

	return { tx, encEvent };
}
