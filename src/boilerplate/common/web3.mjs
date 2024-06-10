import Web3 from 'web3';
import config from 'config';
import logger from './logger.mjs';

class Web3Service {
  constructor() {
    this.web3 = null;
    this.connect();
  }

  connect() {
    if (!this.web3) {
      logger.http('Blockchain Connecting ...');
      const provider = new Web3.providers.WebsocketProvider(
        config.web3.url,
        null,
        config.web3.options,
      );

      provider.on('error', console.error);
      provider.on('connect', () => logger.http('Blockchain Connected ...'));
      provider.on('end', console.error);

      this.web3 = new Web3(provider);
    }
  }

  getConnection() {
    if (this.web3) {
      return this.web3;
    }
    throw new Error('Web3 connection not established yet.');
  }

  isConnected() {
    if (this.web3) {
      return this.web3.eth.net.isListening();
    }
    return false;
  }
}

const web3Instance = new Web3Service();
export default web3Instance;
