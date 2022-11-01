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

export default async function transfer(
	_fromAccountId,
	_toAccountId,
	_amount,
	_account_fromAccountId_newOwnerPublicKey = 0,
	_account_toAccountId_newOwnerPublicKey = 0,
	_account_fromAccountId_0_oldCommitment = 0,
	_account_fromAccountId_1_oldCommitment = 0
) {
	// Initialisation of variables:

	const instance = await getContractInstance("FakeBankShield");
	const fromAccountId = generalise(_fromAccountId);
	const toAccountId = generalise(_toAccountId);
	const amount = generalise(_amount);
	let account_fromAccountId_newOwnerPublicKey = generalise(
		_account_fromAccountId_newOwnerPublicKey
	);
	let account_toAccountId_newOwnerPublicKey = generalise(
		_account_toAccountId_newOwnerPublicKey
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

	let account_fromAccountId_stateVarId = 5;

	const account_fromAccountId_stateVarId_key = fromAccountId;

	account_fromAccountId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(account_fromAccountId_stateVarId).bigInt,
				account_fromAccountId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let account_fromAccountId_commitmentExists = true;
	let account_fromAccountId_witnessRequired = true;

	let account_fromAccountId_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).account ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).account[fromAccountId.integer]
	) {
		account_fromAccountId_commitmentExists = false;
		account_fromAccountId_witnessRequired = false;
	} else {
		account_fromAccountId_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).account[fromAccountId.integer];
	}

	// Initialise commitment preimage of whole state:

	let account_toAccountId_stateVarId = 5;

	const account_toAccountId_stateVarId_key = toAccountId;

	account_toAccountId_stateVarId = generalise(
		utils.mimcHash(
			[
				generalise(account_toAccountId_stateVarId).bigInt,
				account_toAccountId_stateVarId_key.bigInt,
			],
			"ALT_BN_254"
		)
	).hex(32);

	let account_toAccountId_commitmentExists = true;
	let account_toAccountId_witnessRequired = true;

	let account_toAccountId_preimage = {
		value: 0,
		salt: 0,
		commitment: 0,
	};
	if (
		!fs.existsSync(db) ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).account ||
		!JSON.parse(fs.readFileSync(db, "utf-8")).account[toAccountId.integer]
	) {
		account_toAccountId_commitmentExists = false;
		account_toAccountId_witnessRequired = false;
	} else {
		account_toAccountId_preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		).account[toAccountId.integer];
	}

	// read preimage for whole state
	account_fromAccountId_newOwnerPublicKey =
		_account_fromAccountId_newOwnerPublicKey === 0
			? publicKey
			: account_fromAccountId_newOwnerPublicKey;

	const account_fromAccountId_currentCommitment = generalise(
		account_fromAccountId_preimage.commitment
	);
	const account_fromAccountId_prev = generalise(
		account_fromAccountId_preimage.value
	);
	const account_fromAccountId_prevSalt = generalise(
		account_fromAccountId_preimage.salt
	);

	// read preimage for whole state
	account_toAccountId_newOwnerPublicKey =
		_account_toAccountId_newOwnerPublicKey === 0
			? publicKey
			: account_toAccountId_newOwnerPublicKey;

	const account_toAccountId_currentCommitment = generalise(
		account_toAccountId_preimage.commitment
	);
	const account_toAccountId_prev = generalise(
		account_toAccountId_preimage.value
	);
	const account_toAccountId_prevSalt = generalise(
		account_toAccountId_preimage.salt
	);

	// Extract set membership witness:

	// generate witness for whole state
	const account_fromAccountId_emptyPath = new Array(32).fill(0);
	const account_fromAccountId_witness = account_fromAccountId_witnessRequired
		? await getMembershipWitness(
				"FakeBankShield",
				account_fromAccountId_currentCommitment.integer
		  )
		: {
				index: 0,
				path: account_fromAccountId_emptyPath,
				root: (await getRoot("FakeBankShield")) || 0,
		  };
	const account_fromAccountId_index = generalise(
		account_fromAccountId_witness.index
	);
	const account_fromAccountId_root = generalise(
		account_fromAccountId_witness.root
	);
	const account_fromAccountId_path = generalise(
		account_fromAccountId_witness.path
	).all;

	// generate witness for whole state
	const account_toAccountId_emptyPath = new Array(32).fill(0);
	const account_toAccountId_witness = account_toAccountId_witnessRequired
		? await getMembershipWitness(
				"FakeBankShield",
				account_toAccountId_currentCommitment.integer
		  )
		: {
				index: 0,
				path: account_toAccountId_emptyPath,
				root: (await getRoot("FakeBankShield")) || 0,
		  };
	const account_toAccountId_index = generalise(
		account_toAccountId_witness.index
	);
	const account_toAccountId_root = generalise(account_toAccountId_witness.root);
	const account_toAccountId_path = generalise(account_toAccountId_witness.path)
		.all;

	let account_fromAccountId = generalise(account_fromAccountId_preimage.value);
	account_fromAccountId =
		parseInt(account_fromAccountId.integer, 10) - parseInt(amount.integer, 10);

	account_fromAccountId = generalise(account_fromAccountId);

	let account_toAccountId = generalise(account_toAccountId_preimage.value);
	account_toAccountId =
		parseInt(account_toAccountId.integer, 10) + parseInt(amount.integer, 10);

	account_toAccountId = generalise(account_toAccountId);

	// Calculate nullifier(s):

	let account_fromAccountId_nullifier = account_fromAccountId_commitmentExists
		? poseidonHash([
				BigInt(account_fromAccountId_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(account_fromAccountId_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(account_fromAccountId_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(account_fromAccountId_prevSalt.hex(32)),
		  ]);

	account_fromAccountId_nullifier = generalise(
		account_fromAccountId_nullifier.hex(32)
	); // truncate
	let account_toAccountId_nullifier = account_toAccountId_commitmentExists
		? poseidonHash([
				BigInt(account_toAccountId_stateVarId),
				BigInt(secretKey.hex(32)),
				BigInt(account_toAccountId_prevSalt.hex(32)),
		  ])
		: poseidonHash([
				BigInt(account_toAccountId_stateVarId),
				BigInt(generalise(0).hex(32)),
				BigInt(account_toAccountId_prevSalt.hex(32)),
		  ]);

	account_toAccountId_nullifier = generalise(
		account_toAccountId_nullifier.hex(32)
	); // truncate

	// Calculate commitment(s):

	const account_fromAccountId_newSalt = generalise(utils.randomHex(32));

	let account_fromAccountId_newCommitment = poseidonHash([
		BigInt(account_fromAccountId_stateVarId),
		BigInt(account_fromAccountId.hex(32)),
		BigInt(account_fromAccountId_newOwnerPublicKey.hex(32)),
		BigInt(account_fromAccountId_newSalt.hex(32)),
	]);

	account_fromAccountId_newCommitment = generalise(
		account_fromAccountId_newCommitment.hex(32)
	); // truncate

	const account_toAccountId_newSalt = generalise(utils.randomHex(32));

	let account_toAccountId_newCommitment = poseidonHash([
		BigInt(account_toAccountId_stateVarId),
		BigInt(account_toAccountId.hex(32)),
		BigInt(account_toAccountId_newOwnerPublicKey.hex(32)),
		BigInt(account_toAccountId_newSalt.hex(32)),
	]);

	account_toAccountId_newCommitment = generalise(
		account_toAccountId_newCommitment.hex(32)
	); // truncate

	// Call Zokrates to generate the proof:

	const allInputs = [
		fromAccountId.integer,
		toAccountId.integer,
		amount.integer,
		account_fromAccountId_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		account_fromAccountId_nullifier.integer,
		account_fromAccountId_prev.integer,
		account_fromAccountId_prevSalt.integer,
		account_fromAccountId_commitmentExists ? 0 : 1,
		account_fromAccountId_root.integer,
		account_fromAccountId_index.integer,
		account_fromAccountId_path.integer,
		account_fromAccountId_newOwnerPublicKey.integer,
		account_fromAccountId_newSalt.integer,
		account_fromAccountId_newCommitment.integer,

		account_toAccountId_commitmentExists
			? secretKey.limbs(32, 8)
			: generalise(0).limbs(32, 8),
		account_toAccountId_nullifier.integer,
		account_toAccountId_prev.integer,
		account_toAccountId_prevSalt.integer,
		account_toAccountId_commitmentExists ? 0 : 1,

		account_toAccountId_index.integer,
		account_toAccountId_path.integer,
		account_toAccountId_newOwnerPublicKey.integer,
		account_toAccountId_newSalt.integer,
		account_toAccountId_newCommitment.integer,
	].flat(Infinity);
	const res = await generateProof("transfer", allInputs);
	const proof = generalise(Object.values(res.proof).flat(Infinity))
		.map((coeff) => coeff.integer)
		.flat(Infinity);

	// Send transaction to the blockchain:

	const tx = await instance.methods
		.transfer(
			[
				account_fromAccountId_nullifier.integer,
				account_toAccountId_nullifier.integer,
			],
			account_fromAccountId_root.integer,
			[
				account_fromAccountId_newCommitment.integer,
				account_toAccountId_newCommitment.integer,
			],
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

	if (!preimage.account[account_fromAccountId_stateVarId_key.integer])
		preimage.account[account_fromAccountId_stateVarId_key.integer] = {};

	preimage.account[account_fromAccountId_stateVarId_key.integer] = {
		value: account_fromAccountId.integer,
		salt: account_fromAccountId_newSalt.integer,
		publicKey: account_fromAccountId_newOwnerPublicKey.integer,
		commitment: account_fromAccountId_newCommitment.integer,
	};

	if (!preimage.account) preimage.account = {};

	if (!preimage.account[account_toAccountId_stateVarId_key.integer])
		preimage.account[account_toAccountId_stateVarId_key.integer] = {};

	preimage.account[account_toAccountId_stateVarId_key.integer] = {
		value: account_toAccountId.integer,
		salt: account_toAccountId_newSalt.integer,
		publicKey: account_toAccountId_newOwnerPublicKey.integer,
		commitment: account_toAccountId_newCommitment.integer,
	};
	fs.writeFileSync(db, JSON.stringify(preimage, null, 4));

	return { tx };
}
