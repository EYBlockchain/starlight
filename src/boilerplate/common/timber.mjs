import axios from 'axios';
import config from 'config';

import { getContractAddress } from './contract.mjs';
import logger from './logger.mjs';

// rough draft of timber service - we may not need treeids but kept in just in case

const { url } = config.merkleTree;

export const startEventFilter = async (functionName, address) => {
  try {
    // const treeId = functionName;
    const contractName = `${functionName}Shield`;
    let contractAddress = address;
    if (!contractAddress) {
      contractAddress = await getContractAddress(contractName);
    }
    logger.http(`\nCalling /start for '${functionName}' tree and address '${contractAddress}'`);
    const response = await axios.post(
      `${url}/start`,
      {
        contractAddress,
        contractName,
        // treeId,
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
    // const treeId = functionName;
    const contractName = `${functionName}Shield`;
    const contractAddress = await getContractAddress(contractName);
    const response = await axios.get(
      `${url}/leaf/value`,
      {
        data: {
          contractAddress,
          contractName,
          // treeId,
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
  // const treeId = functionName;
  logger.http(`\nCalling /update for ${functionName} tree`);
  try {
    let contractAddress = address;
    const contractName = `${functionName}Shield`;
    if (!contractAddress) {
      contractAddress = await getContractAddress(contractName);
    }
    const response = await axios.patch(
      `${url}/update`,
      {
        contractAddress,
        contractName,
        // treeId,
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
    // const treeId = functionName;
    const contractName = `${functionName}Shield`;
    const contractAddress = await getContractAddress(contractName);
    if (leafIndex === undefined) {
      if (!leafValue) throw new Error(`No leafIndex xor leafValue specified.`);
      // eslint-disable-next-line no-param-reassign
      leafIndex = await getLeafIndex(functionName, leafValue);
    }
    const response = await axios.get(
      `${url}/siblingPath/${leafIndex}`, //
      {
        data: {
          contractAddress,
          contractName,
          // treeId,
        },
      },
      {
        timeout: 360000,
      },
    );
    logger.http('Timber Response:', response.data.data);

    const siblingPath = response.data.data;
    // const siblingPathValues = siblingPath.map(node => node.value);
    if (siblingPath === null) throw new Error('\nNo record found in Timber');
    return siblingPath;
  } catch (error) {
    throw new Error(error);
  }
};

export const getMembershipWitness = async (functionName, leafValue) => {
  logger.http(`\nCalling getMembershipWitness for ${functionName} tree`);
  try {
    const leafIndex = await getLeafIndex(functionName, leafValue);
    let path = await getSiblingPath(functionName, leafIndex);
    const root = path[0].value;
    path = path.map(node => node.value).splice(0, 1);
    const witness = { index: leafIndex, path: path, root: root };
    return witness;
  } catch (error) {
    throw new Error(error);
  }
};

export default {
  getLeafIndex,
  getRoot,
  getSiblingPath,
  getMembershipWitness,
};
