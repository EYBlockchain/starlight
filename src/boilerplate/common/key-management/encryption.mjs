/**
 * @file encryption.mjs
 * @description Encryption utilities for securing sensitive key data at rest.
 * Uses AES-256-GCM for authenticated encryption.
 */

import crypto from 'crypto';
import logger from '../logger.mjs';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Get or generate the encryption key from environment variable.
 * The key should be a 64-character hex string (32 bytes).
 * 
 * @returns {Buffer} Encryption key
 * @throws {Error} If KEY_ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey() {
  const keyHex = process.env.KEY_ENCRYPTION_KEY;
  
  if (!keyHex) {
    // In development/single-tenant mode, we can use a default key
    // In production multi-tenant mode, this MUST be set
    const defaultKey = '0'.repeat(64); // 32 bytes of zeros
    logger.warn(
      'KEY_ENCRYPTION_KEY environment variable not set. Using default key. ' +
      'THIS IS INSECURE FOR PRODUCTION USE!'
    );
    return Buffer.from(defaultKey, 'hex');
  }

  // Validate key format
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'KEY_ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)'
    );
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * Check if encryption is enabled.
 * Encryption is enabled if KEY_ENCRYPTION_ENABLED is set to 'true' or if running in multi-tenant mode.
 * 
 * @returns {boolean} True if encryption is enabled
 */
export function isEncryptionEnabled() {
  return process.env.KEY_ENCRYPTION_ENABLED === 'true';
}

/**
 * Encrypt a plaintext value using AES-256-GCM.
 * 
 * Format: encrypted:AES256GCM:iv:authTag:ciphertext
 * All components are hex-encoded.
 * 
 * @param {string} plaintext - The value to encrypt
 * @returns {string} Encrypted value in the format above
 * @throws {Error} If encryption fails
 */
export function encrypt(plaintext) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: encrypted:AES256GCM:iv:authTag:ciphertext
    const encrypted = [
      'encrypted',
      'AES256GCM',
      iv.toString('hex'),
      authTag.toString('hex'),
      ciphertext
    ].join(':');
    
    logger.debug('Value encrypted successfully');
    return encrypted;
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt a value that was encrypted with the encrypt() function.
 * 
 * @param {string} encryptedValue - The encrypted value to decrypt
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails or format is invalid
 */
export function decrypt(encryptedValue) {
  try {
    // Check if value is encrypted
    if (!encryptedValue.startsWith('encrypted:AES256GCM:')) {
      throw new Error('Invalid encrypted value format: missing prefix');
    }
    
    const parts = encryptedValue.split(':');
    if (parts.length !== 5) {
      throw new Error(
        `Invalid encrypted value format: expected 5 parts, got ${parts.length}`
      );
    }
    
    const [prefix, algorithm, ivHex, authTagHex, ciphertext] = parts;
    
    // Validate components
    if (prefix !== 'encrypted' || algorithm !== 'AES256GCM') {
      throw new Error('Invalid encrypted value format: invalid prefix or algorithm');
    }
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    
    logger.debug('Value decrypted successfully');
    return plaintext;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Check if a value is encrypted.
 * 
 * @param {string} value - The value to check
 * @returns {boolean} True if the value appears to be encrypted
 */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('encrypted:AES256GCM:');
}

/**
 * Conditionally encrypt a value based on whether encryption is enabled.
 * If encryption is disabled, returns the value as-is.
 * 
 * @param {string} value - The value to potentially encrypt
 * @returns {string} Encrypted value or original value
 */
export function encryptIfEnabled(value) {
  if (isEncryptionEnabled()) {
    return encrypt(value);
  }
  return value;
}

/**
 * Conditionally decrypt a value if it's encrypted.
 * If the value is not encrypted, returns it as-is.
 * 
 * @param {string} value - The value to potentially decrypt
 * @returns {string} Decrypted value or original value
 */
export function decryptIfEncrypted(value) {
  if (isEncrypted(value)) {
    return decrypt(value);
  }
  return value;
}

/**
 * Generate a random encryption key suitable for KEY_ENCRYPTION_KEY.
 * This is a utility function for initial setup.
 * 
 * @returns {string} 64-character hex string (32 bytes)
 */
export function generateEncryptionKey() {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('hex');
}

export default {
  encrypt,
  decrypt,
  isEncrypted,
  encryptIfEnabled,
  decryptIfEncrypted,
  isEncryptionEnabled,
  generateEncryptionKey
};

