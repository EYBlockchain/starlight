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

export default async function decrb(
	_param2,
	_ky,
	_b_ky_newOwnerPublicKey = 0,
	_b_ky_0_oldCommitment = 0,
	_b_ky_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");

	const contractAddr = await getContractAddress("MyContractShield");

	const msgValue = 0;
	const param2 = generalise(_param2);
	const ky = generalise(_ky);
	let b_ky_newOwnerPublicKey = generalise(_b_ky_newOwnerPublicKey);

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

	// read preimage for decremented state

	b_ky_newOwnerPublicKey =
		_b_ky_newOwnerPublicKey === 0 ? publicKey : b_ky_newOwnerPublicKey;

	let b_ky_stateVarId = 7;

	const b_ky_stateVarId_key = ky;

	b_ky_stateVarId = generalise(
		utils.mimcHash(
			[generalise(b_ky_stateVarId).bigInt, b_ky_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let b_ky_preimage = await getCommitmentsById(b_ky_stateVarId);

	const b_ky_newCommitmentValue = generalise(parseInt(param2.integer, 10));
	// First check if required commitments exist or not

	let [b_ky_commitmentFlag, b_ky_0_oldCommitment, b_ky_1_oldCommitment] =
		getInputCommitments(
			publicKey.hex(32),
			b_ky_newCommitmentValue.integer,
			b_ky_preimage
		);

	let b_ky_witness_0;

	let b_ky_witness_1;

	if (b_ky_1_oldCommitment === null && b_ky_commitmentFlag) {
		b_ky_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(b_ky_0_oldCommitment._id).integer
		);

		const tx = await splitCommitments(
			"MyContractShield",
			"b",
			b_ky_newCommitmentValue,
			secretKey,
			publicKey,
			[7, b_ky_stateVarId_key],
			b_ky_0_oldCommitment,
			b_ky_witness_0,
			instance,
			contractAddr,
			web3
		);
		b_ky_preimage = await getCommitmentsById(b_ky_stateVarId);

		[b_ky_commitmentFlag, b_ky_0_oldCommitment, b_ky_1_oldCommitment] =
			getInputCommitments(
				publicKey.hex(32),
				b_ky_newCommitmentValue.integer,
				b_ky_preimage
			);
	}

	while (b_ky_commitmentFlag === false) {
		b_ky_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(b_ky_0_oldCommitment._id).integer
		);

		b_ky_witness_1 = await getMembershipWitness(
			"MyContractShield",
			generalise(b_ky_1_oldCommitment._id).integer
		);

		const tx = await joinCommitments(
			"MyContractShield",
			"b",
			secretKey,
			publicKey,
			[7, b_ky_stateVarId_key],
			[b_ky_0_oldCommitment, b_ky_1_oldCommitment],
			[b_ky_witness_0, b_ky_witness_1],
			instance,
			contractAddr,
			web3
		);

		b_ky_preimage = await getCommitmentsById(b_ky_stateVarId);

		[b_ky_commitmentFlag, b_ky_0_oldCommitment, b_ky_1_oldCommitment] =
			getInputCommitments(
				publicKey.hex(32),
				b_ky_newCommitmentValue.integer,
				b_ky_preimage
			);
	}
	const b_ky_0_prevSalt = generalise(b_ky_0_oldCommitment.preimage.salt);
	const b_ky_1_prevSalt = generalise(b_ky_1_oldCommitment.preimage.salt);
	const b_ky_0_prev = generalise(b_ky_0_oldCommitment.preimage.value);
	const b_ky_1_prev = generalise(b_ky_1_oldCommitment.preimage.value);

	// Extract set membership witness:

	// generate witness for partitioned state
	b_ky_witness_0 = await getMembershipWitness(
		"MyContractShield",
		generalise(b_ky_0_oldCommitment._id).integer
	);
	b_ky_witness_1 = await getMembershipWitness(
		"MyContractShield",
		generalise(b_ky_1_oldCommitment._id).integer
	);
	const b_ky_0_index = generalise(b_ky_witness_0.index);
	const b_ky_1_index = generalise(b_ky_witness_1.index);
	const b_ky_root = generalise(b_ky_witness_0.root);
	const b_ky_0_path = generalise(b_ky_witness_0.path).all;
	const b_ky_1_path = generalise(b_ky_witness_1.path).all;

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let b_ky_0_nullifier = poseidonHash([
		BigInt(b_ky_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(b_ky_0_prevSalt.hex(32)),
	]);
	let b_ky_1_nullifier = poseidonHash([
		BigInt(b_ky_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(b_ky_1_prevSalt.hex(32)),
	]);
	b_ky_0_nullifier = generalise(b_ky_0_nullifier.hex(32)); // truncate
	b_ky_1_nullifier = generalise(b_ky_1_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const b_ky_0_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(b_ky_0_nullifier);
	const b_ky_1_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(b_ky_1_nullifier);

	const b_ky_nullifierRoot = generalise(
		b_ky_0_nullifier_NonMembership_witness.root
	);
	const b_ky_0_nullifier_path = generalise(
		b_ky_0_nullifier_NonMembership_witness.path
	).all;
	const b_ky_1_nullifier_path = generalise(
		b_ky_1_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(b_ky_0_nullifier);
	await temporaryUpdateNullifier(b_ky_1_nullifier);

	// Get the new updated nullifier Paths
	const b_ky_0_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(b_ky_0_nullifier);
	const b_ky_1_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(b_ky_1_nullifier);

	const b_ky_newNullifierRoot = generalise(
		b_ky_0_updated_nullifier_NonMembership_witness.root
	);
	const b_ky_0_nullifier_updatedpath = generalise(
		b_ky_0_updated_nullifier_NonMembership_witness.path
	).all;
	const b_ky_1_nullifier_updatedpath = generalise(
		b_ky_1_updated_nullifier_NonMembership_witness.path
	).all;

	// Calculate commitment(s):

	const b_ky_2_newSalt = generalise(utils.randomHex(31));

	let b_ky_change =
		parseInt(b_ky_0_prev.integer, 10) +
		parseInt(b_ky_1_prev.integer, 10) -
		parseInt(b_ky_newCommitmentValue.integer, 10);

	b_ky_change = generalise(b_ky_change);

	let b_ky_2_newCommitment = poseidonHash([
		BigInt(b_ky_stateVarId),
		BigInt(b_ky_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(b_ky_2_newSalt.hex(32)),
	]);

	b_ky_2_newCommitment = generalise(b_ky_2_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param2.integer,
		ky.integer,
		secretKey.integer,
		secretKey.integer,
		b_ky_nullifierRoot.integer,
		b_ky_newNullifierRoot.integer,
		b_ky_0_nullifier.integer,
		b_ky_0_nullifier_path.integer,
		b_ky_0_nullifier_updatedpath.integer,
		b_ky_1_nullifier.integer,
		b_ky_1_nullifier_path.integer,
		b_ky_1_nullifier_updatedpath.integer,
		b_ky_0_prev.integer,
		b_ky_0_prevSalt.integer,
		b_ky_1_prev.integer,
		b_ky_1_prevSalt.integer,
		b_ky_root.integer,
		b_ky_0_index.integer,
		b_ky_0_path.integer,
		b_ky_1_index.integer,
		b_ky_1_path.integer,
		b_ky_newOwnerPublicKey.integer,
		b_ky_2_newSalt.integer,
		b_ky_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("decrb", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.decrb(
			ky.integer,
			b_ky_nullifierRoot.integer,
			b_ky_newNullifierRoot.integer,
			[b_ky_0_nullifier.integer, b_ky_1_nullifier.integer],
			b_ky_root.integer,
			[b_ky_2_newCommitment.integer],
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

	await markNullified(generalise(b_ky_0_oldCommitment._id), secretKey.hex(32));

	await markNullified(generalise(b_ky_1_oldCommitment._id), secretKey.hex(32));

	await storeCommitment({
		hash: b_ky_2_newCommitment,
		name: "b",
		mappingKey: b_ky_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(b_ky_stateVarId),
			value: b_ky_change,
			salt: b_ky_2_newSalt,
			publicKey: b_ky_newOwnerPublicKey,
		},
		secretKey:
			b_ky_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
