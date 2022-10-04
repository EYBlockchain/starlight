import axios from 'axios';
import config from 'config';
import { getContractAddress } from './contract.mjs';
import logger from './logger.mjs';
import mongo from "mongodb";
import fs from "fs";

const { ZAPP_DB, MONGO_URL } = config;

const { MongoClient } = mongo;
const connection = {};

// rough draft of timber service - we may not need treeids but kept in just in case
const { url } = config.merkleTree;
export const startEventFilter = async (contractName, address) => {
  try {
    // const treeId = functionName;
    let contractAddress = address;
    if (!contractAddress) {
      contractAddress = await getContractAddress(contractName);
    }
    logger.http(
      `\nCalling /start for '${contractName}' tree and address '${contractAddress}'`,
    );
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
export const getLeafIndex = async (contractName, leafValue, address) => {
  logger.http(
    `\nCalling /leaf/value for leafValue ${leafValue} of ${contractName} tree`,
  );
  if (!address) {
    // eslint-disable-next-line no-param-reassign
    address = await getContractAddress(contractName);
  }
  const value = leafValue.toString();
  // const treeId = functionName;
  const contractAddress = address;
  let leafIndex;
  let errorCount = 0;
  while (errorCount < 20) {
    try {
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
      if (response.data.data !== null) {
        leafIndex = response.data.data.leafIndex;
        if (leafIndex) break;
        break;
      } else {
        throw new Error('leaf not found');
      }
    } catch (err) {
      errorCount++;
      logger.warn('Unable to get leaf - will try again in 3 seconds');
      await new Promise(resolve => setTimeout(() => resolve(), 3000));
    }
  }
  return leafIndex;
};
export const getRoot = async (contractName, address) => {
  // const treeId = functionName;
  logger.http(`\nCalling /update for ${contractName} tree`);
  try {
    let contractAddress = address;
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
    if (response.data.data === null)
      throw new Error('\nNo record found in Timber');
    return response.data.data.latestRecalculation.root;
  } catch (error) {
    throw new Error(error);
  }
};
export const getSiblingPath = async (contractName, leafIndex, leafValue) => {
  logger.http(`\nCalling /siblingPath/${leafIndex} for ${contractName} tree`);
  // const treeId = functionName;
  const contractAddress = await getContractAddress(contractName);
  if (leafIndex === undefined) {
    if (!leafValue) throw new Error(`No leafIndex xor leafValue specified.`);
    // eslint-disable-next-line no-param-reassign
    leafIndex = await getLeafIndex(contractName, leafValue, contractAddress);
  }
  let siblingPath;
  let errorCount = 0;
  while (errorCount < 20) {
    try {
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
      if (response.data.data !== null) {
        siblingPath = response.data.data;
        if (siblingPath) break;
        break;
      } else {
        throw new Error('leaf not found');
      }
    } catch (err) {
      errorCount++;
      logger.warn('Unable to get leaf - will try again in 3 seconds');
      await new Promise(resolve => setTimeout(() => resolve(), 3000));
    }
  }
  return siblingPath;
};
export const getMembershipWitness = async (contractName, leafValue) => {
  logger.http(`\nCalling getMembershipWitness for ${contractName} tree`);
  try {
    const leafIndex = await getLeafIndex(contractName, leafValue);
    let path = await getSiblingPath(contractName, leafIndex);
    const root = path[0].value;
    path = path.map(node => node.value);
    path.splice(0, 1);
    const witness = { index: leafIndex, path, root };
    return witness;
  } catch (error) {
    throw new Error(error);
  }
};

/////

export const connect = async (url) => {
	if (connection[url]) return connection[url];
	// Check if we are connecting to MongoDb or DocumentDb
	const { MONGO_CONNECTION_STRING = "" } = process.env;
	if (MONGO_CONNECTION_STRING !== "") {
		const client = await new MongoClient(`${MONGO_CONNECTION_STRING}`, {
			useUnifiedTopology: true,
		});
		connection[url] = await client.connect();
	} else {
		const client = await new MongoClient(url, { useUnifiedTopology: true });
	    connection[url] = await client.connect();
	}
	return connection[url];
};

export const disconnect = async (url) => {
	connection[url].close();
	delete connection[url];
};

/**
 * Function to save a commit, used in a challenge commit-reveal process
 */
export async function saveCommitment(dbFile, preimage) {
	// Store in file
	fs.writeFileSync(dbFile, JSON.stringify(preimage, null, 4));

	const connection = await connect(MONGO_URL);
	const dbMongo = connection.db(ZAPP_DB);

	const collectionName = Object.keys(preimage)[0];
    const ids = Object.keys(preimage[collectionName]);
	logger.info("Connect to mongodb", MONGO_URL);

	for (let id of ids){
	  // unreconized format. Return
	  const update = { $set: { ...preimage[collectionName][id] } };

	  dbMongo
		.collection(collectionName)
		.updateOne({ _id: id }, update, { upsert: true });
	}
	
}

export function readCommitment(db) {
	let preimage = {};
	if (fs.existsSync(db)) {
		preimage = JSON.parse(
			fs.readFileSync(db, "utf-8", (err) => {
				console.log(err);
			})
		);
	}
	return preimage;
}

export default {
	getLeafIndex,
	getRoot,
	getSiblingPath,
	getMembershipWitness,
	connect,
	disconnect,
	saveCommitment,
	readCommitment,
};
