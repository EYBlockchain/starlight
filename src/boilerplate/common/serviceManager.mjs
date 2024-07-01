import Web3 from './web3.mjs';

class ServiceManager {
  constructor() {
    this.web3 = Web3.connection();
  }

  getWeb3() {
    return this.web3;
  }
}

export default ServiceManager;
