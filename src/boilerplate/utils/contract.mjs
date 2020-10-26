import fs from 'fs';
import config from 'config';

import Web3 from './web3.mjs';
import logger from '../../utils/logger.mjs';

const web3 = Web3.connection();

export const contractPath = contractName => {
  return `/app/build/contracts/${contractName}.json`;
};

const { options } = config.web3;

export async function getContractInterface(contractName) {
  const path = contractPath(contractName);
  const contractInterface = JSON.parse(fs.readFileSync(path, 'utf8'));
  // logger.debug('\ncontractInterface:', contractInterface);
  return contractInterface;
}

export async function getContractAddress(contractName) {
  let deployedAddress;
  const contractInterface = await getContractInterface(contractName);

  const networkId = await web3.eth.net.getId();
  logger.silly('networkId:', networkId);

  if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
    deployedAddress = contractInterface.networks[networkId].address;
  }
  logger.silly('deployed address:', deployedAddress);
  return deployedAddress;
}

// returns a web3 contract instance
export async function getContractInstance(contractName, deployedAddress) {
  const contractInterface = await getContractInterface(contractName);

  if (!deployedAddress) {
    // eslint-disable-next-line no-param-reassign
    deployedAddress = await getContractAddress(contractName);
  }

  const contractInstance = deployedAddress
    ? new web3.eth.Contract(contractInterface.abi, deployedAddress, options)
    : new web3.eth.Contract(contractInterface.abi, null, options);
  // logger.silly('\ncontractInstance:', contractInstance);
  logger.info(`Address: ${deployedAddress}`);

  return contractInstance;
}

export async function getContractBytecode(contractName) {
  const contractInterface = await getContractInterface(contractName);
  return contractInterface.evm.bytecode.object;
}

export async function deploy(userAddress, userAddressPassword, contractName, constructorParams) {
  logger.info(`\nUnlocking account ${userAddress}...`);
  await web3.eth.personal.unlockAccount(userAddress, userAddressPassword, 1);

  const contractInstance = await getContractInstance(contractName); // get a web3 contract instance of the contract
  const bytecode = await getContractBytecode(contractName);

  const deployedContractAddress = await contractInstance
    .deploy({ data: `0x${bytecode}`, arguments: constructorParams })
    .send({
      from: userAddress,
      gas: config.web3.options.defaultGas,
    })
    .on('error', err => {
      throw new Error(err);
    })
    .then(deployedContractInstance => {
      // logger.silly('deployed contract instance:', deployedContractInstance);
      logger.info(
        `${contractName} contract deployed at address ${deployedContractInstance.options.address}`,
      ); // instance with the new contract address

      return deployedContractInstance.options.address;
    });
  return deployedContractAddress;
}
