/**
 * @file IKeyStorage.mjs
 * @description Interface definition for key storage implementations.
 * This file defines the contract that both FileKeyStorage and DatabaseKeyStorage must implement.
 */

/**
 * @typedef {Object} SaaSContext
 * @property {string} accountId - Unique identifier for the user/account in multi-tenant mode
 */

/**
 * @typedef {Object} UserKeys
 * @property {string} secretKey - User's ZKP secret key (as integer string)
 * @property {string} publicKey - User's ZKP public key (as integer string)
 * @property {string} ethSK - User's Ethereum private key
 * @property {string} ethPK - User's Ethereum address
 * @property {string} [sharedSecretKey] - Optional shared secret key for encrypted communication
 * @property {string} [sharedPublicKey] - Optional shared public key
 */

/**
 * @typedef {Object} KeyMetadata
 * @property {number} keyVersion - Version number for key rotation support
 * @property {string} contractName - Associated contract name
 * @property {boolean} registeredOnChain - Whether the key is registered on-chain
 * @property {Date} [lastUsed] - Last time the key was accessed
 */

/**
 * Base class for key storage implementations.
 * This class defines the interface that all key storage implementations must follow.
 * 
 * @abstract
 */
export class IKeyStorage {
  /**
   * Retrieve keys for a user.
   * 
   * @param {SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<UserKeys|null>} User keys or null if not found
   * @abstract
   */
  async getKeys(context) {
    throw new Error('getKeys() must be implemented by subclass');
  }

  /**
   * Save keys for a user.
   * 
   * @param {UserKeys} keys - User keys to save
   * @param {SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<void>}
   * @abstract
   */
  async saveKeys(keys, context) {
    throw new Error('saveKeys() must be implemented by subclass');
  }

  /**
   * Register a new key pair.
   * Generates a public key from the secret key and optionally registers it on-chain.
   * 
   * @param {string} secretKey - Secret key to register (hex string)
   * @param {string} contractName - Associated contract name
   * @param {boolean} registerWithContract - Whether to register the key on-chain
   * @param {SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<string>} Public key (as integer string)
   * @abstract
   */
  async registerKey(secretKey, contractName, registerWithContract, context) {
    throw new Error('registerKey() must be implemented by subclass');
  }

  /**
   * Get or create shared secret keys for encrypted communication with another user.
   * 
   * @param {string} recipientAddress - Recipient's Ethereum address
   * @param {string|number} recipientPublicKey - Recipient's public key
   * @param {SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<string>} Shared public key
   * @abstract
   */
  async getSharedSecretKeys(recipientAddress, recipientPublicKey, context) {
    throw new Error('getSharedSecretKeys() must be implemented by subclass');
  }

  /**
   * Check if keys exist for a user.
   * 
   * @param {SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<boolean>} True if keys exist, false otherwise
   * @abstract
   */
  async hasKeys(context) {
    throw new Error('hasKeys() must be implemented by subclass');
  }

  /**
   * Delete keys for a user (optional, for key rotation or cleanup).
   * 
   * @param {SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<boolean>} True if keys were deleted, false if they didn't exist
   * @abstract
   */
  async deleteKeys(context) {
    throw new Error('deleteKeys() must be implemented by subclass');
  }

  async getAccountIdByEthAddress(ethAddress) {
    throw new Error('getAccountIdByEthAddress() must be implemented by subclass');
  }
}

export default IKeyStorage;

