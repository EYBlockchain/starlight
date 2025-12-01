/**
 * @file KeyManager.mjs
 * @description Singleton key manager that routes to appropriate storage based on context.
 * Provides a unified interface for key management that works in both single-tenant (file-based)
 * and multi-tenant (database-based) modes.
 */

import logger from '../logger.mjs';
import FileKeyStorage from './FileKeyStorage.mjs';
import DatabaseKeyStorage from './DatabaseKeyStorage.mjs';

/**
 * KeyManager singleton class.
 * Routes key operations to FileKeyStorage or DatabaseKeyStorage based on context.
 * 
 * Usage:
 *   const keyManager = KeyManager.getInstance();
 *   
 *   // Single-tenant mode (no context)
 *   const keys = await keyManager.getKeys();
 *   
 *   // Multi-tenant mode (with context)
 *   const keys = await keyManager.getKeys({ accountId: 'user-123' });
 */
export class KeyManager {
  /**
   * @private
   * @type {KeyManager}
   */
  static instance = null;

  /**
   * @private
   */
  constructor() {
    if (KeyManager.instance) {
      throw new Error('KeyManager is a singleton. Use KeyManager.getInstance() instead.');
    }

    this.fileStorage = new FileKeyStorage();
    this.dbStorage = new DatabaseKeyStorage();
    
    logger.debug('KeyManager initialized');
  }

  /**
   * Get the singleton instance of KeyManager.
   * 
   * @returns {KeyManager}
   */
  static getInstance() {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing).
   * 
   * @private
   */
  static resetInstance() {
    KeyManager.instance = null;
  }

  /**
   * Get the appropriate storage implementation based on context.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Optional SaaS context
   * @returns {import('./IKeyStorage.mjs').IKeyStorage} Storage implementation
   * @private
   */
  getStorage(context) {
    if (context && context.accountId) {
      logger.debug(`Using DatabaseKeyStorage for accountId: ${context.accountId}`);
      return this.dbStorage;
    }
    
    logger.debug('Using FileKeyStorage (single-tenant mode)');
    return this.fileStorage;
  }

  /**
   * Retrieve keys for a user.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<import('./IKeyStorage.mjs').UserKeys|null>} User keys or null if not found
   */
  async getKeys(context) {
    try {
      const storage = this.getStorage(context);
      return await storage.getKeys(context);
    } catch (error) {
      logger.error('KeyManager.getKeys failed:', error);
      throw error;
    }
  }

  /**
   * Save keys for a user.
   * 
   * @param {import('./IKeyStorage.mjs').UserKeys} keys - User keys to save
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<void>}
   */
  async saveKeys(keys, context) {
    try {
      const storage = this.getStorage(context);
      return await storage.saveKeys(keys, context);
    } catch (error) {
      logger.error('KeyManager.saveKeys failed:', error);
      throw error;
    }
  }

  /**
   * Register a new key pair.
   * 
   * @param {string} secretKey - Secret key to register (hex string)
   * @param {string} contractName - Associated contract name
   * @param {boolean} registerWithContract - Whether to register the key on-chain
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<string>} Public key (as integer string)
   */
  async registerKey(secretKey, contractName, registerWithContract, context) {
    try {
      const storage = this.getStorage(context);
      return await storage.registerKey(secretKey, contractName, registerWithContract, context);
    } catch (error) {
      logger.error('KeyManager.registerKey failed:', error);
      throw error;
    }
  }

  /**
   * Get or create shared secret keys for encrypted communication.
   * 
   * @param {string} recipientAddress - Recipient's Ethereum address
   * @param {string|number} recipientPublicKey - Recipient's public key (0 to fetch from contract)
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<string>} Shared public key
   */
  async getSharedSecretKeys(recipientAddress, recipientPublicKey, context) {
    try {
      const storage = this.getStorage(context);
      return await storage.getSharedSecretKeys(recipientAddress, recipientPublicKey, context);
    } catch (error) {
      logger.error('KeyManager.getSharedSecretKeys failed:', error);
      throw error;
    }
  }

  /**
   * Check if keys exist for a user.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<boolean>} True if keys exist, false otherwise
   */
  async hasKeys(context) {
    try {
      const storage = this.getStorage(context);
      return await storage.hasKeys(context);
    } catch (error) {
      logger.error('KeyManager.hasKeys failed:', error);
      throw error;
    }
  }

  /**
   * Delete keys for a user.
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Optional SaaS context for multi-tenant mode
   * @returns {Promise<boolean>} True if keys were deleted, false if they didn't exist
   */
  async deleteKeys(context) {
    try {
      const storage = this.getStorage(context);
      return await storage.deleteKeys(context);
    } catch (error) {
      logger.error('KeyManager.deleteKeys failed:', error);
      throw error;
    }
  }

  /**
   * Get storage mode information (for debugging/monitoring).
   * 
   * @param {import('./IKeyStorage.mjs').SaaSContext} [context] - Optional SaaS context
   * @returns {Object} Storage mode information
   */
  getStorageInfo(context) {
    const storage = this.getStorage(context);
    return {
      mode: storage instanceof DatabaseKeyStorage ? 'database' : 'file',
      multiTenant: !!context?.accountId,
      accountId: context?.accountId || null,
    };
  }

  async getAccountIdByEthAddress(ethAddress) {
    try {
      return await this.dbStorage.getAccountIdByEthAddress(ethAddress);
    } catch (error) {
      logger.error('KeyManager.getAccountIdByEthAddress failed:', error);
      throw error;
    }
  }
}

/**
 * Convenience function to get the KeyManager instance.
 * 
 * @returns {KeyManager}
 */
export function getKeyManager() {
  return KeyManager.getInstance();
}

export default KeyManager;

