import fs from 'fs'
import utils from 'zkp-utils'
import config from 'config'
import { generalise } from 'general-number'
import { getContractAddress, getContractInstance, registerKey, getContractMetadata } from './common/contract.mjs'
import { storeCommitment, getSharedSecretskeys, getCommitmentsByState, markNullified } from './common/commitment-storage.mjs'
import { decrypt, poseidonHash, decompressStarlightKey } from './common/number-theory.mjs'


const keyDb = '/app/orchestration/common/db/key.json'

export class EncryptedDataEventListener {
  constructor (web3) {
    this.web3 = web3
    this.ethAddress = generalise(config.web3.options.defaultAccount)
    this.contractMetadata = {}
  }

  async init () {
    try {
      this.instance = await getContractInstance('CONTRACT_NAME')
      const contractMetadata = await getContractMetadata('CONTRACT_NAME')
      const contractAddr = contractMetadata.address
      console.log('encrypted-data-listener', 'init', 'Contract Address --------->', contractAddr)

      await registerKey(utils.randomHex(31), 'CONTRACT_NAME', true)

      const { secretKey, publicKey} = JSON.parse(
        fs.readFileSync(keyDb)
      )

      this.secretKey = generalise(secretKey)
      this.publicKey = generalise(publicKey)
    } catch (error) {
      console.error('encrypted-data-listener', 'init', 'Initialization failed:', error)
      throw error
    }
  }

  

  async start () {
    try {
      await this.init()

      const eventName = 'EncryptedData'
      const eventJsonInterface = this.instance._jsonInterface.find(
        o => o.name === eventName && o.type === 'event'
      )

      const eventSubscription = await this.instance.events[eventName]({
        fromBlock: this.contractMetadata.blockNumber || 1,
        topics: [eventJsonInterface.signature]
      })

      console.log('Initializing event listener...', {
        fromBlock: this.contractMetadata.blockNumber || 1,
        topics: [eventJsonInterface.signature]
      })

      eventSubscription
        .on('connected', (subscriptionId) => {
          console.log(`New subscription: ${subscriptionId}`)
        })
        .on('data', async (eventData) => {
          try {
            await this.processEventData(eventData)
          } catch (error) {
            console.error('Error processing event data:', error)
          }
        })
        .on('error', async (error) => {
          console.error('Event subscription error:', error)
          await this.reconnect()
        })
        .on('close', async () => {
          console.log('Subscription closed')
          await this.reconnect()
        })
    } catch (error) {
      console.error('Listener startup failed:', error)
    }
  }

  async processEventData (eventData) {
    const self = this

    const cipherText = eventData.returnValues.cipherText
    const ephPublicKey = eventData.returnValues.ephPublicKey

    const decrypted = decrypt(
      cipherText,
      this.secretKey.integer,
      ephPublicKey
    )

      // Processing logic for events with length 6
      const stateVarId = generalise(decrypted[0])
      const extraPram = generalise(decrypted[3])
     
      const balances_stateVarId = generalise(
        utils.mimcHash(
          [generalise(9).bigInt, self.ethAddress.bigInt, extraPram.bigInt],
          'ALT_BN_254'
        )
      )

      const tokenOwners_stateVarId = generalise(
        utils.mimcHash(
          [generalise(15).bigInt, self.ethAddress.bigInt, extraPram.bigInt],
          'ALT_BN_254'
        )
      )

      let sendersPublicKey = await self.instance.methods.zkpPublicKeys(counterParty.hex(20)).call()
      sendersPublicKey = generalise(sendersPublicKey)
      if (sendersPublicKey.length === 0) {
        throw new Error('WARNING: Public key for given  eth address not found.')
      }

      self.sharedPublicKey = await getSharedSecretskeys(counterParty, sendersPublicKey)
      const keys = JSON.parse(
        fs.readFileSync(keyDb, 'utf-8', (err) => {
          console.log(err)
        })
      )
      self.sharedSecretKey = generalise(keys.sharedSecretKey)
      self.sharedPublicKey = generalise(keys.sharedPublicKey)
      const swapProposals_swapId_prev = await getCommitmentsByState('swapProposals', swapId.integer)
      if (swapProposals_swapId_prev.length > 0) {
        await markNullified(generalise(swapProposals_swapId_prev[0]._id),
          self.sharedSecretKey.hex(32))
      }

      const value = generalise(decrypted[1])
      const salt = generalise(decrypted[2])

      let newCommitment = poseidonHash([
        BigInt(stateVarId.hex(32)),
        BigInt(value.hex(32)),
        BigInt(self.publicKey.hex(32)),
        BigInt(salt.hex(32))
      ])
      newCommitment = generalise(newCommitment.hex(32))

      if (stateVarId.integer === balances_stateVarId.integer) {
        try {
          await storeCommitment({
            hash: newCommitment,
            name: 'balances',
            source: 'encrypted data',
            mappingKey: stateVarId.integer,
            preimage: {
              stateVarId,
              value,
              salt,
              publicKey: self.publicKey
            },
            secretKey: self.secretKey,
            isNullified: false
          })
          console.log(
            'Added commitment',
            newCommitment.hex(32)
          )
        } catch (e) {
          if (e.toString().includes('E11000 duplicate key')) {
            console.log(
              'encrypted-data-listener -', 
              'receiving EncryptedData event with balances.', 
              'This balance already exists. Ignore it.')
          }
        }
      }
      if (stateVarId.integer === tokenOwners_stateVarId.integer) {
        try {
          await storeCommitment({
            hash: newCommitment,
            name: 'tokenOwners',
            source: 'encrypted data',
            mappingKey: stateVarId.integer,
            preimage: {
              stateVarId,
              value,
              salt,
              publicKey: self.publicKey
            },
            secretKey: self.secretKey,
            isNullified: false
          })
          console.log(
            'Added commitment',
            newCommitment.hex(32)
          )
        } catch (e) {
          if (e.toString().includes('E11000 duplicate key')) {
            console.log(
              'encrypted-data-listener -', 
              'receiving EncryptedData event with tokenOwners.', 
              'This tokenOwners already exists. Ignore it.')
          }
        }
      }
    }
  }

  async reconnect () {
    console.log('encrypted-data-listener', 'reconnect', 'Attempting to reconnect...')
    try {
      await this.start()
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
