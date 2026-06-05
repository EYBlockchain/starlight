import config from 'config';
import mongo from './mongo.mjs';
import logger from './logger.mjs';
import {
  getContractInstance,
  getContractInterface,
} from './contract.mjs';
import { recordNullifiers } from './commitment-storage.mjs';
import Web3 from './web3.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;
const web3 = Web3.connection();
const NULLIFIER_EVENT_NAME = 'Nullifiers';
const NULLIFIER_SYNC_COLLECTION = `${COMMITMENTS_COLLECTION}_sync`;

let nullifierReconciliationPromise = null;

async function getNullifierSyncCollection() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(NULLIFIER_SYNC_COLLECTION);
}

async function getDeployedContractMetadata() {
  try {
    const contractInterface = await getContractInterface('CONTRACT_NAME');
    const networkId = (await web3.eth.net.getId()).toString();
    const deployment = contractInterface.networks?.[networkId];
    if (!deployment?.address) return null;
    return {
      address: deployment.address,
      blockNumber: deployment.blockNumber || 1,
      networkId,
    };
  } catch (error) {
    logger.debug(
      `Skipping commitment nullifier reconciliation: ${error.message}`,
    );
    return null;
  }
}

function requireNullifierEvent(instance) {
  const hasNullifierEvent = instance?._jsonInterface?.some(
    item => item.type === 'event' && item.name === NULLIFIER_EVENT_NAME,
  );
  if (!hasNullifierEvent) {
    throw new Error(
      'Contract ABI does not include the Nullifiers event required for nullifier reconciliation.',
    );
  }
}

function getNullifiersFromEvent(eventData) {
  const nullifiers =
    eventData?.returnValues?.nullifiers ?? eventData?.returnValues?.[0] ?? [];
  return Array.isArray(nullifiers) ? nullifiers : [nullifiers];
}

export async function processNullifierEventData(eventData) {
  return recordNullifiers(getNullifiersFromEvent(eventData), {
    blockNumber: eventData?.blockNumber,
    transactionHash: eventData?.transactionHash,
  });
}

async function reconcileNullifiedCommitmentsFromEvents(instance, deployment) {
  const currentBlock = Number(await web3.eth.getBlockNumber());
  const syncCollection = await getNullifierSyncCollection();
  const syncId = [
    'CONTRACT_NAME',
    deployment.networkId,
    deployment.address.toLowerCase(),
    'nullifiers',
  ].join(':');
  const syncState = await syncCollection.findOne({ _id: syncId });
  const deploymentBlock = Number(deployment.blockNumber || 1);
  const fromBlock =
    syncState?.lastCheckedBlock === undefined
      ? deploymentBlock
      : Number(syncState.lastCheckedBlock) + 1;

  if (fromBlock > currentBlock) {
    return {
      fromBlock,
      toBlock: currentBlock,
      eventCount: 0,
      nullifierCount: 0,
      modifiedCount: 0,
      lastCheckedBlock: currentBlock,
    };
  }

  const nullifierEvents = await instance.getPastEvents(NULLIFIER_EVENT_NAME, {
    fromBlock,
    toBlock: currentBlock,
  });

  let nullifierCount = 0;
  let modifiedCount = 0;
  for (const eventData of nullifierEvents) {
    // eslint-disable-next-line no-await-in-loop
    const result = await processNullifierEventData(eventData);
    nullifierCount += result.nullifierCount;
    modifiedCount += result.modifiedCount;
  }

  await syncCollection.updateOne(
    { _id: syncId },
    {
      $set: {
        contractName: 'CONTRACT_NAME',
        contractAddress: deployment.address,
        networkId: deployment.networkId,
        lastCheckedBlock: currentBlock,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  return {
    fromBlock,
    toBlock: currentBlock,
    eventCount: nullifierEvents.length,
    nullifierCount,
    modifiedCount,
    lastCheckedBlock: currentBlock,
  };
}

export async function reconcileNullifiedCommitments() {
  if (!nullifierReconciliationPromise) {
    nullifierReconciliationPromise = (async () => {
      const deployment = await getDeployedContractMetadata();
      if (!deployment?.address) return null;
      const instance = await getContractInstance(
        'CONTRACT_NAME',
        deployment.address,
      );
      requireNullifierEvent(instance);
      return reconcileNullifiedCommitmentsFromEvents(instance, deployment);
    })().finally(() => {
      nullifierReconciliationPromise = null;
    });
  }

  return nullifierReconciliationPromise;
}
