import fs from 'fs';
import utils from 'zkp-utils';
import config from 'config';
import { generalise } from 'general-number';
import { getContractAddress, getContractInstance, registerKey } from './common/contract.mjs';
import { storeCommitment, formatCommitment, persistCommitment } from './common/commitment-storage.mjs';
import { decrypt, poseidonHash, } from './common/number-theory.mjs';
import { KeyManager } from './key-management/KeyManager.mjs';


function decodeCommitmentData(decrypted){
  const stateVarId = generalise(decrypted[0]);
  const salt = generalise(decrypted[decrypted.length - 1]);
  let newCommitment;

  ENCRYPTEDVARIABLE_COMMITMENT
  return newCommitment;
}

export default class EncryptedDataEventListener {
  constructor(web3, context) {
    this.web3 = web3;
    this.ethAddress = null;
    this.contractMetadata = {};
    this.context = context;
  }

  async init() {
    try {
      this.instance = await getContractInstance('CONTRACT_NAME');
      const contractAddr = await getContractAddress('CONTRACT_NAME');
      console.log(
        'encrypted-data-listener',
        'init',
        'Contract Address --------->',
        contractAddr,
      );

     // Use KeyManager for key retrieval
      const keyManager = KeyManager.getInstance();

      // Check if keys exist, if not register new ones
      const hasKeys = await keyManager.hasKeys(this.context);
      if (!hasKeys) {
        console.log('No keys found, registering new key pair...');
        await registerKey(utils.randomHex(31), 'CONTRACT_NAME', true, this.context);
      }

      // Retrieve keys via KeyManager
      const keys = await keyManager.getKeys(this.context);

      if (!keys) {
        throw new Error('Failed to retrieve keys after registration');
      }

      this.secretKey = generalise(keys.secretKey);
      this.publicKey = generalise(keys.publicKey);
      this.ethAddress = keys.ethPK ? generalise(keys.ethPK) : generalise(config.web3.options.defaultAccount);

      console.log('Keys loaded successfully', {
        multiTenant: !!this.context?.accountId,
        ethAddress: this.ethAddress.hex(),
      });
    } catch (error) {
      console.error(
        'encrypted-data-listener',
        'init',
        'Initialization failed:',
        error,
      );
      throw error;
    }
  }

  async fetchBackupData () {
    await this.init()
    const instance = this.instance
    const eventName = 'BackupData'
    const eventJsonInterface = this.instance._jsonInterface.find(
      o => o.name === eventName && o.type === 'event'
    )
    console.log('Getting data from past events. This can take a while...')
    const backupEvents = await instance.getPastEvents('BackupData', {
      fromBlock: this.contractMetadata.blockNumber || 1,
      topics: [eventJsonInterface.signature, this.ethAddress.hex(32)]
    })
    console.log('Getting nullifiers. This can take a while...')
    const nullifierEvents = await instance.getPastEvents('Nullifiers', {
      fromBlock: this.contractMetadata.blockNumber || 1
    })
    const nullifiers = nullifierEvents
      .flatMap(e => e.returnValues.nullifiers)
    return Promise.all(
      backupEvents
        .map(e => decrypt(e.returnValues.cipherText, this.publicKey, this.secretKey))
        .map(decodeCommitmentData)
        .filter(c => c)
        .map(formatCommitment)
        .map(c => {
          c.isNullified = nullifiers.includes(BigInt(c.nullifier).toString())
          return c
        })
    )
  }
  async saveBackupData (allCommitments) {
    return allCommitments.map(async commit => {
      try {
        await persistCommitment(commit)
      } catch (e) {
        if (e.toString().includes('E11000 duplicate key')) {
          logger.info('Commitment already exists. Thats fine.')
        }
      }
    })
  }

  async start() {
    try {
      await this.init();

      const eventName = 'EncryptedData';
      const eventJsonInterface = this.instance._jsonInterface.find(
        o => o.name === eventName && o.type === 'event',
      );

      const eventSubscription = await this.instance.events[eventName]({
        fromBlock: this.contractMetadata.blockNumber || 1,
        topics: [eventJsonInterface.signature],
      });

      console.log('Initializing event listener...', {
        fromBlock: this.contractMetadata.blockNumber || 1,
        topics: [eventJsonInterface.signature],
      });

      eventSubscription
        .on('connected', subscriptionId => {
          console.log(`New subscription: ${subscriptionId}`);
        });
      eventSubscription
        .on('data', async eventData => {
          try {
            await this.processEventData(eventData);
          } catch (error) {
            console.error('Error processing event data:', error);
          }
        });
      eventSubscription
        .on('error', async error => {
          console.error('Event subscription error:', error);
          await this.reconnect();
        });
      eventSubscription
        .on('close', async () => {
          console.log('Subscription closed');
          await this.reconnect();
        });
    } catch (error) {
      console.error('Listener startup failed:', error);
    }
  }

  async processEventData(eventData) {
    const self = this;

    const cipherText = eventData.returnValues.cipherText;
    const ephPublicKey = eventData.returnValues.ephPublicKey;

    const decrypted = decrypt(cipherText, this.secretKey.integer, ephPublicKey);

    const stateVarId = generalise(decrypted[0]);
    const salt = generalise(decrypted[decrypted.length - 1]);

    ENCRYPTEDVARIABLE_CODE
  }

  async reconnect() {
    console.log(
      'encrypted-data-listener',
      'reconnect',
      'Attempting to reconnect...',
    );
    try {
      await this.start();
      console.log(
        'encrypted-data-listener',
        'reconnect',
        'Reconnected successfully',
      );
    } catch (error) {
      console.error(
        'encrypted-data-listener',
        'reconnect',
        'Reconnection attempt failed:',
        error,
      );
      setTimeout(() => this.reconnect(), 5000); // Retry after 5 seconds
    }
  }
}
