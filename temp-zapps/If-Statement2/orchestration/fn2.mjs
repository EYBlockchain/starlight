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

export default async function fn2(_p, _z_newOwnerPublicKey = 0) {
	// Initialisation of variables:

	const contract = new Contract("TestShield");

	await contract.init();

	const instance = contract.getInstance();

	if (!instance) {
		throw new Error("Contract instance is not initialized");
	}

	const contractAddr = await contract.getContractAddress();

	const msgValue = 0;
	const p = generalise(_p);
	let z_newOwnerPublicKey = generalise(_z_newOwnerPublicKey);

	// Initialize the contract

	const contract = new Contract("TestShield");

	await contract.init();

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await contract.registerKey(utils.randomHex(31), "TestShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	let a = generalise(await instance.methods.a().call());
	let a_init = a;

	a = generalise(a_init);

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
	z_newOwnerPublicKey =
		_z_newOwnerPublicKey === 0 ? publicKey : z_newOwnerPublicKey;

	const z_currentCommitment = z_commitmentExists
		? generalise(z_commitment._id)
		: generalise(0);
	const z_prev = generalise(z_preimage.value);
	const z_prevSalt = generalise(z_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const z_emptyPath = new Array(32).fill(0);
	const z_witness = z_witnessRequired
		? await getMembershipWitness("TestShield", z_currentCommitment.integer)
		: { index: 0, path: z_emptyPath, root: (await getRoot("TestShield")) || 0 };
	const z_index = generalise(z_witness.index);
	const z_root = generalise(z_witness.root);
	const z_path = generalise(z_witness.path).all;

	let z = generalise(z_preimage.value);

	if (parseInt(a.integer, 10) == 0) {
		z = generalise(parseInt(z.integer, 10) + parseInt(p.integer, 10));
	} else {
		z = generalise(parseInt(p.integer, 10) + 1);
	}

	z = generalise(z);

	z = generalise(z);

	// Calculate nullifier(s):

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
	const z_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		z_nullifier
	);

	const z_nullifierRoot = generalise(z_nullifier_NonMembership_witness.root);
	const z_nullifier_path = generalise(z_nullifier_NonMembership_witness.path)
		.all;

	await temporaryUpdateNullifier(z_nullifier);

	// Get the new updated nullifier Paths
	const z_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		z_nullifier
	);
	const z_nullifier_updatedpath = generalise(
		z_updated_nullifier_NonMembership_witness.path
	).all;
	const z_newNullifierRoot = generalise(
		z_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

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
		p.integer,
		a.integer,
		z_commitmentExists ? secretKey.integer : generalise(0).integer,
		z_commitmentExists ? secretKey.integer : generalise(0).integer,
		z_nullifierRoot.integer,
		z_newNullifierRoot.integer,
		z_newNullifierRoot.integer,
		z_nullifier.integer,
		z_nullifier_path.integer,
		z_nullifier_updatedpath.integer,
		z_prev.integer,
		z_prevSalt.integer,
		z_commitmentExists ? 0 : 1,
		z_root.integer,
		z_index.integer,
		z_path.integer,
		z_newOwnerPublicKey.integer,
		z_newSalt.integer,
		z_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("fn2", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.fn2(
			p.integer,
			z_nullifierRoot.integer,
			z_newNullifierRoot.integer,
			[z_nullifier.integer],
			z_root.integer,
			[z_newCommitment.integer],
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

	if (z_commitmentExists)
		await markNullified(z_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	if (z_commitmentExists)
		await markNullified(z_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

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
		secretKey:
			z_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
