/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
import config from "config";
import logger from "./common/logger.mjs";
import { 
  getOrCreateKeys, 
  extractAccountId, 
  getKeysFromDB, 
  storeKeysInDB,
  generateKeyPair 
} from "./common/key-management.mjs";

export async function service_getSharedKeys(req, res) {
  try {
    const accountId = extractAccountId(req);
    const { targetAccountId } = req.body;

    if (!targetAccountId) {
      return res.status(400).send({ error: 'targetAccountId is required' });
    }

    let sharedKeys = {};

    if (accountId) {
      // SaaS mode - get keys from database
      const currentUserKeys = await getKeysFromDB(accountId);
      const targetUserKeys = await getKeysFromDB(targetAccountId);

      if (!currentUserKeys || !targetUserKeys) {
        return res.status(404).send({ error: 'Keys not found for one or both accounts' });
      }

      sharedKeys = {
        currentUserPublicKey: currentUserKeys.publicKey,
        targetUserPublicKey: targetUserKeys.publicKey,
        sharedPublicKey: currentUserKeys.sharedPublicKey,
        sharedSecretKey: currentUserKeys.sharedSecretKey,
      };
    } else {
      // File mode - return error as shared keys require multi-user context
      return res.status(400).send({ error: 'Shared keys require SaaS context (multi-user mode)' });
    }

    res.send({ sharedKeys });
  } catch (err) {
    logger.error('Error getting shared keys:', err);
    res.status(500).send({ error: err.message });
  }
}

/**
 * Service to rotate keys for a user
 */
export async function service_rotateKeys(req, res) {
  try {
    const accountId = extractAccountId(req);
    const { contractName, registerWithContract = false } = req.body;

    if (!accountId) {
      return res.status(400).send({ error: 'SaaS context required for key rotation' });
    }

    // Generate new keys
    const newKeys = generateKeyPair();

    // Store new keys
    await storeKeysInDB(accountId, newKeys);

    // Register with contract if requested
    if (registerWithContract && contractName) {
      const { registerKeyWithContract } = await import('./common/key-management.mjs');
      await registerKeyWithContract(newKeys.publicKey, contractName);
    }

    res.send({ 
      message: 'Keys rotated successfully', 
      publicKey: newKeys.publicKey,
      sharedPublicKey: newKeys.sharedPublicKey 
    });
  } catch (err) {
    logger.error('Error rotating keys:', err);
    res.status(500).send({ error: err.message });
  }
}

/**
 * Service to get current user's public keys
 */
export async function service_getUserKeys(req, res) {
  try {
    const accountId = extractAccountId(req);

    if (!accountId) {
      return res.status(400).send({ error: 'SaaS context required' });
    }

    const keys = await getKeysFromDB(accountId);

    if (!keys) {
      return res.status(404).send({ error: 'Keys not found' });
    }

    // Only return public keys for security
    const publicKeys = {
      publicKey: keys.publicKey,
      sharedPublicKey: keys.sharedPublicKey,
      accountId: accountId,
    };

    res.send({ keys: publicKeys });
  } catch (err) {
    logger.error('Error getting user keys:', err);
    res.status(500).send({ error: err.message });
  }
}

/**
 * Service to initialize keys for a new user
 */
export async function service_initializeUserKeys(req, res) {
  try {
    const accountId = extractAccountId(req);
    const { contractName, registerWithContract = false } = req.body;

    if (!accountId) {
      return res.status(400).send({ error: 'SaaS context required for user key initialization' });
    }

    // Check if keys already exist
    const existingKeys = await getKeysFromDB(accountId);
    if (existingKeys) {
      return res.status(409).send({ 
        error: 'Keys already exist for this account',
        publicKey: existingKeys.publicKey,
        sharedPublicKey: existingKeys.sharedPublicKey 
      });
    }

    // Get or create keys (will create new ones since they don't exist)
    const keys = await getOrCreateKeys(accountId, contractName, registerWithContract);

    res.send({ 
      message: 'Keys initialized successfully', 
      publicKey: keys.publicKey,
      sharedPublicKey: keys.sharedPublicKey 
    });
  } catch (err) {
    logger.error('Error initializing user keys:', err);
    res.status(500).send({ error: err.message });
  }
}
