var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fs from 'fs';
import config from 'config';
import Web3 from './web3.mjs';
import logger from './logger.mjs';
const web3 = Web3.connection();
export const contractPath = contractName => {
    return `/app/build/contracts/${contractName}.json`;
};
const { options } = config.web3;
export function getContractInterface(contractName) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = contractPath(contractName);
        const contractInterface = JSON.parse(fs.readFileSync(path, 'utf8'));
        // logger.debug('\ncontractInterface:', contractInterface);
        return contractInterface;
    });
}
export function getContractAddress(contractName) {
    return __awaiter(this, void 0, void 0, function* () {
        let deployedAddress;
        const contractInterface = yield getContractInterface(contractName);
        const networkId = yield web3.eth.net.getId();
        logger.silly('networkId:', networkId);
        if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
            deployedAddress = contractInterface.networks[networkId].address;
        }
        logger.silly('deployed address:', deployedAddress);
        return deployedAddress;
    });
}
// returns a web3 contract instance
export function getContractInstance(contractName, deployedAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        const contractInterface = yield getContractInterface(contractName);
        if (!deployedAddress) {
            // eslint-disable-next-line no-param-reassign
            deployedAddress = yield getContractAddress(contractName);
        }
        const contractInstance = deployedAddress
            ? new web3.eth.Contract(contractInterface.abi, deployedAddress, options)
            : new web3.eth.Contract(contractInterface.abi, null, options);
        // logger.silly('\ncontractInstance:', contractInstance);
        logger.info(`Address: ${deployedAddress}`);
        return contractInstance;
    });
}
export function getContractBytecode(contractName) {
    return __awaiter(this, void 0, void 0, function* () {
        const contractInterface = yield getContractInterface(contractName);
        return contractInterface.evm.bytecode.object;
    });
}
export function deploy(userAddress, userAddressPassword, contractName, constructorParams) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info(`\nUnlocking account ${userAddress}...`);
        yield web3.eth.personal.unlockAccount(userAddress, userAddressPassword, 1);
        const contractInstance = yield getContractInstance(contractName); // get a web3 contract instance of the contract
        const bytecode = yield getContractBytecode(contractName);
        const deployedContractAddress = yield contractInstance
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
            logger.info(`${contractName} contract deployed at address ${deployedContractInstance.options.address}`); // instance with the new contract address
            return deployedContractInstance.options.address;
        });
        return deployedContractAddress;
    });
}
