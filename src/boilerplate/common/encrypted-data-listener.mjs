import fs from 'fs';
import utils from 'zkp-utils';
import config from 'config';
import { generalise } from 'general-number';
import { getContractAddress, getContractInstance, registerKey } from './contract.mjs';
import { storeCommitment } from './commitment-storage.mjs';
import { decrypt } from './number-theory.mjs';

const keyDb = '/app/orchestration/common/db/key.json';

export default class EncryptedDataEventListener {
  constructor(web3) {
    this.web3 = web3;
    this.ethAddress = generalise(config.web3.options.defaultAccount);
    this.contractMetadata = {};
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

      await registerKey(utils.randomHex(31), 'CONTRACT_NAME', true);

      const { secretKey, publicKey } = JSON.parse(fs.readFileSync(keyDb));

      this.secretKey = generalise(secretKey);
      this.publicKey = generalise(publicKey);
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
        })
        .on('data', async eventData => {
          try {
            await this.processEventData(eventData);
          } catch (error) {
            console.error('Error processing event data:', error);
          }
        })
        .on('error', async error => {
          console.error('Event subscription error:', error);
          await this.reconnect();
        })
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

    const VARNAME_stateVarId = VARIABLE_ID;

    if (stateVarId.integer === VARNAME_stateVarId.integer) {
      try {
        await storeCommitment({
          hash: newCommitment,
          name: 'VARNAME',
          source: 'encrypted data',
          mappingKey: stateVarId.integer,
          preimage: {
            stateVarId,
            value,
            salt,
            publicKey: self.publicKey,
          },
          secretKey: self.secretKey,
          isNullified: false,
        });
        console.log('Added commitment', newCommitment.hex(32));
      } catch (e) {
        if (e.toString().includes('E11000 duplicate key')) {
          console.log(
            'encrypted-data-listener -',
            'receiving EncryptedData event with balances.',
            'This balance already exists. Ignore it.',
          );
        }
      }
    }
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
