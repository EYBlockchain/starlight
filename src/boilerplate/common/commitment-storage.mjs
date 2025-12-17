/* eslint-disable camelcase */
/* eslint-disable import/no-cycle */
/**
Logic for storing and retrieving commitments from a mongo DB.
*/
import config from 'config';
import fs from 'fs';
import gen from 'general-number';
import mongo from './mongo.mjs';
import logger from './logger.mjs';
import utils from 'zkp-utils';
import { poseidonHash } from './number-theory.mjs';
import { generateProof } from './zokrates.mjs';
import { KeyManager } from './key-management/KeyManager.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;
const { generalise } = gen;

export function formatCommitment (commitment, context) {
  let data
  try {
    const nullifierHash = commitment.secretKey
      ? poseidonHash([
        BigInt(commitment.preimage.stateVarId.hex(32)),
        BigInt(commitment.secretKey.hex(32)),
        BigInt(commitment.preimage.salt.hex(32))
      ])
      : ''
    const preimage = generalise(commitment.preimage).all.hex(32)
    preimage.value = generalise(commitment.preimage.value).all
      ? generalise(commitment.preimage.value).all.integer
      : generalise(commitment.preimage.value).integer

    // Format domain parameters if they exist
    const domainParameters = commitment.domainParameters
      ? Object.fromEntries(
          Object.entries(commitment.domainParameters).map(([key, value]) => [
            key,
            generalise(value).integer
          ])
        )
      : null;

    data = {
      _id: commitment.hash.hex(32),
      name: commitment.name,
      source: commitment.source,
      mappingKey: commitment.mappingKey ? commitment.mappingKey : null,
      domainParameters,
      secretKey: commitment.secretKey ? commitment.secretKey.hex(32) : null,
      preimage,
      isNullified: commitment.isNullified,
      nullifier: commitment.secretKey ? nullifierHash.hex(32) : null,
      accountId: context?.accountId || null,
      blockNumber: commitment.blockNumber || null,
    }
    logger.debug(`Storing commitment ${data._id}${context?.accountId ? ` for accountId: ${context.accountId}` : ''}${domainParameters ? ` with domain parameters: ${JSON.stringify(domainParameters)}` : ''}`)
  } catch (error) {
    console.error('Error formatting commitment --->', error)
    console.error('Commitment object:', JSON.stringify(commitment, null, 2))
    throw error
  }
  return data
}

export async function persistCommitment (data) {
  const connection = await mongo.connection(MONGO_URL)
  const db = connection.db(COMMITMENTS_DB)
  const doc = { ...data, createdAt: new Date() };
  return db.collection(COMMITMENTS_COLLECTION).insertOne(doc);
}
// function to format a commitment for a mongo db and store it
export async function storeCommitment (commitment, context) {
  const data = formatCommitment(commitment, context)
  if (!data) {
    console.error('formatCommitment returned undefined/null data')
    throw new Error('Failed to format commitment')
  }
  try {
    const result = await persistCommitment(data)
    logger.debug(`Successfully persisted commitment ${data._id}`)
    return result
  } catch (error) {
    console.error('Error persisting commitment:', error)
    throw error
  }
}

// function to retrieve commitment with a specified stateVarId
export async function getCommitmentsById(id) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({ 'preimage.stateVarId': generalise(id).hex(32) })
    .toArray();
  return commitments;
}

// function to retrieve commitment with a specified stateVarId
export async function getCurrentWholeCommitment(id, accountId) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = {
    'preimage.stateVarId': generalise(id).hex(32),
    isNullified: false,
  };

  if (accountId) {
    query.accountId = accountId;
  }
  const commitment = await db.collection(COMMITMENTS_COLLECTION).findOne(query);
  return commitment;
}

// function to retrieve commitment with a specified stateName
export async function getCommitmentsByState(name, mappingKey = null, accountId = null, domainParameters = null) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { name: name };
  if (accountId) query['accountId'] = accountId;
  if (mappingKey) query['mappingKey'] = generalise(mappingKey).integer;

  // Add domain parameter filters if provided
  if (domainParameters) {
    for (const [key, value] of Object.entries(domainParameters)) {
      query[`domainParameters.${key}`] = generalise(value).integer;
    }
  }

  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find(query)
    .toArray();
  return commitments;
}

// function to delete commitment with a specified stateName
export async function deleteCommitmentsByState(name, mappingKey = null) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { name: name };
  if (mappingKey) query['mappingKey'] = generalise(mappingKey).integer;
  const deleteResult = await db
    .collection(COMMITMENTS_COLLECTION)
    .deleteMany(query);
  return deleteResult;
}

// function to retrieve all known nullified commitments
export async function getNullifiedCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({ isNullified: true })
    .toArray();
  return commitments;
}

/**
 * @returns {Promise<number>} The sum of the values ​​of all non-nullified commitments
 */
export async function getBalance(accountId) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = accountId ? { accountId } : {};
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({ ...query, isNullified: false }) //  no nullified
    .toArray();

  let sumOfValues = 0;
  commitments.forEach(commitment => {
    sumOfValues += parseInt(commitment.preimage.value, 10);
  });
  return sumOfValues;
}

export async function getBalanceByState(name, mappingKey = null, accountId=null, domainParameters = null) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { name: name };
  if (accountId) query['accountId'] = accountId;
  if (mappingKey) query['mappingKey'] = generalise(mappingKey).integer;

  // Add domain parameter filters if provided
  if (domainParameters) {
    for (const [key, value] of Object.entries(domainParameters)) {
      query[`domainParameters.${key}`] = generalise(value).integer;
    }
  }

  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find(query)
    .toArray();
  let sumOfValues = 0;
  commitments.forEach(commitment => {
    sumOfValues += commitment.isNullified
      ? 0
      : parseInt(commitment.preimage.value, 10);
  });
  return sumOfValues;
}

/**
 * @returns all the commitments existent in this database.
 */
export async function getAllCommitments(accountId) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = accountId ? { accountId } : {};
  const allCommitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find(query)
    .toArray();
  return allCommitments;
}

// function to update an existing commitment
export async function updateCommitment(commitment, updates) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { _id: commitment._id };
  const update = { $set: { ...updates, updatedAt: new Date() } };
  return db.collection(COMMITMENTS_COLLECTION).updateOne(query, update);
}

// function to mark a commitment as nullified for a mongo db and update the nullifier tree
export async function markNullified(commitmentHash, secretKey = null) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { _id: commitmentHash.hex(32) };
  const commitment = await db.collection(COMMITMENTS_COLLECTION).findOne(query);
  const nullifier = poseidonHash([
    BigInt(commitment.preimage.stateVarId),
    BigInt(commitment.secretKey || secretKey),
    BigInt(commitment.preimage.salt),
  ]);
  const update = {
    $set: {
      isNullified: true,
      nullifier: generalise(nullifier).hex(32),
      updatedAt: new Date(),
    },
  };
  // updating the original tree
  // eslint-disable-next-line camelcase
  //smt_tree = temp_smt_tree;

  return db.collection(COMMITMENTS_COLLECTION).updateOne(query, update);
}

export function getInputCommitments(
  publicKey,
  value,
  commitments,
  isStruct = false,
) {
  const possibleCommitments = commitments.filter(
    entry => entry.preimage.publicKey === publicKey && !entry.isNullified,
  );
  let commitmentsSum = 0;
  possibleCommitments.forEach(commit => {
    commitmentsSum += parseInt(commit.preimage.value, 10);
  });
  if (isStruct) {
    const possibleCommitmentsProp = getStructInputCommitments(
      value,
      possibleCommitments,
    );
    if (possibleCommitmentsProp.length > 0)
      return [
        true,
        possibleCommitmentsProp[0][0],
        possibleCommitmentsProp[0][1],
      ];
    return null;
  }
  if (
    possibleCommitments.length === 1 &&
    commitmentsSum >= parseInt(value, 10)
  ) {
    return [true, possibleCommitments[0], null];
  }
  possibleCommitments.sort(
    (commitA, commitB) =>
      parseInt(commitB.preimage.value, 10) -
      parseInt(commitA.preimage.value, 10),
  );

  if (
    parseInt(possibleCommitments[0].preimage.value, 10) +
      parseInt(possibleCommitments[1].preimage.value, 10) >=
    parseInt(value, 10)
  ) {
    return [true, possibleCommitments[0], possibleCommitments[1]];
  }
  if (commitmentsSum >= parseInt(value, 10))
    return [false, possibleCommitments[0], possibleCommitments[1]];
  return null;
}

function getStructInputCommitments(value, possibleCommitments) {
  if (possibleCommitments.length === 1) {
     throw new Error(
       "There is only one non-nullified commitment for a struct state variable. Split commitments is not yet supported for structs, and so at least two commitments are required."
     );
   } else if (possibleCommitments.length < 2){
     throw new Error(
       "There are no commitments available."
     );
   }
   let possibleCommitmentsProp = [];
   value.forEach((propValue, i) => {
     if (!possibleCommitmentsProp.length) {
       possibleCommitments.forEach((possibleCommit0, ind0) => {
         possibleCommitments.forEach((possibleCommit1, ind1) => {
           if (ind0 != ind1){
             if (
               parseInt(Object.values(possibleCommit0.preimage.value)[i], 10) +
                 parseInt(
                   Object.values(possibleCommit1.preimage.value)[i],
                   10,
                 ) >=
               parseInt(propValue, 10)
             ) {
               possibleCommitmentsProp.push([
                 possibleCommit0,
                 possibleCommit1
               ]);
             }
           }
         });
       });
       if (possibleCommitmentsProp.length === 0) {
         throw new Error(
           "There is not two commitments available with sufficient value for the decrementation. Note join commitments is not yet supported for structs."
         );
       }
     } else {
       let possibleCommitmentsTemp = [];
       possibleCommitmentsProp.forEach((possibleCommitmentPair, ind) => {
         if (
           parseInt(
             Object.values(possibleCommitmentPair[0].preimage.value)[i],
             10,
           ) +
             parseInt(
               Object.values(possibleCommitmentPair[1].preimage.value)[i],
               10,
             ) >=
             parseInt(propValue, 10)
         ) {
           possibleCommitmentsTemp.push(possibleCommitmentPair);
         }
       });
       possibleCommitmentsProp = possibleCommitmentsTemp;
       if (possibleCommitmentsProp.length === 0) {
         throw new Error(
           "There is not two commitments available with sufficient value for the decrementation. Note join commitments is not yet supported for structs."
         );
       }
     }
   });
   return possibleCommitmentsProp;
 }

export async function joinCommitments(
  contractName,
  statename,
  secretKey,
  publicKey,
  stateVarId,
  commitments,
  witnesses,
  instance,
  contractAddr,
  web3,
  context,
) {
  logger.warn(
    'Existing Commitments are not appropriate and we need to call Join Commitment Circuit. It will generate proof to join commitments, this will require an on-chain verification',
  );

  const oldCommitment_0_prevSalt = generalise(commitments[0].preimage.salt);
  const oldCommitment_1_prevSalt = generalise(commitments[1].preimage.salt);
  const oldCommitment_0_prev = generalise(commitments[0].preimage.value);
  const oldCommitment_1_prev = generalise(commitments[1].preimage.value);

  // Extract set membership witness:

  const oldCommitment_0_witness = witnesses[0];
  const oldCommitment_1_witness = witnesses[1];

  const oldCommitment_0_index = generalise(oldCommitment_0_witness.index);
  const oldCommitment_1_index = generalise(oldCommitment_1_witness.index);
  const oldCommitment_root = generalise(oldCommitment_0_witness.root);
  const oldCommitment_0_path = generalise(oldCommitment_0_witness.path).all;
  const oldCommitment_1_path = generalise(oldCommitment_1_witness.path).all;

  // increment would go here but has been filtered out

  // Calculate nullifier(s):

  let oldCommitment_stateVarId = stateVarId[0];
  if (stateVarId.length > 1) {
    oldCommitment_stateVarId = generalise(
      utils.mimcHash(
        [generalise(stateVarId[0]).bigInt, generalise(stateVarId[1]).bigInt],
        'ALT_BN_254',
      ),
    ).hex(32);
  }

  let oldCommitment_0_nullifier = poseidonHash([
    BigInt(oldCommitment_stateVarId),
    BigInt(secretKey.hex(32)),
    BigInt(oldCommitment_0_prevSalt.hex(32)),
  ]);
  let oldCommitment_1_nullifier = poseidonHash([
    BigInt(oldCommitment_stateVarId),
    BigInt(secretKey.hex(32)),
    BigInt(oldCommitment_1_prevSalt.hex(32)),
  ]);
  oldCommitment_0_nullifier = generalise(oldCommitment_0_nullifier.hex(32)); // truncate
  oldCommitment_1_nullifier = generalise(oldCommitment_1_nullifier.hex(32)); // truncate

  
  // Calculate commitment(s):

  const newCommitment_newSalt = generalise(utils.randomHex(31));

  let newCommitment_value =
    parseInt(oldCommitment_0_prev.integer, 10) +
    parseInt(oldCommitment_1_prev.integer, 10);

  newCommitment_value = generalise(newCommitment_value);

  let newCommitment = poseidonHash([
    BigInt(oldCommitment_stateVarId),
    BigInt(newCommitment_value.hex(32)),
    BigInt(publicKey.hex(32)),
    BigInt(newCommitment_newSalt.hex(32)),
  ]);

  newCommitment = generalise(newCommitment.hex(32)); // truncate

  let stateVarID = parseInt(oldCommitment_stateVarId, 16);
  let fromID = 0;
  let isMapping = 0;
  if (stateVarId.length > 1) {
    stateVarID = stateVarId[0];
    fromID = stateVarId[1].integer;
    isMapping = 1;
  }

  // Call Zokrates to generate the proof:
  const allInputs = [
    fromID,
    stateVarID,
    isMapping,
    secretKey.integer,
    secretKey.integer,

    oldCommitment_0_nullifier.integer,
    oldCommitment_1_nullifier.integer,
    oldCommitment_0_prev.integer,
    oldCommitment_0_prevSalt.integer,
    oldCommitment_1_prev.integer,
    oldCommitment_1_prevSalt.integer,
    oldCommitment_root.integer,
    oldCommitment_0_index.integer,
    oldCommitment_0_path.integer,
    oldCommitment_1_index.integer,
    oldCommitment_1_path.integer,
    publicKey.integer,
    newCommitment_newSalt.integer,
    newCommitment.integer,
  ].flat(Infinity);

  const res = await generateProof('joinCommitments', allInputs);
  const proof = generalise(Object.values(res.proof).flat(Infinity))
    .map(coeff => coeff.integer)
    .flat(Infinity);
  // Send transaction to the blockchain:

  // Get tenant-specific keys
  const keyManager = KeyManager.getInstance();
  const keys = await keyManager.getKeys(context);
  if (!keys || !keys.ethPK || !keys.ethSK) {
    throw new Error('Tenant Ethereum keys not found. Please register keys first.');
  }

  const txData = await instance.methods
    .joinCommitments(
      [oldCommitment_0_nullifier.integer, oldCommitment_1_nullifier.integer],
      oldCommitment_root.integer,
      [newCommitment.integer],
      proof,
    )
    .encodeABI();

  let txParams = {
    from: keys.ethPK,
    to: contractAddr,
    gas: config.web3.options.defaultGas,
    gasPrice: config.web3.options.defaultGasPrice,
    data: txData,
    chainId: await web3.eth.net.getId(),
  };

  const key = keys.ethSK;

  const signed = await web3.eth.accounts.signTransaction(txParams, key);

  const sendTxn = await web3.eth.sendSignedTransaction(signed.rawTransaction);

  let tx = await instance.getPastEvents('allEvents', {
    fromBlock: sendTxn?.blockNumber || 0,
    toBlock: sendTxn?.blockNumber || 'latest',
  });

  tx = tx[0];

  await markNullified(generalise(commitments[0]._id), secretKey.hex(32));
  await markNullified(generalise(commitments[1]._id), secretKey.hex(32));
  await storeCommitment({
    hash: newCommitment,
    name: statename,
    mappingKey: fromID,
    preimage: {
      stateVarId: generalise(oldCommitment_stateVarId),
      value: newCommitment_value,
      salt: newCommitment_newSalt,
      publicKey: publicKey,
    },
    secretKey: secretKey,
    isNullified: false,
  });

  return { tx };
}

export async function splitCommitments(
  contractName,
  statename,
  value,
  secretKey,
  publicKey,
  stateVarId,
  commitment,
  witness,
  instance,
  contractAddr,
  web3,
) {
  logger.warn(
    'Only one commitment exists, but it is enough to use. Calling Split Commitment circuit. It will generate proof to split commitments, this will require an on-chain verification',
  );

  const oldCommitment_0_prevSalt = generalise(commitment.preimage.salt);
  const oldCommitment_0_prev = generalise(commitment.preimage.value);

  // Extract set membership witness:

  const oldCommitment_0_witness = witness;

  const oldCommitment_0_index = generalise(oldCommitment_0_witness.index);
  const oldCommitment_root = generalise(oldCommitment_0_witness.root);
  const oldCommitment_0_path = generalise(oldCommitment_0_witness.path).all;

  // increment would go here but has been filtered out

  // Calculate nullifier(s):

  let oldCommitment_stateVarId = stateVarId[0];
  if (stateVarId.length > 1) {
    oldCommitment_stateVarId = generalise(
      utils.mimcHash(
        [generalise(stateVarId[0]).bigInt, generalise(stateVarId[1]).bigInt],
        'ALT_BN_254',
      ),
    ).hex(32);
  }

  let oldCommitment_0_nullifier = poseidonHash([
    BigInt(oldCommitment_stateVarId),
    BigInt(secretKey.hex(32)),
    BigInt(oldCommitment_0_prevSalt.hex(32)),
  ]);

  oldCommitment_0_nullifier = generalise(oldCommitment_0_nullifier.hex(32)); // truncate

    // Calculate commitment(s):

  const newCommitment_0_newSalt = generalise(utils.randomHex(31));

  let newCommitment_0_value = parseInt(value.integer, 10);

  newCommitment_0_value = generalise(newCommitment_0_value);

  let newCommitment_0 = poseidonHash([
    BigInt(oldCommitment_stateVarId),
    BigInt(newCommitment_0_value.hex(32)),
    BigInt(publicKey.hex(32)),
    BigInt(newCommitment_0_newSalt.hex(32)),
  ]);

  newCommitment_0 = generalise(newCommitment_0.hex(32)); // truncate

  const newCommitment_1_newSalt = generalise(utils.randomHex(31));

  let newCommitment_1_value =
    parseInt(oldCommitment_0_prev.integer, 10) - parseInt(value.integer, 10);

  newCommitment_1_value = generalise(newCommitment_1_value);

  let newCommitment_1 = poseidonHash([
    BigInt(oldCommitment_stateVarId),
    BigInt(newCommitment_1_value.hex(32)),
    BigInt(publicKey.hex(32)),
    BigInt(newCommitment_1_newSalt.hex(32)),
  ]);

  newCommitment_1 = generalise(newCommitment_1.hex(32)); // truncate

  let stateVarID = parseInt(oldCommitment_stateVarId, 16);
  let fromID = 0;
  let isMapping = 0;
  if (stateVarId.length > 1) {
    stateVarID = stateVarId[0];
    fromID = stateVarId[1].integer;
    isMapping = 1;
  }

  // Call Zokrates to generate the proof:
  const allInputs = [
    value.integer,
    fromID,
    stateVarID,
    isMapping,
    secretKey.integer,
    oldCommitment_0_nullifier.integer,
    oldCommitment_0_prev.integer,
    oldCommitment_0_prevSalt.integer,
    oldCommitment_root.integer,
    oldCommitment_0_index.integer,
    oldCommitment_0_path.integer,
    publicKey.integer,
    newCommitment_0_newSalt.integer,
    newCommitment_0.integer,
    publicKey.integer,
    newCommitment_1_newSalt.integer,
    newCommitment_1.integer,
  ].flat(Infinity);

  const res = await generateProof('splitCommitments', allInputs);
  const proof = generalise(Object.values(res.proof).flat(Infinity))
    .map(coeff => coeff.integer)
    .flat(Infinity);
  // Send transaction to the blockchain:

  const txData = await instance.methods
    .splitCommitments(
      [oldCommitment_0_nullifier.integer],
      oldCommitment_root.integer,
      [newCommitment_0.integer, newCommitment_1.integer],
      proof,
    )
    .encodeABI();

  let txParams = {
    from: config.web3.options.defaultAccount,
    to: contractAddr,
    gas: config.web3.options.defaultGas,
    gasPrice: config.web3.options.defaultGasPrice,
    data: txData,
    chainId: await web3.eth.net.getId(),
  };

  const key = config.web3.key;

  const signed = await web3.eth.accounts.signTransaction(txParams, key);

  const sendTxn = await web3.eth.sendSignedTransaction(signed.rawTransaction);

  let tx = await instance.getPastEvents('allEvents', {
    fromBlock: sendTxn?.blockNumber || 0,
    toBlock: sendTxn?.blockNumber || 'latest',
  });

  tx = tx[0];

  await markNullified(generalise(commitment._id), secretKey.hex(32));

  await storeCommitment({
    hash: newCommitment_0,
    name: statename,
    mappingKey: fromID,
    preimage: {
      stateVarId: generalise(oldCommitment_stateVarId),
      value: newCommitment_0_value,
      salt: newCommitment_0_newSalt,
      publicKey: publicKey,
    },
    secretKey: secretKey,
    isNullified: false,
  });

  await storeCommitment({
    hash: newCommitment_1,
    name: statename,
    mappingKey: fromID,
    preimage: {
      stateVarId: generalise(oldCommitment_stateVarId),
      value: newCommitment_1_value,
      salt: newCommitment_1_newSalt,
      publicKey: publicKey,
    },
    secretKey: secretKey,
    isNullified: false,
  });

  return { tx };
}

export async function getSharedSecretskeys(
  _recipientAddress,
  _recipientPublicKey = 0,
  context,
) {
   try {
    // Use KeyManager for shared secret key management
    const keyManager = KeyManager.getInstance();

    logger.debug('Getting shared secret keys via KeyManager', {
      recipientAddress: _recipientAddress,
      multiTenant: !!context?.accountId
    });

    const sharedPublicKey = await keyManager.getSharedSecretKeys(
      _recipientAddress,
      _recipientPublicKey,
      context
    );

    logger.info('Shared secret keys retrieved successfully', {
      multiTenant: !!context?.accountId
    });

    return sharedPublicKey;
  } catch (error) {
    logger.error('Failed to get shared secret keys:', error);
    throw error;
  }
}
