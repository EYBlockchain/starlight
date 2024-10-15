/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import utils from "zkp-utils";
import GN from "general-number";
import fs from "fs";
import mongo from "./common/mongo.mjs";

import {
	storeCommitment,
	markNullified,
} from "./common/commitment-storage.mjs";

import { getContractInstance, getContractAddress } from "./common/contract.mjs";

import Web3 from "./common/web3.mjs";
import {
	decompressStarlightKey,
	compressStarlightKey,
	encrypt,
	decrypt,
	poseidonHash,
	scalarMult,
} from "./common/number-theory.mjs";

const { generalise } = GN;
const web3 = Web3.connection();
const keyDb = "/app/orchestration/common/db/key.json";
const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;

export async function backupDataRetriever() {
	const connection = await mongo.connection(MONGO_URL);
	const db = connection.db(COMMITMENTS_DB);

	try {
		// Get the list of all collections in the database
		const collections = await db.listCollections().toArray();

		// Drop each collection
		for (let collection of collections) {
			await db.collection(collection.name).drop();
		}
		console.log("Database emptied");
	} catch (err) {
		console.error("Error emptying database:", err);
	}

	const instance = await getContractInstance("AssignShield");

	const contractAddr = await getContractAddress("AssignShield");

	const backDataEvent = await instance.getPastEvents("EncryptedBackupData", {
		fromBlock: 0,
		toBlock: "latest",
	});

	const keys = JSON.parse(
		fs.readFileSync(keyDb, "utf-8", (err) => {
			console.log(err);
		})
	);
	const secretKey = generalise(keys.secretKey);
	const publicKey = generalise(keys.publicKey);
	let storedCommitments = [];
	for (const log of backDataEvent) {
		for (let i = 0; i < log.returnValues.encPreimages.length; i++) {
			let cipherText = log.returnValues.encPreimages[i].cipherText;
			let ephPublicKey = log.returnValues.encPreimages[i].ephPublicKey;
			let varName = log.returnValues.encPreimages[i].varName;
			let name = varName.replace(" a", "").replace(" s", "").replace(" u", "");
			let isArray = false;
			let isStruct = false;
			if (varName.includes(" a")) {
				isArray = true;
			} else if (varName.includes(" s")) {
				isStruct = true;
			}
			const plainText = decrypt(cipherText, secretKey.hex(32), [
				decompressStarlightKey(generalise(ephPublicKey))[0].hex(32),
				decompressStarlightKey(generalise(ephPublicKey))[1].hex(32),
			]);
			let mappingKey = null;
			let stateVarId;
			let value;
			console.log(
				"Decrypted pre-image of commitment for variable name: " + name + ": "
			);
			let salt = generalise(plainText[0]);
			console.log(`\tSalt: ${salt.integer}`);
			if (isArray) {
				console.log(`\tState variable StateVarId: ${plainText[2]}`);
				mappingKey = generalise(plainText[1]);
				console.log(`\tMapping Key: ${mappingKey.integer}`);
				let reGenStateVarId = generalise(
					utils.mimcHash(
						[generalise(plainText[2]).bigInt, generalise(plainText[1]).bigInt],
						"ALT_BN_254"
					)
				);
				stateVarId = reGenStateVarId;
				console.log(`Regenerated StateVarId: ${reGenStateVarId.bigInt}`);
				value = generalise(plainText[3]);
				console.log(`\tValue: ${value.integer}`);
			} else {
				stateVarId = generalise(plainText[1]);
				console.log(`\tStateVarId: ${plainText[1]}`);
				if (isStruct) {
					value = {};
					console.log(`\tValue: ${value}`);
				} else {
					value = generalise(plainText[2]);
					console.log(`\tValue: ${value.integer}`);
				}
			}
			let newCommitment;
			if (isStruct) {
				let hashInput = [BigInt(stateVarId.hex(32))];
				for (let i = 2; i < plainText.length; i++) {
					hashInput.push(BigInt(generalise(plainText[i]).hex(32)));
				}
				hashInput.push(BigInt(publicKey.hex(32)));
				hashInput.push(BigInt(salt.hex(32)));
				newCommitment = generalise(poseidonHash(hashInput));
			} else {
				newCommitment = generalise(
					poseidonHash([
						BigInt(stateVarId.hex(32)),
						BigInt(value.hex(32)),
						BigInt(publicKey.hex(32)),
						BigInt(salt.hex(32)),
					])
				);
			}
			if (!varName.includes(" u")) {
				let oldCommitments = storedCommitments.filter(
					(element) =>
						element.stateVarId.integer === stateVarId.integer &&
						(!mappingKey || element.mappingKey === mappingKey?.integer)
				);
				for (const oldCommitment of oldCommitments) {
					await markNullified(oldCommitment.hash, secretKey.hex(32));
					let index = storedCommitments.findIndex(
						(element) => element === oldCommitment
					);
					if (index !== -1) {
						storedCommitments.splice(index, 1);
					}
				}
			}
			await storeCommitment({
				hash: newCommitment,
				name: name,
				mappingKey: mappingKey?.integer,
				preimage: {
					stateVarId: stateVarId,
					value: value,
					salt: salt,
					publicKey: publicKey,
				},
				secretKey: secretKey,
				isNullified: false,
			});
			storedCommitments.push({
				stateVarId: stateVarId,
				hash: newCommitment,
				mappingKey: mappingKey?.integer,
			});
		}
	}
}
