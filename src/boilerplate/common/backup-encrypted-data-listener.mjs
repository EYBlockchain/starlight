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
    this.eventSubscription = null; // Store as class property to prevent garbage collection
    this.heartbeatInterval = null;
    this.lastEventReceived = Date.now();
    this.lastProcessedBlock = 0; // Track last block we processed
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

      // Determine starting block: use metadata if set, otherwise last processed + 1, otherwise start from block 1
      let startBlock;
      if (this.contractMetadata.blockNumber) {
        startBlock = this.contractMetadata.blockNumber;
      } else if (this.lastProcessedBlock) {
        startBlock = this.lastProcessedBlock + 1;
      } else {
        startBlock = 1;
      }
      
      console.log(`[BACKUP] Starting backup event listener from block ${startBlock}`);

      // Store as class property to prevent garbage collection
      this.eventSubscription = this.instance.events[eventName]({
        fromBlock: startBlock,
        topics: [eventJsonInterface.signature],
      });

      // Track last event received for health monitoring
      this.lastEventReceived = Date.now();

      this.eventSubscription.on('connected', subscriptionId => {
        console.log(`[BACKUP] Connected, ID: ${subscriptionId}`);
      });
      
      this.eventSubscription.on('data', async eventData => {
        try {
          this.lastEventReceived = Date.now();
          this.lastProcessedBlock = Number(eventData.blockNumber);
          console.log(`[BACKUP] Event received, block ${eventData.blockNumber}`);
          await this.processBackupEventData(eventData);
        } catch (error) {
          console.error('[BACKUP] Error processing backup event data:', error);
        }
      });
      
      this.eventSubscription.on('error', async error => {
        console.error('[BACKUP] ❌ Subscription error:', error);
        await this.reconnect();
      });
      
      this.eventSubscription.on('close', async () => {
        console.log('[BACKUP] Subscription closed, reconnecting...');
        await this.reconnect();
      });

      // Clear any existing heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Heartbeat: Check subscription health every 30 seconds
      this.heartbeatInterval = setInterval(async () => {
        const now = Date.now();
        const timeSinceLastEvent = now - this.lastEventReceived;
        const minutesSinceLastEvent = Math.floor(timeSinceLastEvent / 60000);
        
        console.log('[BACKUP] ❤️ Heartbeat - Time since last event:', minutesSinceLastEvent, 'minutes');
        
        // Check if subscription object still exists and has an ID
        if (!this.eventSubscription || !this.eventSubscription.id) {
          console.warn('[BACKUP] ⚠️ WARNING: Event subscription is dead!');
          console.log('[BACKUP] Subscription exists?', !!this.eventSubscription);
          if (this.eventSubscription) {
            console.log('[BACKUP] Subscription ID:', this.eventSubscription.id);
          }
          await this.reconnect();
        } else {
          console.log('[BACKUP] Subscription healthy, ID:', this.eventSubscription.id);
          
          // Check for past events to see if we're missing any
          try {
            const currentBlock = Number(await this.web3.eth.getBlockNumber());
            
            // Only check if we've processed at least one event
            if (this.lastProcessedBlock > 0) {
              const checkFromBlock = this.lastProcessedBlock + 1; // Start AFTER last processed
              
              // Only check if there are new blocks since last processed
              if (checkFromBlock <= currentBlock) {
                const pastEvents = await this.instance.getPastEvents('EncryptedBackupData', {
                  fromBlock: checkFromBlock,
                  toBlock: 'latest'
                });
                
                if (pastEvents.length > 0) {
                  console.log(`[BACKUP] ⚠️ Found ${pastEvents.length} past events from block ${checkFromBlock} to ${currentBlock} that subscription didn't receive!`);
                  pastEvents.forEach(evt => {
                    console.log(`[BACKUP]   - Event in block ${evt.blockNumber}, tx: ${evt.transactionHash}`);
                  });
                  console.log('[BACKUP] Subscription is broken. Forcing reconnect...');
                  await this.reconnect();
                } else {
                  console.log(`[BACKUP] No new events from block ${checkFromBlock} to ${currentBlock} - subscription OK`);
                }
              } else {
                console.log(`[BACKUP] No new blocks since last processed (${this.lastProcessedBlock})`);
              }
            } else {
              console.log('[BACKUP] No events processed yet, skipping past event check');
            }
          } catch (e) {
            console.log('[BACKUP] Error checking past events:', e.message);
          }
        }
      }, 30000); // Every 30 seconds

      console.log('[BACKUP] Event handlers and health monitor attached, waiting for events...');
    } catch (error) {
      console.error('[BACKUP] ❌ Listener startup failed:', error);
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
    console.log('[BACKUP] Reconnecting...');
    
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Clean up old subscription if it exists
    if (this.eventSubscription) {
      try {
        console.log('[BACKUP] Unsubscribing from old subscription...');
        await this.eventSubscription.unsubscribe();
      } catch (e) {
        console.log('[BACKUP] Error unsubscribing (may already be dead):', e.message);
      }
      this.eventSubscription = null;
    }
    
    // Reset last event timestamp
    this.lastEventReceived = Date.now();
    
    try {
      await this.startBackupRecovery();
      console.log('[BACKUP] Reconnected successfully');
    } catch (error) {
      console.error('[BACKUP] ❌ Reconnection attempt failed:', error);
      setTimeout(() => this.reconnect(), 5000); // Retry after 5 seconds
    }
  }

}
