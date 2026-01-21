import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from 'config';
import GN from 'general-number';
import Web3 from './web3.mjs';
import logger from './logger.mjs';

const web3 = Web3.connection();
const { generalise } = GN;
const keyDbPath = process.env.KEY_DB_PATH
	|| path.resolve(path.dirname(fileURLToPath(import.meta.url)), './db/key.json');

function loadKeysFromDisk() {
	if (!fs.existsSync(keyDbPath)) return null;
	try {
		return JSON.parse(fs.readFileSync(keyDbPath, 'utf8'));
	} catch (err) {
		logger.warn('Unable to read key database, regenerating keys', err);
		return null;
	}
}

function persistKeys(keys) {
	fs.mkdirSync(path.dirname(keyDbPath), { recursive: true });
	fs.writeFileSync(keyDbPath, JSON.stringify(keys, null, 2));
}

export const contractPath = (contractName) => {
	return `/app/build/contracts/${contractName}.json`;
};

const { options } = config.web3;

export async function getContractInterface(contractName) {
	const path = contractPath(contractName);
  const contractInterface = JSON.parse(fs.readFileSync(path, 'utf8'));
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
        logger.silly('networkId:', networkId);

				if (
					contractInterface &&
					contractInterface.networks &&
					contractInterface.networks[networkId]
				) {
					deployedAddress = contractInterface.networks[networkId].address;
				}
        if (deployedAddress === undefined) throw new Error('Shield address was undefined');
				if (deployedAddress) break;
			} catch (err) {
				errorCount++;
        logger.warn('Unable to get a contract address - will try again in 5 seconds');
        await new Promise(resolve => setTimeout(() => resolve(), 5000));
			}
		}
	}

  logger.silly('deployed address:', deployedAddress);
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
	// Support both Hardhat format (bytecode) and Truffle/Solc format (evm.bytecode.object)
	if (contractInterface.bytecode) {
		return contractInterface.bytecode;
	} else if (contractInterface.evm?.bytecode?.object) {
		return contractInterface.evm.bytecode.object;
	}
	throw new Error(`Bytecode not found for contract ${contractName}`);
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
    .on('error', err => {
			throw new Error(err);
		})
    .then(deployedContractInstance => {
			// logger.silly('deployed contract instance:', deployedContractInstance);
			logger.info(
        `${contractName} contract deployed at address ${deployedContractInstance.options.address}`,
			); // instance with the new contract address

			return deployedContractInstance.options.address;
		});
	return deployedContractAddress;
}

export async function registerKey(
	_secretKey,
	contractName,
  registerWithContract,
  context,
) {
	try {
		const secretKeyGN = generalise(_secretKey);
		const secretKey = secretKeyGN.hex ? secretKeyGN.hex(32) : `${secretKeyGN}`;
		const publicKeyGN = secretKeyGN;
		const publicKey = publicKeyGN.hex ? publicKeyGN.hex(32) : `${publicKeyGN}`;
		const sharedPublicKey = publicKey;
		const sharedSecretKey = secretKey;
		const keys = {
			secretKey,
			publicKey,
			sharedPublicKey,
			sharedSecretKey,
			ethPK: config.web3.options.defaultAccount,
			ethSK: config.web3.key,
		};
		persistKeys(keys);
		logger.info('Key registered successfully', {
			publicKey,
		});
		return generalise(publicKey);
	} catch (error) {
		logger.error('Failed to register key:', error);
		throw error;
	}
}

export function getStoredKeys() {
	return loadKeysFromDisk();
}