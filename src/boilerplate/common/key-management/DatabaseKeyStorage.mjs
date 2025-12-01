/**
 * @file DatabaseKeyStorage.mjs
 * @description MongoDB-based key storage implementation for multi-tenant deployments.
 * Provides complete isolation between users based on accountId.
 */

import config from 'config';
import GN from 'general-number';
import utils from 'zkp-utils';
import mongo from '../mongo.mjs';
import logger from '../logger.mjs';
import { IKeyStorage } from './IKeyStorage.mjs';
import { encryptIfEnabled, decryptIfEncrypted } from './encryption.mjs';
import {
  scalarMult,
  compressStarlightKey,
  sharedSecretKey,
} from '../number-theory.mjs';

const { generalise } = GN;

// Configuration
const MONGO_URL = process.env.MONGO_URL || config.MONGO_URL || 'mongodb://localhost:27017';
const KEYS_DB = process.env.KEYS_DB || config.KEYS_DB || config.COMMITMENTS_DB || 'starlight_db';
const USER_KEYS_COLLECTION = 'user_keys';

/**
 * Database-based key storage implementation.
 * Stores keys in MongoDB with complete isolation between users.
 * Supports encryption at rest for sensitive key material.
 * 
 * @extends IKeyStorage
 */
export class DatabaseKeyStorage extends IKeyStorage {
  constructor() {
    super();
    this.mongoUrl = MONGO_URL;
    this.dbName = KEYS_DB;
    this.collectionName = USER_KEYS_COLLECTION;
  }

  /**
   * Get MongoDB collection instance.
   * 
   * @returns {Promise<import('mongodb').Collection>}
   * @private
   */
  async getCollection() {
    const connection = await mongo.connection(this.mongoUrl);
    const db = connection.db(this.dbName);
    return db.collection(this.collectionName);
  }

  /**
   * Validate that context is provided and contains accountId.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} context
   * @throws {Error} If context is missing or invalid
   * @private
   */
  validateContext(context) {
    if (!context || !context.accountId) {
      throw new Error(
        'DatabaseKeyStorage requires a valid SaaS context with accountId. ' +
        'Ensure x-saas-context header is present in the request.'
      );
    }

    // Validate accountId format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(context.accountId)) {
      throw new Error('Invalid accountId format. Must contain only alphanumeric characters, hyphens, and underscores.');
    }
  }

  /**
   * Retrieve keys for a user from the database.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} context - Required SaaS context
   * @returns {Promise<import('./IKeyStorage.mjs').UserKeys|null>} User keys or null if not found
   */
  async getKeys(context) {
    this.validateContext(context);

    try {
      const collection = await this.getCollection();
      const doc = await collection.findOne({ accountId: context.accountId });

      if (!doc) {
        logger.debug(`No keys found for accountId: ${context.accountId}`);
        return null;
      }

      // Update lastUsed timestamp
      await collection.updateOne(
        { accountId: context.accountId },
        { 
          $set: { 
            'metadata.lastUsed': new Date(),
            updatedAt: new Date()
          } 
        }
      );

      // Decrypt sensitive keys
      const keys = {
        secretKey: decryptIfEncrypted(doc.secretKey),
        publicKey: doc.publicKey, // Public key doesn't need decryption
        ethSK: doc.ethSK ? decryptIfEncrypted(doc.ethSK) : null, // Ethereum private key (encrypted)
        ethPK: doc.ethPK || null,
      };

      if (doc.sharedSecretKey) {
        keys.sharedSecretKey = decryptIfEncrypted(doc.sharedSecretKey);
      }
      if (doc.sharedPublicKey) {
        keys.sharedPublicKey = doc.sharedPublicKey;
      }

      logger.debug(`Keys retrieved for accountId: ${context.accountId}`);
      return keys;
    } catch (error) {
      logger.error(`Error retrieving keys for accountId ${context.accountId}:`, error);
      throw new Error(`Failed to retrieve keys: ${error.message}`);
    }
  }

  /**
   * Save keys for a user to the database.
   * 
   * @param {import('./IKeyStorage.mjs').UserKeys} keys - User keys to save
   * @param {import('./IKeyStorage.mjs').SaaSContext} context - Required SaaS context
   * @returns {Promise<void>}
   */
  async saveKeys(keys, context) {
    this.validateContext(context);

    try {
      const collection = await this.getCollection();
      const now = new Date();

      // Encrypt sensitive keys
      const doc = {
        accountId: context.accountId,
        secretKey: encryptIfEnabled(keys.secretKey),
        publicKey: keys.publicKey, // Public key doesn't need encryption
        updatedAt: now,
      };

      // Include Ethereum keys if present
      if (keys.ethSK) {
        doc.ethSK = encryptIfEnabled(keys.ethSK);
      }
      if (keys.ethPK) {
        doc.ethPK = keys.ethPK;
      }

      // Include optional shared keys if present
      if (keys.sharedSecretKey) {
        doc.sharedSecretKey = encryptIfEnabled(keys.sharedSecretKey);
      }
      if (keys.sharedPublicKey) {
        doc.sharedPublicKey = keys.sharedPublicKey;
      }

      // Upsert: update if exists, insert if not
      const result = await collection.updateOne(
        { accountId: context.accountId },
        {
          $set: doc,
          $setOnInsert: {
            createdAt: now,
            metadata: {
              keyVersion: 1,
              registeredOnChain: false,
            }
          }
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        logger.info(`Keys created for accountId: ${context.accountId}`);
      } else {
        logger.debug(`Keys updated for accountId: ${context.accountId}`);
      }
    } catch (error) {
      logger.error(`Error saving keys for accountId ${context.accountId}:`, error);
      throw new Error(`Failed to save keys: ${error.message}`);
    }
  }

  /**
   * Register a new key pair.
   * 
   * @param {string} _secretKey - Secret key to register (hex string)
   * @param {string} contractName - Associated contract name
   * @param {boolean} registerWithContract - Whether to register the key on-chain
   * @param {import('./IKeyStorage.mjs').SaaSContext} context - Required SaaS context
   * @returns {Promise<string>} Public key (as integer string)
   */
  async registerKey(_secretKey, contractName, registerWithContract, context) {
    this.validateContext(context);

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

      const Web3 = await import('../web3.mjs');
      const web3 = Web3.default.connection();
      const ethAccount = web3.eth.accounts.create();
      const ethSK = ethAccount.privateKey;
      const ethPK = ethAccount.address;

      logger.info(`Generated Ethereum address for tenant ${context.accountId}: ${ethPK}`);

      // AUTO-FUND tenant address with gas
      const { autoFundIfNeeded } = await import('../gas-funding.mjs');
      await autoFundIfNeeded(ethPK, '0.1', '0.5');
      logger.info(`Auto-funded tenant address ${ethPK} with gas. Ready to send transactions!`);

      // Register on-chain if requested
      if (registerWithContract) {
        const { getContractInstance, getContractAddress } = await import('../contract.mjs');

        const instance = await getContractInstance(contractName);
        const contractAddr = await getContractAddress(contractName);
        const txData = await instance.methods
          .registerZKPPublicKey(publicKey.integer)
          .encodeABI();

        const txParams = {
          from: ethPK,
          to: contractAddr,
          gas: config.web3.options.defaultGas,
          gasPrice: config.web3.options.defaultGasPrice,
          data: txData,
          chainId: await web3.eth.net.getId(),
        };

        const signed = await web3.eth.accounts.signTransaction(txParams, ethSK);
        await web3.eth.sendSignedTransaction(signed.rawTransaction);
        logger.info(`Key registered on-chain for accountId: ${context.accountId}`);
      }

      // Save keys to database with metadata
      await this.saveKeys({
        secretKey: secretKey.integer,
        publicKey: publicKey.integer,
        ethSK,
        ethPK,
      }, context);

      // Update metadata
      const collection = await this.getCollection();
      await collection.updateOne(
        { accountId: context.accountId },
        {
          $set: {
            'metadata.contractName': contractName,
            'metadata.registeredOnChain': registerWithContract,
          }
        }
      );

      logger.info(`Key registered successfully for accountId: ${context.accountId}`);
      return publicKey.integer;
    } catch (error) {
      logger.error(`Error registering key for accountId ${context.accountId}:`, error);
      throw new Error(`Failed to register key: ${error.message}`);
    }
  }

  /**
   * Get or create shared secret keys for encrypted communication.
   *
   * @param {string} _recipientAddress - Recipient's Ethereum address
   * @param {string|number} _recipientPublicKey - Recipient's public key (0 to fetch from contract)
   * @param {import('./IKeyStorage.mjs').SaaSContext} context - Required SaaS context
   * @returns {Promise<string>} Shared public key
   */
  async getSharedSecretKeys(_recipientAddress, _recipientPublicKey = 0, context) {
    this.validateContext(context);

    try {
      // Ensure keys exist
      let keys = await this.getKeys(context);
      if (!keys) {
        await this.registerKey(utils.randomHex(31), null, false, context);
        keys = await this.getKeys(context);
      }

      const secretKey = generalise(keys.secretKey);
      const publicKey = generalise(keys.publicKey);
      let recipientPublicKey = generalise(_recipientPublicKey);
      const recipientAddress = generalise(_recipientAddress);

      // Fetch recipient's public key from contract if not provided
      if (_recipientPublicKey === 0) {
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
      logger.debug(`Shared key generated for accountId: ${context.accountId}`);

      // Update keys with shared secret
      await this.saveKeys({
        secretKey: secretKey.integer,
        publicKey: publicKey.integer,
        sharedSecretKey: sharedKey[0].integer,
        sharedPublicKey: sharedKey[1].integer,
      }, context);

      return sharedKey[1];
    } catch (error) {
      logger.error(`Error getting shared secret keys for accountId ${context.accountId}:`, error);
      throw new Error(`Failed to get shared secret keys: ${error.message}`);
    }
  }

  /**
   * Check if keys exist for a user in the database.
   *
   * @param {import('./IKeyStorage.mjs').SaaSContext} context - Required SaaS context
   * @returns {Promise<boolean>} True if keys exist
   */
  async hasKeys(context) {
    this.validateContext(context);

    try {
      const collection = await this.getCollection();
      const count = await collection.countDocuments({ accountId: context.accountId });
      return count > 0;
    } catch (error) {
      logger.error(`Error checking keys for accountId ${context.accountId}:`, error);
      throw new Error(`Failed to check keys: ${error.message}`);
    }
  }

  /**
   * Delete keys for a user from the database.
   *
   * @param {import('./IKeyStorage.mjs').SaaSContext} context - Required SaaS context
   * @returns {Promise<boolean>} True if keys were deleted, false if they didn't exist
   */
  async deleteKeys(context) {
    this.validateContext(context);

    try {
      const collection = await this.getCollection();
      const result = await collection.deleteOne({ accountId: context.accountId });

      if (result.deletedCount > 0) {
        logger.info(`Keys deleted for accountId: ${context.accountId}`);
        return true;
      }

      logger.debug(`No keys found to delete for accountId: ${context.accountId}`);
      return false;
    } catch (error) {
      logger.error(`Error deleting keys for accountId ${context.accountId}:`, error);
      throw new Error(`Failed to delete keys: ${error.message}`);
    }
  }

  async getAccountIdByEthAddress(ethAddress) {
    try {
      const collection = await this.getCollection();
      const doc = await collection.findOne(
        { ethPK: ethAddress },
        { projection: { accountId: 1 } }
      );

      if (!doc) {
        logger.debug(`No accountId found for Ethereum address: ${ethAddress}`);
        return null;
      }

      logger.debug(`Found accountId ${doc.accountId} for Ethereum address ${ethAddress}`);
      return doc.accountId;
    } catch (error) {
      logger.error(`Error looking up accountId for Ethereum address ${ethAddress}:`, error);
      throw new Error(`Failed to lookup accountId: ${error.message}`);
    }
  }
}

export default DatabaseKeyStorage;
