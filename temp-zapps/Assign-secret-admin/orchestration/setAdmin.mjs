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

export default async function setAdmin(
	_newAdmin,
	_admin_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("MyContractShield");

	const contractAddr = await getContractAddress("MyContractShield");

	const msgSender = generalise(config.web3.options.defaultAccount);

	const msgValue = 0;
	const newAdmin = generalise(_newAdmin);
	let admin_newOwnerPublicKey = generalise(_admin_newOwnerPublicKey);

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

	// Initialise commitment preimage of whole state:

	const admin_stateVarId = generalise(5).hex(32);

	let admin_commitmentExists = true;
	let admin_witnessRequired = true;

	const admin_commitment = await getCurrentWholeCommitment(admin_stateVarId);

	let admin_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (!admin_commitment) {
		admin_commitmentExists = false;
		admin_witnessRequired = false;
	} else {
		admin_preimage = admin_commitment.preimage;
	}

	// read preimage for whole state
	admin_newOwnerPublicKey =
		_admin_newOwnerPublicKey === 0 ? publicKey : admin_newOwnerPublicKey;

	const admin_currentCommitment = admin_commitmentExists
		? generalise(admin_commitment._id)
		: generalise(0);
	const admin_prev = generalise(admin_preimage.value);
	const admin_prevSalt = generalise(admin_preimage.salt);

	// Extract set membership witness:

	// generate witness for whole state
	const admin_emptyPath = new Array(32).fill(0);
	const admin_witness = admin_witnessRequired
		? await getMembershipWitness(
				"MyContractShield",
				admin_currentCommitment.integer
		  )
		: {
				index: 0,
				path: admin_emptyPath,
				root: (await getRoot("MyContractShield")) || 0,
		  };
	const admin_index = generalise(admin_witness.index);
	const admin_root = generalise(admin_witness.root);
	const admin_path = generalise(admin_witness.path).all;

	let admin = generalise(admin_preimage.value);

	admin = generalise(newAdmin.integer);

	admin = generalise(admin);

	// Calculate nullifier(s):

	let admin_nullifier = admin_commitmentExists
		? poseidonHash([
				BigInt(admin_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(admin_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(admin_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(admin_prevSalt.hex(32)),
		  ]);

	admin_nullifier = generalise(admin_nullifier.hex(32)); // truncate
	// Non-membership witness for Nullifier
	const admin_nullifier_NonMembership_witness = getnullifierMembershipWitness(
		admin_nullifier
	);

	const admin_nullifierRoot = generalise(
		admin_nullifier_NonMembership_witness.root
	);
	const admin_nullifier_path = generalise(
		admin_nullifier_NonMembership_witness.path
	).all;

	await temporaryUpdateNullifier(admin_nullifier);

	// Get the new updated nullifier Paths
	const admin_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
		admin_nullifier
	);
	const admin_nullifier_updatedpath = generalise(
		admin_updated_nullifier_NonMembership_witness.path
	).all;
	const admin_newNullifierRoot = generalise(
		admin_updated_nullifier_NonMembership_witness.root
	);

	// Calculate commitment(s):

	const admin_newSalt = generalise(utils.randomHex(31));

	let admin_newCommitment = poseidonHash([
		BigInt(admin_stateVarId),
		BigInt(admin.hex(32)),
		BigInt(admin_newOwnerPublicKey.hex(32)),
		BigInt(admin_newSalt.hex(32)),
	]);

	admin_newCommitment = generalise(admin_newCommitment.hex(32)); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		msgSender.integer,
		newAdmin.integer,
		admin_commitmentExists ? secretKey.integer : generalise(0).integer,
		admin_nullifierRoot.integer,
		admin_newNullifierRoot.integer,
		admin_nullifier.integer,
		admin_nullifier_path.integer,
		admin_nullifier_updatedpath.integer,
		admin_prev.integer,
		admin_prevSalt.integer,

		admin_root.integer,
		admin_index.integer,
		admin_path.integer,
		admin_newOwnerPublicKey.integer,
		admin_newSalt.integer,
		admin_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("setAdmin", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const txData = await instance.methods
		.setAdmin(
			admin_nullifierRoot.integer,
			admin_newNullifierRoot.integer,
			[admin_nullifier.integer],
			admin_root.integer,
			[admin_newCommitment.integer],
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

	if (admin_commitmentExists)
		await markNullified(admin_currentCommitment, secretKey.hex(32));
	else await updateNullifierTree(); // Else we always update it in markNullified

	await storeCommitment({
		hash: admin_newCommitment,
		name: "admin",
		mappingKey: null,
		preimage: {
			stateVarId: generalise(admin_stateVarId),
			value: admin,
			salt: admin_newSalt,
			publicKey: admin_newOwnerPublicKey,
		},
		secretKey:
			admin_newOwnerPublicKey.integer === publicKey.integer ? secretKey : null,
		isNullified: false,
	});

	return { tx, encEvent };
}
