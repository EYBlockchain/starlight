import axios from 'axios';
import config from 'config';

import { getContractInstance, getContractAddress } from './contract.mjs';
import logger from './logger.mjs';

// rough draft of timber service - we may not need treeids but kept in just in case

const { url } = config.merkleTree;

export const startEventFilter = async (functionName, address) => {
  try {
    const treeId = functionName;
    let contractAddress = address;
    if (!contractAddress) {
      contractAddress = await getContractAddress(`${functionName}Shield`);
    }
    logger.http(`\nCalling /start for '${treeId}' tree and address '${contractAddress}'`);
    const response = await axios.post(
      `${url}/start`,
      {
        contractAddress,
        treeId,
      },
      {
        timeout: 3600000,
      },
    );
    logger.http('Timber Response:', response.data.data);
    return response.data.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const getLeafIndex = async (functionName, leafValue) => {
  logger.http(`\nCalling /leaf/value for leafValue ${leafValue} of ${functionName} tree`);
  try {
    const value = leafValue.toString();
    const treeId = functionName;
    const contractAddress = await await getContractAddress(`${functionName}Shield`);
    const response = await axios.get(
      `${url}/leaf/value`,
      {
        data: {
          contractAddress,
          treeId,
          value,
        },
      },
      {
        timeout: 3600000,
      },
    );
    logger.http('Timber Response:', response.data.data);
    if (response.data.data === null) throw new Error('\nNo record found in Timber');
    return response.data.data.leafIndex;
  } catch (error) {
    throw new Error(error);
  }
};

export const getRoot = async (functionName, address) => {
  const treeId = functionName;
  logger.http(`\nCalling /update for ${treeId} tree`);
  try {
    let contractAddress = address;
    if (!contractAddress) {
      contractAddress = await getContractAddress(`${functionName}Shield`);
    }
    const response = await axios.patch(
      `${url}/update`,
      {
        contractAddress,
        treeId,
      },
      {
        timeout: 3600000,
      },
    );
    logger.http('Timber Response:', response.data.data.latestRecalculation);
    if (response.data.data === null) throw new Error('\nNo record found in Timber');
    return response.data.data.latestRecalculation.root;
  } catch (error) {
    throw new Error(error);
  }
};

export const getSiblingPath = async (functionName, leafIndex, leafValue) => {
  logger.http(`\nCalling /siblingPath/${leafIndex} for ${functionName} tree`);
  try {
    const treeId = functionName;
    const contractAddress = await getContractAddress(`${functionName}Shield`);
    if (leafIndex === undefined) {
      if (!leafValue) throw new Error(`No leafIndex xor leafValue specified.`);
      // eslint-disable-next-line no-param-reassign
      leafIndex = await getLeafIndex(treeId, leafValue);
    }
    const response = await axios.get(
      `${url}/siblingPath/${leafIndex}`, //
      {
        data: {
          contractAddress,
          treeId,
        },
      },
      {
        timeout: 360000,
      },
    );
    logger.http('Timber Response:', response.data.data);

    const siblingPath = response.data.data;
    const siblingPathValues = siblingPath.map(node => node.value);
    if (siblingPath === null) throw new Error('\nNo record found in Timber');
    return siblingPathValues;
  } catch (error) {
    throw new Error(error);
  }
};

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
