import fs from 'fs';
import utils from 'zkp-utils';
import config from 'config';
import { generalise } from 'general-number';
import { getContractAddress, getContractInstance, registerKey } from './contract.mjs';
import { storeCommitment } from './commitment-storage.mjs';
import { decompressStarlightKey, decrypt, poseidonHash, } from './number-theory.mjs';
import { getLeafIndex } from "./timber.mjs";

const keyDb =
  process.env.KEY_DB_PATH || '/app/orchestration/common/db/key.json';

export default class BackupEncryptedDataEventListener {
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

      if (!fs.existsSync(keyDb)) await registerKey(utils.randomHex(31), 'CONTRACT_NAME', true);

      const keys = JSON.parse(fs.readFileSync(keyDb, 'utf-8'));
      this.secretKey = generalise(keys.secretKey);
      this.publicKey = generalise(keys.publicKey);
      this.sharedPublicKey = generalise(keys.sharedPublicKey);
      this.sharedSecretKey = generalise(keys.sharedSecretKey);

      if (!keys.secretKey || !keys.publicKey) {
        throw new Error('Invalid key file: missing required keys');
      }
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

  async startBackupRecovery() {
    try {
      await this.init();

      const eventName = 'EncryptedBackupData';
      const eventJsonInterface = this.instance._jsonInterface.find(
        o => o.name === eventName && o.type === 'event',
      );

      const eventSubscription = await this.instance.events[eventName]({
        fromBlock: this.contractMetadata.blockNumber || 1,
        topics: [eventJsonInterface.signature],
      });

      console.log('Initializing backup event listener...', {
        fromBlock: this.contractMetadata.blockNumber || 1,
        topics: [eventJsonInterface.signature],
      });

      eventSubscription.on('connected', subscriptionId => {
        console.log(`New subscription: ${subscriptionId}`);
      });
      eventSubscription.on('data', async eventData => {
        try {
          console.log('Received backup event data');
          await this.processBackupEventData(eventData);
        } catch (error) {
          console.error('Error processing backup event data:', error);
        }
      });
      eventSubscription.on('error', async error => {
        console.error('Backup event subscription error:', error);
        await this.reconnect();
      });
      eventSubscription.on('close', async () => {
        console.log('Subscription closed');
        await this.reconnect();
      });
    } catch (error) {
      console.error('Listener startup failed:', error);
    }
  }

  async processBackupEventData(eventData) {
    const keyPairs = [
      { secretKey: this.secretKey, publicKey: this.publicKey },
      { secretKey: this.sharedSecretKey, publicKey: this.sharedPublicKey },
    ];

    for (const kp of keyPairs) {
      if (!kp.secretKey) continue;
      for (let i = 0; i < eventData.returnValues.encPreimages.length; i++) {
        let { cipherText, ephPublicKey, varName } =
          eventData.returnValues.encPreimages[i];
        const name = varName.split(' ')[0];
        const structProperties = varName.split('props:')[1]?.trim();
        varName = varName.split('props:')[0]?.trim();
        let isArray = false;
        let isStruct = false;
        if (varName.includes(' a')) {
          isArray = true;
        }
        if (varName.includes(' s')) {
          isStruct = true;
        }
        const plainText = decrypt(cipherText, kp.secretKey.hex(32), [
          decompressStarlightKey(generalise(ephPublicKey))[0].hex(32),
          decompressStarlightKey(generalise(ephPublicKey))[1].hex(32),
        ]);
        let mappingKey = null;
        let stateVarId;
        let value;
        console.log(
          'Decrypted pre-image of commitment for variable name: ' + name + ': ',
        );
        const salt = generalise(plainText[0]);
        console.log(`\tSalt: ${salt.integer}`);
        let count;
        if (isArray) {
          console.log(`\tState variable StateVarId: ${plainText[2]}`);
          mappingKey = generalise(plainText[1]);
          console.log(`\tMapping Key: ${mappingKey.integer}`);
          const reGenStateVarId = generalise(
            utils.mimcHash(
              [
                generalise(plainText[2]).bigInt,
                generalise(plainText[1]).bigInt,
              ],
              'ALT_BN_254',
            ),
          );
          stateVarId = reGenStateVarId;
          console.log(`Regenerated StateVarId: ${reGenStateVarId.bigInt}`);
          count = 3;
        } else {
          stateVarId = generalise(plainText[1]);
          console.log(`\tStateVarId: ${plainText[1]}`);
          count = 2;
        }
        if (isStruct) {
          value = {};
          let count = isArray ? 3 : 2;
          for (const prop of structProperties.split(' ')) {
            value[prop] = plainText[count];
            count++;
          }
          console.log(`\tValue: ${value}`);
        } else {
          value = generalise(plainText[count]);
          console.log(`\tValue: ${value.integer}`);
        }
        let newCommitment;
        if (isStruct) {
          const hashInput = [BigInt(stateVarId.hex(32))];
          const start = isArray ? 3 : 2;
          for (let i = start; i < plainText.length; i++) {
            hashInput.push(BigInt(generalise(plainText[i]).hex(32)));
          }
          hashInput.push(BigInt(kp.publicKey.hex(32)));
          hashInput.push(BigInt(salt.hex(32)));
          newCommitment = generalise(poseidonHash(hashInput));
        } else {
          newCommitment = generalise(
            poseidonHash([
              BigInt(stateVarId.hex(32)),
              BigInt(value.hex(32)),
              BigInt(kp.publicKey.hex(32)),
              BigInt(salt.hex(32)),
            ]),
          );
        }
        const index = await getLeafIndex(
				  'CONTRACT_NAME',
				  newCommitment.integer,
          undefined,
          1,
        );
        if (index === undefined) {
          console.log(index, 'index');
          console.warn(
            'Could not find leaf index for',
            newCommitment.integer,
            ', Possibly this commitment has a different public key and so decryption failed.',
          );
          continue;
        }
        const nullifier = poseidonHash([
          BigInt(stateVarId.hex(32)),
          BigInt(kp.secretKey.hex(32)),
          BigInt(salt.hex(32)),
        ]);
        let isNullified = false;
        // Check if nullifiers method exists on the contract
        if (this.instance.methods.nullifiers) {
          let nullification = await this.instance.methods
            .nullifiers(nullifier.integer)
            .call();
          if (nullification === 0n) {
            isNullified = false;
          } else if (nullification === BigInt(nullifier.integer)) {
            isNullified = true;
          } else {
            throw new Error("The nullifier value: " + nullifier.integer +
                ' does not match the on-chain nullifier: ' +
                nullification,
            );
          }
        } else {
          console.log(
            'Contract does not have nullifiers method, assuming not nullified',
          );
          isNullified = false;
        }
        try {
          await storeCommitment({
						hash: newCommitment,
						name: name,
						mappingKey: mappingKey?.integer,
						preimage: {
							stateVarId: stateVarId,
							value: value,
							salt: salt,
							publicKey: kp.publicKey,
            },
            secretKey: kp.secretKey,
            isNullified: isNullified,
          });
					console.log("Added commitment", newCommitment.hex(32));
				} catch (e) {
					if (e.toString().includes("E11000 duplicate key")) {
						console.log(
							"encrypted-data-listener -",
							"This commitment already exists. Ignore it."
						);
					}
				}
			}
		}
	}

  async reconnect() {
    console.log(
      'backup-encrypted-data-listener',
      'reconnect',
      'Attempting to reconnect...',
    );
    try {
      await this.start();
      console.log(
        'backup-encrypted-data-listener',
        'reconnect',
        'Reconnected successfully',
      );
    } catch (error) {
      console.error(
        'backup-encrypted-data-listener',
        'reconnect',
        'Reconnection attempt failed:',
        error,
      );
      setTimeout(() => this.reconnect(), 5000); // Retry after 5 seconds
    }
  }

}
