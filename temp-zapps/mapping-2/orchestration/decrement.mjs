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
	_addr,
	_param3,
	_a_addr_newOwnerPublicKey = 0,
	_a_addr_0_oldCommitment = 0,
	_a_addr_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");

	const contractAddr = await getContractAddress("MyContractShield");

	const msgValue = 0;
	const addr = generalise(_addr);
	const param3 = generalise(_param3);
	let a_addr_newOwnerPublicKey = generalise(_a_addr_newOwnerPublicKey);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(31), "MyContractShield", true);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// read preimage for decremented state

	a_addr_newOwnerPublicKey =
		_a_addr_newOwnerPublicKey === 0
			? generalise(
					await instance.methods
						.zkpPublicKeys(await instance.methods.admin().call())
						.call()
			  )
			: a_addr_newOwnerPublicKey;

	let a_addr_stateVarId = 5;

	const a_addr_stateVarId_key = addr;

	a_addr_stateVarId = generalise(
		utils.mimcHash(
			[generalise(a_addr_stateVarId).bigInt, a_addr_stateVarId_key.bigInt],
			"ALT_BN_254"
		)
	).hex(32);

	let a_addr_preimage = await getCommitmentsById(a_addr_stateVarId);

	const a_addr_newCommitmentValue = generalise(parseInt(param3.integer, 10));
	// First check if required commitments exist or not

	let [a_addr_commitmentFlag, a_addr_0_oldCommitment, a_addr_1_oldCommitment] =
		getInputCommitments(
			publicKey.hex(32),
			a_addr_newCommitmentValue.integer,
			a_addr_preimage
		);

	let a_addr_witness_0;

	let a_addr_witness_1;

	if (a_addr_1_oldCommitment === null && a_addr_commitmentFlag) {
		a_addr_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_addr_0_oldCommitment._id).integer
		);

		const tx = await splitCommitments(
			"MyContractShield",
			"a",
			a_addr_newCommitmentValue,
			secretKey,
			publicKey,
			[5, a_addr_stateVarId_key],
			a_addr_0_oldCommitment,
			a_addr_witness_0,
			instance,
			contractAddr,
			web3
		);
		a_addr_preimage = await getCommitmentsById(a_addr_stateVarId);

		[a_addr_commitmentFlag, a_addr_0_oldCommitment, a_addr_1_oldCommitment] =
			getInputCommitments(
				publicKey.hex(32),
				a_addr_newCommitmentValue.integer,
				a_addr_preimage
			);
	}

	while (a_addr_commitmentFlag === false) {
		a_addr_witness_0 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_addr_0_oldCommitment._id).integer
		);

		a_addr_witness_1 = await getMembershipWitness(
			"MyContractShield",
			generalise(a_addr_1_oldCommitment._id).integer
		);

		const tx = await joinCommitments(
			"MyContractShield",
			"a",
			secretKey,
			publicKey,
			[5, a_addr_stateVarId_key],
			[a_addr_0_oldCommitment, a_addr_1_oldCommitment],
			[a_addr_witness_0, a_addr_witness_1],
			instance,
			contractAddr,
			web3
		);

		a_addr_preimage = await getCommitmentsById(a_addr_stateVarId);

		[a_addr_commitmentFlag, a_addr_0_oldCommitment, a_addr_1_oldCommitment] =
			getInputCommitments(
				publicKey.hex(32),
				a_addr_newCommitmentValue.integer,
				a_addr_preimage
			);
	}
	const a_addr_0_prevSalt = generalise(a_addr_0_oldCommitment.preimage.salt);
	const a_addr_1_prevSalt = generalise(a_addr_1_oldCommitment.preimage.salt);
	const a_addr_0_prev = generalise(a_addr_0_oldCommitment.preimage.value);
	const a_addr_1_prev = generalise(a_addr_1_oldCommitment.preimage.value);

	// Extract set membership witness:

	// generate witness for partitioned state
	a_addr_witness_0 = await getMembershipWitness(
		"MyContractShield",
		generalise(a_addr_0_oldCommitment._id).integer
	);
	a_addr_witness_1 = await getMembershipWitness(
		"MyContractShield",
		generalise(a_addr_1_oldCommitment._id).integer
	);
	const a_addr_0_index = generalise(a_addr_witness_0.index);
	const a_addr_1_index = generalise(a_addr_witness_1.index);
	const a_addr_root = generalise(a_addr_witness_0.root);
	const a_addr_0_path = generalise(a_addr_witness_0.path).all;
	const a_addr_1_path = generalise(a_addr_witness_1.path).all;

	// increment would go here but has been filtered out

	// Calculate nullifier(s):

	let a_addr_0_nullifier = poseidonHash([
		BigInt(a_addr_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_addr_0_prevSalt.hex(32)),
	]);
	let a_addr_1_nullifier = poseidonHash([
		BigInt(a_addr_stateVarId),
		BigInt(secretKey.hex(32)),
		BigInt(a_addr_1_prevSalt.hex(32)),
	]);
	a_addr_0_nullifier = generalise(a_addr_0_nullifier.hex(32)); // truncate
	a_addr_1_nullifier = generalise(a_addr_1_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const a_addr_0_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(a_addr_0_nullifier);
	const a_addr_1_nullifier_NonMembership_witness =
		getnullifierMembershipWitness(a_addr_1_nullifier);

	const a_addr_nullifierRoot = generalise(
		a_addr_0_nullifier_NonMembership_witness.root
	);
	const a_addr_0_nullifier_path = generalise(
		a_addr_0_nullifier_NonMembership_witness.path
	).all;
	const a_addr_1_nullifier_path = generalise(
		a_addr_1_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(a_addr_0_nullifier);
	await temporaryUpdateNullifier(a_addr_1_nullifier);

	// Get the new updated nullifier Paths
	const a_addr_0_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(a_addr_0_nullifier);
	const a_addr_1_updated_nullifier_NonMembership_witness =
		getupdatedNullifierPaths(a_addr_1_nullifier);

	const a_addr_newNullifierRoot = generalise(
		a_addr_0_updated_nullifier_NonMembership_witness.root
	);
	const a_addr_0_nullifier_updatedpath = generalise(
		a_addr_0_updated_nullifier_NonMembership_witness.path
	).all;
	const a_addr_1_nullifier_updatedpath = generalise(
		a_addr_1_updated_nullifier_NonMembership_witness.path
	).all;

	// Calculate commitment(s):

	const a_addr_2_newSalt = generalise(utils.randomHex(31));

	let a_addr_change =
		parseInt(a_addr_0_prev.integer, 10) +
		parseInt(a_addr_1_prev.integer, 10) -
		parseInt(a_addr_newCommitmentValue.integer, 10);

	a_addr_change = generalise(a_addr_change);

	let a_addr_2_newCommitment = poseidonHash([
		BigInt(a_addr_stateVarId),
		BigInt(a_addr_change.hex(32)),
		BigInt(publicKey.hex(32)),
		BigInt(a_addr_2_newSalt.hex(32)),
	]);

	a_addr_2_newCommitment = generalise(a_addr_2_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		addr.integer,
		param3.integer,
		secretKey.integer,
		secretKey.integer,
		a_addr_nullifierRoot.integer,
		a_addr_newNullifierRoot.integer,
		a_addr_0_nullifier.integer,
		a_addr_0_nullifier_path.integer,
		a_addr_0_nullifier_updatedpath.integer,
		a_addr_1_nullifier.integer,
		a_addr_1_nullifier_path.integer,
		a_addr_1_nullifier_updatedpath.integer,
		a_addr_0_prev.integer,
		a_addr_0_prevSalt.integer,
		a_addr_1_prev.integer,
		a_addr_1_prevSalt.integer,
		a_addr_root.integer,
		a_addr_0_index.integer,
		a_addr_0_path.integer,
		a_addr_1_index.integer,
		a_addr_1_path.integer,
		a_addr_newOwnerPublicKey.integer,
		a_addr_2_newSalt.integer,
		a_addr_2_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("decrement", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.decrement(
			a_addr_nullifierRoot.integer,
			a_addr_newNullifierRoot.integer,
			[a_addr_0_nullifier.integer, a_addr_1_nullifier.integer],
			a_addr_root.integer,
			[a_addr_2_newCommitment.integer],
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
		generalise(a_addr_0_oldCommitment._id),
		secretKey.hex(32)
	);

	await markNullified(
		generalise(a_addr_1_oldCommitment._id),
		secretKey.hex(32)
	);

	await storeCommitment({
		hash: a_addr_2_newCommitment,
		name: "a",
		mappingKey: a_addr_stateVarId_key.integer,
		preimage: {
			stateVarId: generalise(a_addr_stateVarId),
			value: a_addr_change,
			salt: a_addr_2_newSalt,
			publicKey: a_addr_newOwnerPublicKey,
		},
		secretKey:
			a_addr_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
