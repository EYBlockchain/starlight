import fs from 'fs';
import config from 'config';
import GN from 'general-number';
import utils from 'zkp-utils';
import logger from './logger.mjs';
import web3Instance from './web3.mjs';
import {
  scalarMult,
  compressStarlightKey,
  poseidonHash,
} from './number-theory.mjs';

const { generalise } = GN;
const keyDb = '/app/orchestration/common/db/key.json';

class Contract {
  constructor(contractName) {
    this.contractName = contractName;
    this.contractInterface = null;
    this.deployedAddress = null;
    this.contractInstance = null;
  }

  // Initialize the contract by loading its ABI and deployed address
  async init() {
	logger.info(`Initializing contract: ${this.contractName}`);
  
	this.contractInterface = await this.getContractInterface();
	if (!this.contractInterface || !this.contractInterface.abi) {
	  throw new Error(`Failed to load contract interface for ${this.contractName}`);
	}
	logger.info(`Contract interface loaded for ${this.contractName}`);
  
	this.deployedAddress = await this.getContractAddress();
	if (!this.deployedAddress) {
	  throw new Error(`Failed to get deployed address for ${this.contractName}`);
	}
	logger.info(`Contract deployed address retrieved: ${this.deployedAddress}`);
  
	const web3 = await web3Instance.getConnection();
	if (!web3) {
	  throw new Error('Failed to establish web3 connection');
	}
	logger.info('Web3 connection established');
  
	this.contractInstance = new web3.eth.Contract(this.contractInterface.abi, this.deployedAddress, config.web3.options);
	logger.info(`Contract instance created for ${this.contractName} at ${this.deployedAddress}`);
  }

  getInstance() {
    if (!this.contractInstance) {
      throw new Error('Contract instance is not initialized');
    }
    return this.contractInstance;
  }

  // Get the contract path based on the contract name
  getContractPath() {
    return `/app/build/contracts/${this.contractName}.json`;
  }

  // Load the contract interface (ABI) from the filesystem
  async getContractInterface() {
    if (this.contractInterface) {
      return this.contractInterface;
    }
    const path = this.getContractPath();
    this.contractInterface = JSON.parse(fs.readFileSync(path, 'utf8'));
    return this.contractInterface;
  }

  // Retrieve the deployed address of the contract from the network
  async getContractAddress() {
    if (this.deployedAddress) {
      return this.deployedAddress;
    }
    let deployedAddress;
    let errorCount = 0;

    // Attempt to retrieve the contract address, retrying on failure
    while (errorCount < 25) {
      try {
        const contractInterface = await this.getContractInterface();
        const web3 = await web3Instance.getConnection();
        const networkId = await web3.eth.net.getId();
        logger.silly('networkId:', networkId);

        if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
          deployedAddress = contractInterface.networks[networkId].address;
        }
        if (deployedAddress === undefined) throw new Error('Shield address was undefined');
        if (deployedAddress) break;
      } catch (err) {
        errorCount++;
        logger.warn('Unable to get a contract address - will try again in 5 seconds');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!deployedAddress) {
      throw new Error('Failed to retrieve contract address after multiple attempts');
    }

    logger.silly('deployed address:', deployedAddress);
    this.deployedAddress = deployedAddress;
    return deployedAddress;
  }

//   // Get the instance of the contract
//   getInstance() {
//     return this.contractInstance;
//   }

  // Get the bytecode of the contract
  async getContractBytecode() {
    const contractInterface = await this.getContractInterface();
    return contractInterface.evm.bytecode.object;
  }

  // Deploy the contract to the network
  async deploy(userAddress, userAddressPassword, constructorParams) {
    const web3 = await web3Instance.getConnection();
    logger.info(`\nUnlocking account ${userAddress}...`);
    await web3.eth.personal.unlockAccount(userAddress, userAddressPassword, 1);

    const bytecode = await this.getContractBytecode();

    const deployedContractAddress = await this.contractInstance
      .deploy({ data: `0x${bytecode}`, arguments: constructorParams })
      .send({
        from: userAddress,
        gas: config.web3.options.defaultGas,
      })
      .on('error', err => {
        throw new Error(err);
      })
      .then(deployedContractInstance => {
        logger.info(`${this.contractName} contract deployed at address ${deployedContractInstance.options.address}`);
        return deployedContractInstance.options.address;
      });

    return deployedContractAddress;
  }

  // Register a new key with the contract
  async registerKey(_secretKey, registerWithContract) {
    let secretKey = generalise(_secretKey);
    let publicKeyPoint = generalise(scalarMult(secretKey.hex(32), config.BABYJUBJUB.GENERATOR));
    let publicKey = compressStarlightKey(publicKeyPoint);

    // Regenerate the public key if it is too large
    while (publicKey === null) {
      logger.warn(`your secret key created a large public key - resetting`);
      secretKey = generalise(utils.randomHex(31));
      publicKeyPoint = generalise(scalarMult(secretKey.hex(32), config.BABYJUBJUB.GENERATOR));
      publicKey = compressStarlightKey(publicKeyPoint);
    }

    // If required, register the key with the contract
    if (registerWithContract) {
      const contractAddr = await this.getContractAddress();
      const txData = await this.contractInstance.methods.registerZKPPublicKey(publicKey.integer).encodeABI();

      const web3 = await web3Instance.getConnection();
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
      publicKey: publicKey.integer,
    };

    fs.writeFileSync(keyDb, JSON.stringify(keyJson, null, 4));

    return publicKey;
  }
}

export default Contract;
