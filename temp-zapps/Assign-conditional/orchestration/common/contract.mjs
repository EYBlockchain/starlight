import fs from "fs";
import config from "config";
import GN from "general-number";
import utils from "zkp-utils";
import Web3 from "./web3.mjs";
import logger from "./logger.mjs";

import {
	scalarMult,
	compressStarlightKey,
	poseidonHash,
} from "./number-theory.mjs";

const web3 = Web3.connection();
const { generalise } = GN;
const keyDb = "/app/orchestration/common/db/key.json";

export const contractPath = (contractName) => {
	return `/app/build/contracts/${contractName}.json`;
};

const { options } = config.web3;

export async function getContractInterface(contractName) {
	const path = contractPath(contractName);
	const contractInterface = JSON.parse(fs.readFileSync(path, "utf8"));
	// logger.debug('\ncontractInterface:', contractInterface);
	return contractInterface;
}

export async function getContractAddress(contractName) {
	let deployedAddress;
	let errorCount = 0;

	if (!deployedAddress) {
		while (errorCount < 25) {
			try {
				const contractInterface = await getContractInterface(contractName);
				const networkId = await web3.eth.net.getId();
				logger.silly("networkId:", networkId);

				if (
					contractInterface &&
					contractInterface.networks &&
					contractInterface.networks[networkId]
				) {
					deployedAddress = contractInterface.networks[networkId].address;
				}
				if (deployedAddress === undefined)
					throw new Error("Shield address was undefined");
				if (deployedAddress) break;
			} catch (err) {
				errorCount++;
				logger.warn(
					"Unable to get a contract address - will try again in 5 seconds"
				);
				await new Promise((resolve) => setTimeout(() => resolve(), 5000));
			}
		}
	}

	logger.silly("deployed address:", deployedAddress);
	return deployedAddress;
}

// returns a web3 contract instance
export async function getContractInstance(contractName, deployedAddress) {
	const contractInterface = await getContractInterface(contractName);
	if (!deployedAddress) {
		// eslint-disable-next-line no-param-reassign
		deployedAddress = await getContractAddress(contractName);
	}

	const contractInstance = deployedAddress
		? new web3.eth.Contract(contractInterface.abi, deployedAddress, options)
		: new web3.eth.Contract(contractInterface.abi, null, options);
	// logger.silly('\ncontractInstance:', contractInstance);
	logger.info(`${contractName} Address: ${deployedAddress}`);

	return contractInstance;
}

export async function getContractBytecode(contractName) {
	const contractInterface = await getContractInterface(contractName);
	return contractInterface.evm.bytecode.object;
}

export async function deploy(
	userAddress,
	userAddressPassword,
	contractName,
	constructorParams
) {
	logger.info(`\nUnlocking account ${userAddress}...`);
	await web3.eth.personal.unlockAccount(userAddress, userAddressPassword, 1);

	const contractInstance = await getContractInstance(contractName); // get a web3 contract instance of the contract
	const bytecode = await getContractBytecode(contractName);

	const deployedContractAddress = await contractInstance
		.deploy({ data: `0x${bytecode}`, arguments: constructorParams })
		.send({
			from: userAddress,
			gas: config.web3.options.defaultGas,
		})
		.on("error", (err) => {
			throw new Error(err);
		})
		.then((deployedContractInstance) => {
			// logger.silly('deployed contract instance:', deployedContractInstance);
			logger.info(
				`${contractName} contract deployed at address ${deployedContractInstance.options.address}`
			); // instance with the new contract address

			return deployedContractInstance.options.address;
		});
	return deployedContractAddress;
}

export async function registerKey(
	_secretKey,
	contractName,
	registerWithContract
) {
	let secretKey = generalise(_secretKey);
	let publicKeyPoint = generalise(
		scalarMult(secretKey.hex(32), config.BABYJUBJUB.GENERATOR)
	);
	let publicKey = compressStarlightKey(publicKeyPoint);
	while (publicKey === null) {
		logger.warn(`your secret key created a large public key - resetting`);
		secretKey = generalise(utils.randomHex(31));
		publicKeyPoint = generalise(
			scalarMult(secretKey.hex(32), config.BABYJUBJUB.GENERATOR)
		);
		publicKey = compressStarlightKey(publicKeyPoint);
	}
	if (registerWithContract) {
		const instance = await getContractInstance(contractName);
		const contractAddr = await getContractAddress(contractName);
		const txData = await instance.methods
			.registerZKPPublicKey(publicKey.integer)
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
	}
	const keyJson = {
		secretKey: secretKey.integer,
		publicKey: publicKey.integer, // not req
	};
	fs.writeFileSync(keyDb, JSON.stringify(keyJson, null, 4));

	return publicKey;
}
