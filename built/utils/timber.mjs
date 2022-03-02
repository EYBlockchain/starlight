var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import axios from 'axios';
import config from 'config';
import { getContractAddress } from './contract.mjs';
import logger from './logger.mjs';
// rough draft of timber service - we may not need treeids but kept in just in case
const { url } = config.merkleTree;
export const startEventFilter = (functionName, address) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // const treeId = functionName;
        const contractName = `${functionName}Shield`;
        let contractAddress = address;
        if (!contractAddress) {
            contractAddress = yield getContractAddress(contractName);
        }
        logger.http(`\nCalling /start for '${functionName}' tree and address '${contractAddress}'`);
        const response = yield axios.post(`${url}/start`, {
            contractAddress,
            contractName,
            // treeId,
        }, {
            timeout: 3600000,
        });
        logger.http('Timber Response:', response.data.data);
        return response.data.data;
    }
    catch (error) {
        throw new Error(error);
    }
});
export const getLeafIndex = (functionName, leafValue) => __awaiter(void 0, void 0, void 0, function* () {
    logger.http(`\nCalling /leaf/value for leafValue ${leafValue} of ${functionName} tree`);
    try {
        const value = leafValue.toString();
        // const treeId = functionName;
        const contractName = `${functionName}Shield`;
        const contractAddress = yield getContractAddress(contractName);
        const response = yield axios.get(`${url}/leaf/value`, {
            data: {
                contractAddress,
                contractName,
                // treeId,
                value,
            },
        }, {
            timeout: 3600000,
        });
        logger.http('Timber Response:', response.data.data);
        if (response.data.data === null)
            throw new Error('\nNo record found in Timber');
        return response.data.data.leafIndex;
    }
    catch (error) {
        throw new Error(error);
    }
});
export const getRoot = (functionName, address) => __awaiter(void 0, void 0, void 0, function* () {
    // const treeId = functionName;
    logger.http(`\nCalling /update for ${functionName} tree`);
    try {
        let contractAddress = address;
        const contractName = `${functionName}Shield`;
        if (!contractAddress) {
            contractAddress = yield getContractAddress(contractName);
        }
        const response = yield axios.patch(`${url}/update`, {
            contractAddress,
            contractName,
            // treeId,
        }, {
            timeout: 3600000,
        });
        logger.http('Timber Response:', response.data.data.latestRecalculation);
        if (response.data.data === null)
            throw new Error('\nNo record found in Timber');
        return response.data.data.latestRecalculation.root;
    }
    catch (error) {
        throw new Error(error);
    }
});
export const getSiblingPath = (functionName, leafIndex, leafValue) => __awaiter(void 0, void 0, void 0, function* () {
    logger.http(`\nCalling /siblingPath/${leafIndex} for ${functionName} tree`);
    try {
        // const treeId = functionName;
        const contractName = `${functionName}Shield`;
        const contractAddress = yield getContractAddress(contractName);
        if (leafIndex === undefined) {
            if (!leafValue)
                throw new Error(`No leafIndex xor leafValue specified.`);
            // eslint-disable-next-line no-param-reassign
            leafIndex = yield getLeafIndex(functionName, leafValue);
        }
        const response = yield axios.get(`${url}/siblingPath/${leafIndex}`, //
        {
            data: {
                contractAddress,
                contractName,
                // treeId,
            },
        }, {
            timeout: 360000,
        });
        logger.http('Timber Response:', response.data.data);
        const siblingPath = response.data.data;
        // const siblingPathValues = siblingPath.map(node => node.value);
        if (siblingPath === null)
            throw new Error('\nNo record found in Timber');
        return siblingPath;
    }
    catch (error) {
        throw new Error(error);
    }
});
// export const getTreeEvents = async (treeId, transactionHash) => {
//   logger.http(`\nCalling getTreeEvents for ${treeId} tree`);
//   const contractAddress = await getMerkleTreeAddress(treeId);
//   const contractInstance = await getContractInstance('MerkleTree', contractAddress);
//   const eventLog = await contractInstance.getPastEvents(
//     'NewLeaves',
//     { fromBlock: 0, toBlock: 'latest' },
//     (error, event) => event,
//   );
//   logger.silly(eventLog);
//   const response = [];
//   eventLog.forEach(log => {
//     if (transactionHash && log.transactionHash !== transactionHash) return;
//     const namedVars = log.returnValues;
//     delete namedVars['0'];
//     delete namedVars['1'];
//     delete namedVars['2'];
//     response.push(namedVars);
//   });
//
//   return response;
// };
export default {
    getLeafIndex,
    getRoot,
    getSiblingPath,
};
