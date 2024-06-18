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

export default async function decrement(
	_param3,
	_a_msgSender_newOwnerPublicKey = 0,
	_a_msgSender_0_oldCommitment = 0,
	_a_msgSender_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");

	const contractAddr = await getContractAddress("MyContractShield");

	const msgValue = 0;
	const param3 = generalise(_param3);
	let a_msgSender_newOwnerPublicKey = generalise(
		_a_msgSender_newOwnerPublicKey
	);

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

	let a_msgSender_preimage = await getCommitmentsById(a_msgSender_stateVarId);

	const a_msgSender_newCommitmentValue = generalise(
		parseInt(param3.integer, 10)
	);
	// First check if required commitments exist or not

	let [
		a_msgSender_commitmentFlag,
		a_msgSender_0_oldCommitment,
		a_msgSender_1_oldCommitment,
	] = getInputCommitments(
		publicKey.hex(32),
		a_msgSender_newCommitmentValue.integer,
		a_msgSender_preimage
	);

	let a_msgSender_witness_0;

	let a_msgSender_witness_1;

	if (a_msgSender_1_oldCommitment === null && a_msgSender_commitmentFlag) {
		a_msgSender_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_msgSender_0_oldCommitment._id).integer
		);

		const tx = await splitCommitments(
			"MyContractShield",
			"a",
			a_msgSender_newCommitmentValue,
			secretKey,
			publicKey,
			[5, a_msgSender_stateVarId_key],
			a_msgSender_0_oldCommitment,
			a_msgSender_witness_0,
			instance,
			contractAddr,
			web3
		);
		a_msgSender_preimage = await getCommitmentsById(a_msgSender_stateVarId);

		[
			a_msgSender_commitmentFlag,
			a_msgSender_0_oldCommitment,
			a_msgSender_1_oldCommitment,
		] = getInputCommitments(
			publicKey.hex(32),
			a_msgSender_newCommitmentValue.integer,
			a_msgSender_preimage
		);
	}

	while (a_msgSender_commitmentFlag === false) {
		a_msgSender_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_msgSender_0_oldCommitment._id).integer
		);

		a_msgSender_witness_1 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_msgSender_1_oldCommitment._id).integer
		);

		const tx = await joinCommitments(
			"MyContractShield",
			"a",
			secretKey,
			publicKey,
			[5, a_msgSender_stateVarId_key],
			[a_msgSender_0_oldCommitment, a_msgSender_1_oldCommitment],
			[a_msgSender_witness_0, a_msgSender_witness_1],
			instance,
			contractAddr,
			web3
		);

		a_msgSender_preimage = await getCommitmentsById(a_msgSender_stateVarId);

		[
			a_msgSender_commitmentFlag,
			a_msgSender_0_oldCommitment,
			a_msgSender_1_oldCommitment,
		] = getInputCommitments(
			publicKey.hex(32),
			a_msgSender_newCommitmentValue.integer,
			a_msgSender_preimage
		);
	}
	const a_msgSender_0_prevSalt = generalise(
		a_msgSender_0_oldCommitment.preimage.salt
	);
	const a_msgSender_1_prevSalt = generalise(
		a_msgSender_1_oldCommitment.preimage.salt
	);
	const a_msgSender_0_prev = generalise(
		a_msgSender_0_oldCommitment.preimage.value
	);
	const a_msgSender_1_prev = generalise(
		a_msgSender_1_oldCommitment.preimage.value
	);

	// Extract set membership witness:

	// generate witness for partitioned state
	a_msgSender_witness_0 = await getMembershipWitness(
		"MyContractShield",
		generalise(a_msgSender_0_oldCommitment._id).integer
	);
	a_msgSender_witness_1 = await getMembershipWitness(
		"MyContractShield",
		generalise(a_msgSender_1_oldCommitment._id).integer
	);
	const a_msgSender_0_index = generalise(a_msgSender_witness_0.index);
	const a_msgSender_1_index = generalise(a_msgSender_witness_1.index);
	const a_msgSender_root = generalise(a_msgSender_witness_0.root);
	const a_msgSender_0_path = generalise(a_msgSender_witness_0.path).all;
	const a_msgSender_1_path = generalise(a_msgSender_witness_1.path).all;

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let a_msgSender_0_nullifier = poseidonHash([
		BigInt(a_msgSender_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_msgSender_0_prevSalt.hex(32)),
	]);
	let a_msgSender_1_nullifier = poseidonHash([
		BigInt(a_msgSender_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_msgSender_1_prevSalt.hex(32)),
	]);
	a_msgSender_0_nullifier = generalise(a_msgSender_0_nullifier.hex(32)); // truncate
	a_msgSender_1_nullifier = generalise(a_msgSender_1_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const a_msgSender_0_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(a_msgSender_0_nullifier);
	const a_msgSender_1_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(a_msgSender_1_nullifier);

	const a_msgSender_nullifierRoot = generalise(
		a_msgSender_0_nullifier_NonMembership_witness.root
	);
	const a_msgSender_0_nullifier_path = generalise(
		a_msgSender_0_nullifier_NonMembership_witness.path
	).all;
	const a_msgSender_1_nullifier_path = generalise(
		a_msgSender_1_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(a_msgSender_0_nullifier);
	await temporaryUpdateNullifier(a_msgSender_1_nullifier);

	// Get the new updated nullifier Paths
	const a_msgSender_0_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(a_msgSender_0_nullifier);
	const a_msgSender_1_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(a_msgSender_1_nullifier);

	const a_msgSender_newNullifierRoot = generalise(
		a_msgSender_0_updated_nullifier_NonMembership_witness.root
	);
	const a_msgSender_0_nullifier_updatedpath = generalise(
		a_msgSender_0_updated_nullifier_NonMembership_witness.path
	).all;
	const a_msgSender_1_nullifier_updatedpath = generalise(
		a_msgSender_1_updated_nullifier_NonMembership_witness.path
	).all;

	// Calculate commitment(s):

	const a_msgSender_2_newSalt = generalise(utils.randomHex(31));

	let a_msgSender_change =
		parseInt(a_msgSender_0_prev.integer, 10) +
		parseInt(a_msgSender_1_prev.integer, 10) -
		parseInt(a_msgSender_newCommitmentValue.integer, 10);

	a_msgSender_change = generalise(a_msgSender_change);

	let a_msgSender_2_newCommitment = poseidonHash([
		BigInt(a_msgSender_stateVarId),
		BigInt(a_msgSender_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(a_msgSender_2_newSalt.hex(32)),
	]);

	a_msgSender_2_newCommitment = generalise(a_msgSender_2_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		param3.integer,
		a_msgSender_stateVarId_key.integer,
		secretKey.integer,
		secretKey.integer,
		a_msgSender_nullifierRoot.integer,
		a_msgSender_newNullifierRoot.integer,
		a_msgSender_0_nullifier.integer,
		a_msgSender_0_nullifier_path.integer,
		a_msgSender_0_nullifier_updatedpath.integer,
		a_msgSender_1_nullifier.integer,
		a_msgSender_1_nullifier_path.integer,
		a_msgSender_1_nullifier_updatedpath.integer,
		a_msgSender_0_prev.integer,
		a_msgSender_0_prevSalt.integer,
		a_msgSender_1_prev.integer,
		a_msgSender_1_prevSalt.integer,
		a_msgSender_root.integer,
		a_msgSender_0_index.integer,
		a_msgSender_0_path.integer,
		a_msgSender_1_index.integer,
		a_msgSender_1_path.integer,
		a_msgSender_newOwnerPublicKey.integer,
		a_msgSender_2_newSalt.integer,
		a_msgSender_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("decrement", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.decrement(
			a_msgSender_nullifierRoot.integer,
			a_msgSender_newNullifierRoot.integer,
			[a_msgSender_0_nullifier.integer, a_msgSender_1_nullifier.integer],
			a_msgSender_root.integer,
			[a_msgSender_2_newCommitment.integer],
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

	await markNullified(
		generalise(a_msgSender_0_oldCommitment._id),
		secretKey.hex(32)
	);

	await markNullified(
		generalise(a_msgSender_1_oldCommitment._id),
		secretKey.hex(32)
	);

	await storeCommitment({
		hash: a_msgSender_2_newCommitment,
		name: "a",
		mappingKey: a_msgSender_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(a_msgSender_stateVarId),
			value: a_msgSender_change,
			salt: a_msgSender_2_newSalt,
			publicKey: a_msgSender_newOwnerPublicKey,
		},
		secretKey:
			a_msgSender_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	return { tx, encEvent };
}
