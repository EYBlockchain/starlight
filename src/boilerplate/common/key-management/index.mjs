/**
 * @file index.mjs
 * @description Main entry point for the key management system.
 * Exports all key management components for easy importing.
 */

// Core components
export { IKeyStorage } from './IKeyStorage.mjs';
export { FileKeyStorage } from './FileKeyStorage.mjs';
export { DatabaseKeyStorage } from './DatabaseKeyStorage.mjs';
export { KeyManager, getKeyManager } from './KeyManager.mjs';

// Encryption utilities
export {
  encrypt,
  decrypt,
  isEncrypted,
  encryptIfEnabled,
  decryptIfEncrypted,
  isEncryptionEnabled,
  generateEncryptionKey
} from './encryption.mjs';

// Middleware
export {
  saasContextMiddleware,
  requireSaasContext,
  forbidSaasContext,
  getSaasContext,
  isMultiTenant
} from '../middleware/saas-context.mjs';

// Migration utilities
export { migrate as setupUserKeysCollection } from './migrations/setup-user-keys.mjs';

/**
 * Convenience function to get a configured KeyManager instance.
 * This is the recommended way to access key management functionality.
 * 
 * @returns {KeyManager}
 * 
 * @example
 * import { getKeyManager } from './key-management/index.mjs';
 * 
 * const keyManager = getKeyManager();
 * const keys = await keyManager.getKeys(req.saasContext);
 */
export function getKeyManager() {
  return KeyManager.getInstance();
}

export default {
  // Core
  IKeyStorage,
  FileKeyStorage,
  DatabaseKeyStorage,
  KeyManager,
  getKeyManager,
  
  // Encryption
  encrypt,
  decrypt,
  isEncrypted,
  encryptIfEnabled,
  decryptIfEncrypted,
  isEncryptionEnabled,
  generateEncryptionKey,
  
  // Middleware
  saasContextMiddleware,
  requireSaasContext,
  forbidSaasContext,
  getSaasContext,
  isMultiTenant,
  
  // Migration
  setupUserKeysCollection
};

