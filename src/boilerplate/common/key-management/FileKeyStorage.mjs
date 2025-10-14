/**
 * @file FileKeyStorage.mjs
 * @description File-based key storage implementation.
 * This wraps the existing key.json file-based logic for backward compatibility.
 */

import fs from 'fs';
import config from 'config';
import GN from 'general-number';
import utils from 'zkp-utils';
import logger from '../logger.mjs';
import { IKeyStorage } from './IKeyStorage.mjs';
import {
  scalarMult,
  compressStarlightKey,
  sharedSecretKey,
} from '../number-theory.mjs';

const { generalise } = GN;
const keyDb = '/app/orchestration/common/db/key.json';

/**
 * File-based key storage implementation.
 * Stores keys in a single JSON file at /app/orchestration/common/db/key.json
 * This is the legacy/default storage mechanism for single-tenant deployments.
 * 
 * @extends IKeyStorage
 */
export class FileKeyStorage extends IKeyStorage {
  constructor() {
    super();
    this.keyFilePath = keyDb;
  }

  /**
   * Retrieve keys from the key.json file.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Ignored for file storage
   * @returns {Promise<import('./IKeyStorage.mjs').UserKeys|null>} User keys or null if file doesn't exist
   */
  async getKeys(context) {
    try {
      if (!fs.existsSync(this.keyFilePath)) {
        logger.debug('Key file does not exist');
        return null;
      }

      const keyData = fs.readFileSync(this.keyFilePath, 'utf-8');
      const keys = JSON.parse(keyData);

      logger.debug('Keys retrieved from file');
      return {
        secretKey: keys.secretKey,
        publicKey: keys.publicKey,
        sharedSecretKey: keys.sharedSecretKey,
        sharedPublicKey: keys.sharedPublicKey,
      };
    } catch (error) {
      logger.error('Error reading keys from file:', error);
      throw new Error(`Failed to read keys from file: ${error.message}`);
    }
  }

  /**
   * Save keys to the key.json file.
   * 
   * @param {import('./IKeyStorage.mjs').UserKeys} keys - User keys to save
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Ignored for file storage
   * @returns {Promise<void>}
   */
  async saveKeys(keys, context) {
    try {
      // Ensure directory exists
      const dir = '/app/orchestration/common/db';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const keyJson = {
        secretKey: keys.secretKey,
        publicKey: keys.publicKey,
      };

      // Include optional shared keys if present
      if (keys.sharedSecretKey) {
        keyJson.sharedSecretKey = keys.sharedSecretKey;
      }
      if (keys.sharedPublicKey) {
        keyJson.sharedPublicKey = keys.sharedPublicKey;
      }

      fs.writeFileSync(this.keyFilePath, JSON.stringify(keyJson, null, 4));
      logger.debug('Keys saved to file');
    } catch (error) {
      logger.error('Error saving keys to file:', error);
      throw new Error(`Failed to save keys to file: ${error.message}`);
    }
  }

  /**
   * Register a new key pair.
   * This replicates the logic from contract.mjs registerKey() function.
   * 
   * @param {string} _secretKey - Secret key to register (hex string)
   * @param {string} contractName - Associated contract name
   * @param {boolean} registerWithContract - Whether to register the key on-chain
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Ignored for file storage
   * @returns {Promise<string>} Public key (as integer string)
   */
  async registerKey(_secretKey, contractName, registerWithContract, context) {
    try {
      let secretKey = generalise(_secretKey);
      let publicKeyPoint = generalise(
        scalarMult(secretKey.hex(32), config.BABYJUBJUB.GENERATOR)
      );
      let publicKey = compressStarlightKey(publicKeyPoint);

      // Regenerate if public key is too large
      while (publicKey === null) {
        logger.warn('Secret key created a large public key - regenerating');
        secretKey = generalise(utils.randomHex(31));
        publicKeyPoint = generalise(
          scalarMult(secretKey.hex(32), config.BABYJUBJUB.GENERATOR)
        );
        publicKey = compressStarlightKey(publicKeyPoint);
      }

      // Register on-chain if requested
      if (registerWithContract) {
        // Import here to avoid circular dependency
        const { getContractInstance, getContractAddress } = await import('../contract.mjs');
        const Web3 = await import('../web3.mjs');
        const web3 = Web3.default.connection();

        const instance = await getContractInstance(contractName);
        const contractAddr = await getContractAddress(contractName);
        const txData = await instance.methods
          .registerZKPPublicKey(publicKey.integer)
          .encodeABI();

        const txParams = {
          from: config.web3.options.defaultAccount,
          to: contractAddr,
          gas: config.web3.options.defaultGas,
          gasPrice: config.web3.options.defaultGasPrice,
          data: txData,
          chainId: await web3.eth.net.getId(),
        };

        const key = config.web3.key;
        const signed = await web3.eth.accounts.signTransaction(txParams, key);
        await web3.eth.sendSignedTransaction(signed.rawTransaction);
        logger.info('Key registered on-chain');
      }

      // Save keys to file
      await this.saveKeys({
        secretKey: secretKey.integer,
        publicKey: publicKey.integer,
      });

      logger.info('Key registered successfully');
      return publicKey.integer;
    } catch (error) {
      logger.error('Error registering key:', error);
      throw new Error(`Failed to register key: ${error.message}`);
    }
  }

  /**
   * Get or create shared secret keys for encrypted communication.
   * This replicates the logic from commitment-storage.mjs getSharedSecretskeys() function.
   * 
   * @param {string} _recipientAddress - Recipient's Ethereum address
   * @param {string|number} _recipientPublicKey - Recipient's public key (0 to fetch from contract)
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Ignored for file storage
   * @returns {Promise<string>} Shared public key
   */
  async getSharedSecretKeys(_recipientAddress, _recipientPublicKey = 0, context) {
    try {
      // Ensure keys exist
      if (!fs.existsSync(this.keyFilePath)) {
        await this.registerKey(utils.randomHex(31), null, false);
      }

      const keys = await this.getKeys();
      const secretKey = generalise(keys.secretKey);
      const publicKey = generalise(keys.publicKey);
      let recipientPublicKey = generalise(_recipientPublicKey);
      const recipientAddress = generalise(_recipientAddress);

      // Fetch recipient's public key from contract if not provided
      if (_recipientPublicKey === 0) {
        // Import here to avoid circular dependency
        const { getContractInstance } = await import('../contract.mjs');
        const instance = await getContractInstance('CONTRACT_NAME');
        
        recipientPublicKey = await instance.methods
          .zkpPublicKeys(recipientAddress.hex(20))
          .call();
        recipientPublicKey = generalise(recipientPublicKey);

        if (recipientPublicKey.length === 0) {
          throw new Error('Public key for given eth address not found');
        }
      }

      // Generate shared secret
      const sharedKey = sharedSecretKey(secretKey, recipientPublicKey);
      logger.debug('Shared key generated:', sharedKey[1]);

      // Update keys with shared secret
      await this.saveKeys({
        secretKey: secretKey.integer,
        publicKey: publicKey.integer,
        sharedSecretKey: sharedKey[0].integer,
        sharedPublicKey: sharedKey[1].integer,
      });

      return sharedKey[1];
    } catch (error) {
      logger.error('Error getting shared secret keys:', error);
      throw new Error(`Failed to get shared secret keys: ${error.message}`);
    }
  }

  /**
   * Check if keys exist in the file.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Ignored for file storage
   * @returns {Promise<boolean>} True if key file exists
   */
  async hasKeys(context) {
    return fs.existsSync(this.keyFilePath);
  }

  /**
   * Delete the key file.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Ignored for file storage
   * @returns {Promise<boolean>} True if file was deleted, false if it didn't exist
   */
  async deleteKeys(context) {
    try {
      if (fs.existsSync(this.keyFilePath)) {
        fs.unlinkSync(this.keyFilePath);
        logger.info('Key file deleted');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error deleting key file:', error);
      throw new Error(`Failed to delete key file: ${error.message}`);
    }
  }
}

export default FileKeyStorage;

