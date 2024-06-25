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

export default async function transfer(
	_fromBucketId,
	_numberOfBalls,
	_buckets_fromBucketId_newOwnerPublicKey = 0,
	_buckets_fromBucketId_0_oldCommitment = 0,
	_buckets_fromBucketId_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("BucketsOfBallsShield");

	const contractAddr = await getContractAddress("BucketsOfBallsShield");

	const msgValue = 0;
	const fromBucketId = generalise(_fromBucketId);
	const numberOfBalls = generalise(_numberOfBalls);
	let buckets_fromBucketId_newOwnerPublicKey = generalise(
		_buckets_fromBucketId_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "BucketsOfBallsShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for decremented state

	buckets_fromBucketId_newOwnerPublicKey =
		_buckets_fromBucketId_newOwnerPublicKey === 0
			? publicKey
			: buckets_fromBucketId_newOwnerPublicKey;

	let buckets_fromBucketId_stateVarId = 5;

	const buckets_fromBucketId_stateVarId_key = fromBucketId;

	buckets_fromBucketId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(buckets_fromBucketId_stateVarId).bigInt,
				buckets_fromBucketId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let buckets_fromBucketId_preimage = await getCommitmentsById(
		buckets_fromBucketId_stateVarId
	);

	const buckets_fromBucketId_newCommitmentValue = generalise(
		parseInt(numberOfBalls.integer, 10)
	);
	// First check if required commitments exist or not

	let [
		buckets_fromBucketId_commitmentFlag,
		buckets_fromBucketId_0_oldCommitment,
		buckets_fromBucketId_1_oldCommitment,
	] = getInputCommitments(
		publicKey.hex(32),
		buckets_fromBucketId_newCommitmentValue.integer,
		buckets_fromBucketId_preimage
	);

	let buckets_fromBucketId_witness_0;

	let buckets_fromBucketId_witness_1;

	if (
		buckets_fromBucketId_1_oldCommitment === null &&
		buckets_fromBucketId_commitmentFlag
	) {
		buckets_fromBucketId_witness_0 = await getMembershipWitness(
			"BucketsOfBallsShield",
			generalise(buckets_fromBucketId_0_oldCommitment._id).integer
		);

		const tx = await splitCommitments(
			"BucketsOfBallsShield",
			"buckets",
			buckets_fromBucketId_newCommitmentValue,
			secretKey,
			publicKey,
			[5, buckets_fromBucketId_stateVarId_key],
			buckets_fromBucketId_0_oldCommitment,
			buckets_fromBucketId_witness_0,
			instance,
			contractAddr,
			web3
		);
		buckets_fromBucketId_preimage = await getCommitmentsById(
			buckets_fromBucketId_stateVarId
		);

		[
			buckets_fromBucketId_commitmentFlag,
			buckets_fromBucketId_0_oldCommitment,
			buckets_fromBucketId_1_oldCommitment,
		] = getInputCommitments(
			publicKey.hex(32),
			buckets_fromBucketId_newCommitmentValue.integer,
			buckets_fromBucketId_preimage
		);
	}

	while (buckets_fromBucketId_commitmentFlag === false) {
		buckets_fromBucketId_witness_0 = await getMembershipWitness(
			"BucketsOfBallsShield",
			generalise(buckets_fromBucketId_0_oldCommitment._id).integer
		);

		buckets_fromBucketId_witness_1 = await getMembershipWitness(
			"BucketsOfBallsShield",
			generalise(buckets_fromBucketId_1_oldCommitment._id).integer
		);

		const tx = await joinCommitments(
			"BucketsOfBallsShield",
			"buckets",
			secretKey,
			publicKey,
			[5, buckets_fromBucketId_stateVarId_key],
			[
				buckets_fromBucketId_0_oldCommitment,
				buckets_fromBucketId_1_oldCommitment,
			],
			[buckets_fromBucketId_witness_0, buckets_fromBucketId_witness_1],
			instance,
			contractAddr,
			web3
		);

		buckets_fromBucketId_preimage = await getCommitmentsById(
			buckets_fromBucketId_stateVarId
		);

		[
			buckets_fromBucketId_commitmentFlag,
			buckets_fromBucketId_0_oldCommitment,
			buckets_fromBucketId_1_oldCommitment,
		] = getInputCommitments(
			publicKey.hex(32),
			buckets_fromBucketId_newCommitmentValue.integer,
			buckets_fromBucketId_preimage
		);
	}
	const buckets_fromBucketId_0_prevSalt = generalise(
		buckets_fromBucketId_0_oldCommitment.preimage.salt
	);
	const buckets_fromBucketId_1_prevSalt = generalise(
		buckets_fromBucketId_1_oldCommitment.preimage.salt
	);
	const buckets_fromBucketId_0_prev = generalise(
		buckets_fromBucketId_0_oldCommitment.preimage.value
	);
	const buckets_fromBucketId_1_prev = generalise(
		buckets_fromBucketId_1_oldCommitment.preimage.value
	);

	// Extract set membership witness:

	// generate witness for partitioned state
	buckets_fromBucketId_witness_0 = await getMembershipWitness(
		"BucketsOfBallsShield",
		generalise(buckets_fromBucketId_0_oldCommitment._id).integer
	);
	buckets_fromBucketId_witness_1 = await getMembershipWitness(
		"BucketsOfBallsShield",
		generalise(buckets_fromBucketId_1_oldCommitment._id).integer
	);
	const buckets_fromBucketId_0_index = generalise(
		buckets_fromBucketId_witness_0.index
	);
	const buckets_fromBucketId_1_index = generalise(
		buckets_fromBucketId_witness_1.index
	);
	const buckets_fromBucketId_root = generalise(
		buckets_fromBucketId_witness_0.root
	);
	const buckets_fromBucketId_0_path = generalise(
		buckets_fromBucketId_witness_0.path
	).all;
	const buckets_fromBucketId_1_path = generalise(
		buckets_fromBucketId_witness_1.path
	).all;

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let buckets_fromBucketId_0_nullifier = poseidonHash([
		BigInt(buckets_fromBucketId_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(buckets_fromBucketId_0_prevSalt.hex(32)),
	]);
	let buckets_fromBucketId_1_nullifier = poseidonHash([
		BigInt(buckets_fromBucketId_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(buckets_fromBucketId_1_prevSalt.hex(32)),
	]);
	buckets_fromBucketId_0_nullifier = generalise(
		buckets_fromBucketId_0_nullifier.hex(32)
	); // truncate
	buckets_fromBucketId_1_nullifier = generalise(
		buckets_fromBucketId_1_nullifier.hex(32)
	); // truncate
	// Non-membership witness for Nullifier
	const buckets_fromBucketId_0_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		buckets_fromBucketId_0_nullifier
	);
	const buckets_fromBucketId_1_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		buckets_fromBucketId_1_nullifier
	);

	const buckets_fromBucketId_nullifierRoot = generalise(
		buckets_fromBucketId_0_nullifier_NonMembership_witness.root
	);
	const buckets_fromBucketId_0_nullifier_path = generalise(
		buckets_fromBucketId_0_nullifier_NonMembership_witness.path
	).all;
	const buckets_fromBucketId_1_nullifier_path = generalise(
		buckets_fromBucketId_1_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(buckets_fromBucketId_0_nullifier);
	await temporaryUpdateNullifier(buckets_fromBucketId_1_nullifier);

	// Get the new updated nullifier Paths
	const buckets_fromBucketId_0_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		buckets_fromBucketId_0_nullifier
	);
	const buckets_fromBucketId_1_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		buckets_fromBucketId_1_nullifier
	);

	const buckets_fromBucketId_newNullifierRoot = generalise(
		buckets_fromBucketId_0_updated_nullifier_NonMembership_witness.root
	);
	const buckets_fromBucketId_0_nullifier_updatedpath = generalise(
		buckets_fromBucketId_0_updated_nullifier_NonMembership_witness.path
	).all;
	const buckets_fromBucketId_1_nullifier_updatedpath = generalise(
		buckets_fromBucketId_1_updated_nullifier_NonMembership_witness.path
	).all;

	// Calculate commitment(s):

	const buckets_fromBucketId_2_newSalt = generalise(utils.randomHex(31));

	let buckets_fromBucketId_change =
		parseInt(buckets_fromBucketId_0_prev.integer, 10) +
		parseInt(buckets_fromBucketId_1_prev.integer, 10) -
		parseInt(buckets_fromBucketId_newCommitmentValue.integer, 10);

	buckets_fromBucketId_change = generalise(buckets_fromBucketId_change);

	let buckets_fromBucketId_2_newCommitment = poseidonHash([
		BigInt(buckets_fromBucketId_stateVarId),
		BigInt(buckets_fromBucketId_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(buckets_fromBucketId_2_newSalt.hex(32)),
	]);

	buckets_fromBucketId_2_newCommitment = generalise(
		buckets_fromBucketId_2_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		fromBucketId.integer,
		numberOfBalls.integer,
		secretKey.integer,
		secretKey.integer,
		buckets_fromBucketId_nullifierRoot.integer,
		buckets_fromBucketId_newNullifierRoot.integer,
		buckets_fromBucketId_0_nullifier.integer,
		buckets_fromBucketId_0_nullifier_path.integer,
		buckets_fromBucketId_0_nullifier_updatedpath.integer,
		buckets_fromBucketId_1_nullifier.integer,
		buckets_fromBucketId_1_nullifier_path.integer,
		buckets_fromBucketId_1_nullifier_updatedpath.integer,
		buckets_fromBucketId_0_prev.integer,
		buckets_fromBucketId_0_prevSalt.integer,
		buckets_fromBucketId_1_prev.integer,
		buckets_fromBucketId_1_prevSalt.integer,
		buckets_fromBucketId_root.integer,
		buckets_fromBucketId_0_index.integer,
		buckets_fromBucketId_0_path.integer,
		buckets_fromBucketId_1_index.integer,
		buckets_fromBucketId_1_path.integer,
		buckets_fromBucketId_newOwnerPublicKey.integer,
		buckets_fromBucketId_2_newSalt.integer,
		buckets_fromBucketId_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("transfer", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.transfer(
			buckets_fromBucketId_nullifierRoot.integer,
			buckets_fromBucketId_newNullifierRoot.integer,
			[
				buckets_fromBucketId_0_nullifier.integer,
				buckets_fromBucketId_1_nullifier.integer,
			],
			buckets_fromBucketId_root.integer,
			[buckets_fromBucketId_2_newCommitment.integer],
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
		generalise(buckets_fromBucketId_0_oldCommitment._id),
		secretKey.hex(32)
	);

	await markNullified(
		generalise(buckets_fromBucketId_1_oldCommitment._id),
		secretKey.hex(32)
	);

	await storeCommitment({
		hash: buckets_fromBucketId_2_newCommitment,
		name: "buckets",
		mappingKey: buckets_fromBucketId_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(buckets_fromBucketId_stateVarId),
			value: buckets_fromBucketId_change,
			salt: buckets_fromBucketId_2_newSalt,
			publicKey: buckets_fromBucketId_newOwnerPublicKey,
		},
		secretKey:
			buckets_fromBucketId_newOwnerPublicKey.integer === publicKey.integer
				? secretKey
				: null,
		isNullified: false,
	});

	const bool = true;
	return {
		tx,
		encEvent,
		bool: bool,
		buckets_fromBucketId_2_newCommitment:
			buckets_fromBucketId_2_newCommitment.integer,
	};
}
