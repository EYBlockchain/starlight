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
import {
	decompressStarlightKey,
	compressStarlightKey,
	encrypt,
	decrypt,
	poseidonHash,
	scalarMult,
} from "./common/number-theory.mjs";

const { generalise } = GN;
const db = "/app/orchestration/common/db/preimage.json";
const keyDb = "/app/orchestration/common/db/key.json";

export class AddManager {
	constructor(web3) {
		this.web3 = web3;
	}

	async init() {
		this.instance = await getContractInstance("AssignShield");
		this.contractAddr = await getContractAddress("AssignShield");
	}

	async add(_value, _a_newOwnerPublicKey = 0) {
		const instance = this.instance;
		const contractAddr = this.contractAddr;
		const web3 = this.web3;

		const msgValue = 0;
		const value = generalise(_value);
		let a_newOwnerPublicKey = generalise(_a_newOwnerPublicKey);

		// Read dbs for keys and previous commitment values:

		if (!fs.existsSync(keyDb))
			await registerKey(utils.randomHex(31), "AssignShield", false);
		const keys = JSON.parse(
			fs.readFileSync(keyDb, "utf-8", (err) => {
				console.log(err);
			})
		);
		const secretKey = generalise(keys.secretKey);
		const publicKey = generalise(keys.publicKey);

		// read preimage for incremented state
		a_newOwnerPublicKey =
			_a_newOwnerPublicKey === 0 ? publicKey : a_newOwnerPublicKey;

		const a_stateVarId = generalise(3).hex(32);

		const a_newCommitmentValue = generalise(parseInt(value.integer, 10));

		// increment would go here but has been filtered out

		// Calculate commitment(s):

		const a_newSalt = generalise(utils.randomHex(31));

		let a_newCommitment = poseidonHash([
			BigInt(a_stateVarId),
			BigInt(a_newCommitmentValue.hex(32)),
			BigInt(a_newOwnerPublicKey.hex(32)),
			BigInt(a_newSalt.hex(32)),
		]);

		a_newCommitment = generalise(a_newCommitment.hex(32)); // truncate

		// Call Zokrates to generate the proof:

		const allInputs = [
			value.integer,
			a_newOwnerPublicKey.integer,
			a_newSalt.integer,
			a_newCommitment.integer,
		].flat(Infinity);
		const res = await generateProof("add", allInputs);
		const proof = generalise(Object.values(res.proof).flat(Infinity))
			.map((coeff) => coeff.integer)
			.flat(Infinity);

		let BackupData = [];

		// Encrypt pre-image for state variable a as a backup:

		let a_ephSecretKey = generalise(utils.randomHex(31));

		let a_ephPublicKeyPoint = generalise(
			scalarMult(a_ephSecretKey.hex(32), config.BABYJUBJUB.GENERATOR)
		);

		let a_ephPublicKey = compressStarlightKey(a_ephPublicKeyPoint);

		while (a_ephPublicKey === null) {
			a_ephSecretKey = generalise(utils.randomHex(31));

			a_ephPublicKeyPoint = generalise(
				scalarMult(a_ephSecretKey.hex(32), config.BABYJUBJUB.GENERATOR)
			);

			a_ephPublicKey = compressStarlightKey(a_ephPublicKeyPoint);
		}

		const a_bcipherText = encrypt(
			[
				BigInt(a_newSalt.hex(32)),
				BigInt(a_stateVarId),
				BigInt(a_newCommitmentValue.hex(32)),
			],
			a_ephSecretKey.hex(32),
			[
				decompressStarlightKey(a_newOwnerPublicKey)[0].hex(32),
				decompressStarlightKey(a_newOwnerPublicKey)[1].hex(32),
			]
		);

		let a_cipherText_combined = {
			varName: "a u",
			cipherText: a_bcipherText,
			ephPublicKey: a_ephPublicKey.hex(32),
		};

		BackupData.push(a_cipherText_combined);

		// Send transaction to the blockchain:

		const txData = await instance.methods
			.add(
				{
					customInputs: [1],
					nullifierRoot: 0,
					latestNullifierRoot: 0,
					newNullifiers: [],
					commitmentRoot: 0,
					newCommitments: [a_newCommitment.integer],
					cipherText: [],
					encKeys: [],
				},
				proof,
				BackupData
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

		let encBackupEvent = "";

		try {
			encBackupEvent = await instance.getPastEvents("EncryptedBackupData");
		} catch (err) {
			console.log("No encrypted backup event");
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

		return { tx, encEvent, encBackupEvent };
	}
}
