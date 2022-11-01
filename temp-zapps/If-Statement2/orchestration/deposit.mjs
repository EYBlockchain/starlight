/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import utils from "zkp-utils";
import GN from "general-number";
import fs from "fs";

import {
	getContractInstance,
	registerKey,
	getInputCommitments,
	joinCommitments,
} from "./common/contract.mjs";
import { generateProof } from "./common/zokrates.mjs";
import poseidonHash from "./common/poseidon.mjs";
import { getMembershipWitness, getRoot } from "./common/timber.mjs";

const { generalise } = GN;
const db = "/app/orchestration/common/db/preimage.json";
const keyDb = "/app/orchestration/common/db/key.json";

export default async function deposit(
	_accountId,
	_amountDeposit,
	_account_accountId_newOwnerPublicKey = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("FakeBankShield");
	const accountId = generalise(_accountId);
	const amountDeposit = generalise(_amountDeposit);
	let account_accountId_newOwnerPublicKey = generalise(
		_account_accountId_newOwnerPublicKey
	);

	// Read dbs for keys and previous commitment values:

	if (!fs.existsSync(keyDb))
		await registerKey(utils.randomHex(32), "FakeBankShield", false);
	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);

	// Initialise commitment preimage of whole state:

	let account_accountId_stateVarId = 5;

	const account_accountId_stateVarId_key = accountId;

	account_accountId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(account_accountId_stateVarId).bigInt,
				account_accountId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let account_accountId_commitmentExists = true;
	let account_accountId_witnessRequired = true;

	let account_accountId_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).account ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).account[accountId.integer]
	) {
		account_accountId_commitmentExists = false;
		account_accountId_witnessRequired = false;
	} else {
		account_accountId_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).account[accountId.integer];
	}

	// read preimage for whole state
	account_accountId_newOwnerPublicKey =
		_account_accountId_newOwnerPublicKey === 0
			? publicKey
			: account_accountId_newOwnerPublicKey;

	const account_accountId_currentCommitment = generalise(
		account_accountId_preimage.commitment
	);
	const account_accountId_prev = generalise(account_accountId_preimage.value);
	const account_accountId_prevSalt = generalise(
		account_accountId_preimage.salt
	);

	// Extract set membership witness:

	// generate witness for whole state
	const account_accountId_emptyPath = new Array(32).fill(0);
	const account_accountId_witness = account_accountId_witnessRequired
		? await getMembershipWitness(
				"FakeBankShield",
				account_accountId_currentCommitment.integer
		  )
		: {
				index: 0,
				path: account_accountId_emptyPath,
				root: (await getRoot("FakeBankShield")) || 0,
		  };
	const account_accountId_index = generalise(account_accountId_witness.index);
	const account_accountId_root = generalise(account_accountId_witness.root);
	const account_accountId_path = generalise(account_accountId_witness.path).all;

	let account_accountId = generalise(account_accountId_preimage.value);
	account_accountId =
		parseInt(account_accountId.integer, 10) +
		parseInt(amountDeposit.integer, 10);

	account_accountId = generalise(account_accountId);

	// Calculate nullifier(s):

	let account_accountId_nullifier = account_accountId_commitmentExists
		? poseidonHash([
				BigInt(account_accountId_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(account_accountId_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(account_accountId_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(account_accountId_prevSalt.hex(32)),
		  ]);

	account_accountId_nullifier = generalise(account_accountId_nullifier.hex(32)); // truncate

	// Calculate commitment(s):

	const account_accountId_newSalt = generalise(utils.randomHex(32));

	let account_accountId_newCommitment = poseidonHash([
		BigInt(account_accountId_stateVarId),
		BigInt(account_accountId.hex(32)),
		BigInt(account_accountId_newOwnerPublicKey.hex(32)),
		BigInt(account_accountId_newSalt.hex(32)),
	]);

	account_accountId_newCommitment = generalise(
		account_accountId_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		accountId.integer,
		amountDeposit.integer,
		account_accountId_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		account_accountId_nullifier.integer,
		account_accountId_prev.integer,
		account_accountId_prevSalt.integer,
		account_accountId_commitmentExists ? 0 : 1,
		account_accountId_root.integer,
		account_accountId_index.integer,
		account_accountId_path.integer,
		account_accountId_newOwnerPublicKey.integer,
		account_accountId_newSalt.integer,
		account_accountId_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("deposit", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.deposit(
			[account_accountId_nullifier.integer],
			account_accountId_root.integer,
			[account_accountId_newCommitment.integer],
			proof
		)
		.send({
			from: config.web3.options.defaultAccount,
			gas: config.web3.options.defaultGas,
		});

	// Write new commitment preimage to db:

	let preimage = {};
	if (fs.existsSync(db)) {
		preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		);
	}

	if (!preimage.account) preimage.account = {};

	if (!preimage.account[account_accountId_stateVarId_key.integer])
		preimage.account[account_accountId_stateVarId_key.integer] = {};

	preimage.account[account_accountId_stateVarId_key.integer] = {
		value: account_accountId.integer,
		salt: account_accountId_newSalt.integer,
		publicKey: account_accountId_newOwnerPublicKey.integer,
		commitment: account_accountId_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
