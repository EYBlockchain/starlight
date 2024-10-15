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
import { sharedSecretKey } from './number-theory.mjs';
import { generateProof } from './zokrates.mjs';
import { SumType, reduceTree, toBinArray, poseidonConcatHash,} from './smt_utils.mjs';
import { hlt } from './hash-lookup.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;
const { generalise } = gen;

const keyDb = '/app/orchestration/common/db/key.json';

const TRUNC_LENGTH = 32; // Just for testing so we don't make more than 32 deep smt trees.
const WHOLE_STATES = [];
// structure for SMT
const Branch = (leftTree, rightTree) => ({
  tag: 'branch',
  left: leftTree,
  right: rightTree,
});
const Leaf = val => ({
  tag: 'leaf',
  val: val,
});

const SMT = SumType([Branch, Leaf], () => {
  throw new TypeError('Invalid data structure provided');
});

// eslint-disable-next-line camelcase
let smt_tree = SMT(hlt[0]);
// eslint-disable-next-line camelcase
let temp_smt_tree = SMT(hlt[0]); // for temporary updates before proof generation

// Gets the hash of a smt_tree (or subtree)
export const getHash = tree => reduceTree(poseidonConcatHash, tree);

// function to format a commitment for a mongo db and store it
export async function storeCommitment(commitment) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  // we'll also compute and store the nullifier hash.
  const nullifierHash = commitment.secretKey
    ? poseidonHash([
        BigInt(commitment.preimage.stateVarId.hex(32)),
        BigInt(commitment.secretKey.hex(32)),
        BigInt(commitment.preimage.salt.hex(32)),
      ])
    : '';
  const preimage = generalise(commitment.preimage).all.hex(32);
  preimage.value = generalise(commitment.preimage.value).all
    ? generalise(commitment.preimage.value).all.integer
    : generalise(commitment.preimage.value).integer;
  const data = {
    _id: commitment.hash.hex(32),
    name: commitment.name,
    mappingKey: commitment.mappingKey ? commitment.mappingKey : null,
    secretKey: commitment.secretKey ? commitment.secretKey.hex(32) : null,
    preimage,
    isNullified: commitment.isNullified,
    nullifier: commitment.secretKey ? nullifierHash.hex(32) : null,
  };
  logger.debug(`Storing commitment ${data._id}`);
  return db.collection(COMMITMENTS_COLLECTION).insertOne(data);
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
export async function getCurrentWholeCommitment(id) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitment = await db.collection(COMMITMENTS_COLLECTION).findOne({
    'preimage.stateVarId': generalise(id).hex(32),
    isNullified: false,
  });
  return commitment;
}

// function to retrieve commitment with a specified stateName
export async function getCommitmentsByState(name, mappingKey = null) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { name: name };
  if (mappingKey) query['mappingKey'] = generalise(mappingKey).integer;
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find(query)
    .toArray();
  return commitments;
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
export async function getBalance() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({ isNullified: false }) //  no nullified
    .toArray();

  let sumOfValues = 0;
  commitments.forEach(commitment => {
    sumOfValues += parseInt(commitment.preimage.value, 10);
  });
  return sumOfValues;
}

export async function getBalanceByState(name, mappingKey = null) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { name: name };
  if (mappingKey) query['mappingKey'] = generalise(mappingKey).integer;
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
export async function getAllCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const allCommitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find()
    .toArray();
  return allCommitments;
}

// function to update an existing commitment
export async function updateCommitment(commitment, updates) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { _id: commitment._id };
  const update = { $set: updates };
  return db.collection(COMMITMENTS_COLLECTION).updateOne(query, update);
}

// This is a helper function to insertLeaf in smt that calls the recursion
function _insertLeaf(val, tree, binArr) {
  if (binArr.length > 0) {
    switch (tree.tag) {
      case 'branch': // Recursively enter developed subtree
        return binArr[0] === '0'
          ? Branch(_insertLeaf(val, tree.left, binArr.slice(1)), tree.right)
          : Branch(tree.left, _insertLeaf(val, tree.right, binArr.slice(1)));

      case 'leaf': // Open undeveloped subtree
        return binArr[0] === '0'
          ? Branch(
              _insertLeaf(
                val,
                Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]),
                binArr.slice(1),
              ),
              Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]),
            )
          : Branch(
              Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]),
              _insertLeaf(
                val,
                Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]),
                binArr.slice(1),
              ),
            );

      default: {
        return tree;
      }
    }
  } else return Leaf(val);
}

// This inserts a value into the smt as a leaf
function insertLeaf(val, tree) {
  const binArr = toBinArray(generalise(val));
  const padBinArr = Array(254 - binArr.length)
    .fill('0')
    .concat(...binArr)
    .slice(0, TRUNC_LENGTH);
  return _insertLeaf(val, tree, padBinArr);
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
    },
  };
  // updating the original tree
  // eslint-disable-next-line camelcase
  smt_tree = temp_smt_tree;

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
  if (possibleCommitments.length < 2) {
    logger.warn('Enough Commitments dont exists to use.');
    return null;
  }
  let possibleCommitmentsProp = [];
  value.forEach((propValue, i) => {
    let possibleCommitmentsTemp = [];
    possibleCommitments.sort(
      (commitA, commitB) =>
        parseInt(Object.values(commitB.preimage.value)[i], 10) -
        parseInt(Object.values(commitA.preimage.value)[i], 10),
    );
    if (!possibleCommitmentsProp.length) {
      if (
        parseInt(Object.values(possibleCommitments[0].preimage.value)[i], 10) +
          parseInt(
            Object.values(possibleCommitments[1].preimage.value)[i],
            10,
          ) >=
        parseInt(propValue, 10)
      ) {
        possibleCommitmentsProp.push([
          possibleCommitments[0],
          possibleCommitments[1],
        ]);
      } else {
        possibleCommitments.splice(0, 2);
        possibleCommitmentsProp = getStructInputCommitments(
          value,
          possibleCommitments,
        );
      }
    } else {
      possibleCommitments.forEach(possibleCommit => {
        if (possibleCommitmentsProp.includes(possibleCommit))
          possibleCommitmentsTemp.push(possibleCommit);
      });
      if (
        possibleCommitmentsTemp.length > 1 &&
        parseInt(
          Object.values(possibleCommitmentsTemp[0].preimage.value)[i],
          10,
        ) +
          parseInt(
            Object.values(possibleCommitmentsTemp[1].preimage.value)[i],
            10,
          ) <
          parseInt(propValue, 10)
      ) {
        possibleCommitments.splice(0, 2);
        possibleCommitmentsProp = getStructInputCommitments(
          value,
          possibleCommitments,
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

  // Non-membership witness for Nullifier
  const oldCommitment_0_nullifier_NonMembership_witness = getnullifierMembershipWitness(
    oldCommitment_0_nullifier,
  );
  const oldCommitment_1_nullifier_NonMembership_witness = getnullifierMembershipWitness(
    oldCommitment_1_nullifier,
  );

  const oldCommitment_nullifierRoot = generalise(
    oldCommitment_0_nullifier_NonMembership_witness.root,
  );
  const oldCommitment_0_nullifier_path = generalise(
    oldCommitment_0_nullifier_NonMembership_witness.path,
  ).all;
  const oldCommitment_1_nullifier_path = generalise(
    oldCommitment_1_nullifier_NonMembership_witness.path,
  ).all;

  await temporaryUpdateNullifier(a_0_nullifier);
  await temporaryUpdateNullifier(a_1_nullifier);

  const oldCommitment_0_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
    oldCommitment_0_nullifier,
  );
  const oldCommitment_1_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
    oldCommitment_1_nullifier,
  );

  const oldCommitment_0_nullifier_newpath = generalise(
    oldCommitment_0_updated_nullifier_NonMembership_witness.path,
  ).all;
  const oldCommitment_1_nullifier_newpath = generalise(
    oldCommitment_1_updated_nullifier_NonMembership_witness.path,
  ).all;
  const oldCommitment_newNullifierRoot = generalise(
    oldCommitment_0_updated_nullifier_NonMembership_witness.root,
  );
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

    oldCommitment_nullifierRoot.integer,
    oldCommitment_newNullifierRoot.integer,
    oldCommitment_0_nullifier.integer,
    oldCommitment_0_nullifier_path.integer,
    oldCommitment_0_nullifier_newpath.integer,
    oldCommitment_1_nullifier.integer,
    oldCommitment_1_nullifier_path.integer,
    oldCommitment_1_nullifier_newpath.integer,
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

  const txData = await instance.methods
    .joinCommitments(
      oldCommitment_nullifierRoot.integer,
      oldCommitment_newNullifierRoot.integer,
      [oldCommitment_0_nullifier.integer, oldCommitment_1_nullifier.integer],
      oldCommitment_root.integer,
      [newCommitment.integer],
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

  let tx = await instance.getPastEvents('allEvents');

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

  // Non-membership witness for Nullifier
  const oldCommitment_0_nullifier_NonMembership_witness = getnullifierMembershipWitness(
    oldCommitment_0_nullifier,
  );

  const oldCommitment_nullifierRoot = generalise(
    oldCommitment_0_nullifier_NonMembership_witness.root,
  );
  const oldCommitment_0_nullifier_path = generalise(
    oldCommitment_0_nullifier_NonMembership_witness.path,
  ).all;

  await temporaryUpdateNullifier(oldCommitment_0_nullifier);

  const oldCommitment_0_updated_nullifier_NonMembership_witness = getupdatedNullifierPaths(
    oldCommitment_0_nullifier,
  );

  const oldCommitment_0_nullifier_newpath = generalise(
    oldCommitment_0_updated_nullifier_NonMembership_witness.path,
  ).all;

  const oldCommitment_newNullifierRoot = generalise(
    oldCommitment_0_updated_nullifier_NonMembership_witness.root,
  );
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

    oldCommitment_nullifierRoot.integer,
    oldCommitment_newNullifierRoot.integer,
    oldCommitment_0_nullifier.integer,
    oldCommitment_0_nullifier_path.integer,
    oldCommitment_0_nullifier_newpath.integer,
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
      oldCommitment_nullifierRoot.integer,
      oldCommitment_newNullifierRoot.integer,
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

  let tx = await instance.getPastEvents('allEvents');

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

// This is a helper function for checkMembership
const _getnullifierMembershipWitness = (binArr, element, tree, acc) => {
  switch (tree.tag) {
    case 'branch':
      return binArr[0] === '0'
        ? _getnullifierMembershipWitness(
            binArr.slice(1),
            element,
            tree.left,
            [getHash(tree.right)].concat(acc),
          )
        : _getnullifierMembershipWitness(
            binArr.slice(1),
            element,
            tree.right,
            [getHash(tree.left)].concat(acc),
          );
    case 'leaf': {
      if (binArr.length > 0) {
        while (binArr.length > 0) {
          binArr[0] === '0'
            ? (acc = [hlt[TRUNC_LENGTH - (binArr.length - 1)]].concat(acc))
            : (acc = [hlt[TRUNC_LENGTH - (binArr.length - 1)]].concat(acc));
          binArr = binArr.slice(1);
        }
        return { isMember: false, path: acc };
      } else {
        return tree.val !== element
          ? { isMember: false, path: acc }
          : { isMember: true, path: acc };
      }
    }
    default:
      return tree;
  }
};

export async function updateNullifierTree() {
  smt_tree = temp_smt_tree;
}

export function getnullifierMembershipWitness(nullifier) {
  const binArr = toBinArray(generalise(nullifier));
  const padBinArr = Array(254 - binArr.length)
    .fill('0')
    .concat(...binArr)
    .slice(0, TRUNC_LENGTH);
  const membershipPath = _getnullifierMembershipWitness(
    padBinArr,
    nullifier,
    smt_tree,
    [],
  );
  const root = getHash(smt_tree);
  const witness = { path: membershipPath.path, root: root };
  return witness;
}

export async function temporaryUpdateNullifier(nullifier) {
  temp_smt_tree = insertLeaf(generalise(nullifier).hex(32), temp_smt_tree);
}

export async function reinstateNullifiers() {
  const initialised = [];
  const nullifiedCommitments = await getNullifiedCommitments();
  if (!nullifiedCommitments) {
    logger.info('No nullifiers to add to the tree');
    return;
  }
  logger.warn(
    'Reinstatiating nullifiers - NOTE that any nullifiers added from another client may not be known here, so the tree will be out of sync.',
  );
  for (const c of nullifiedCommitments) {
    if (
      WHOLE_STATES.includes(c.name) &&
      !initialised.includes(c.preimage.stateVarId)
    ) {
      logger.debug(`initialising state ${c.name}`);
      smt_tree = insertLeaf(
        poseidonHash([BigInt(c.preimage.stateVarId), BigInt(0), BigInt(0)]).hex(
          32,
        ),
        smt_tree,
      );
      initialised.push(c.preimage.stateVarId);
    }
    logger.debug(`nullifying state ${c.name}: ${c.nullifier}`);
    smt_tree = insertLeaf(c.nullifier, smt_tree);
  }
  temp_smt_tree = smt_tree;
}

export function getupdatedNullifierPaths(nullifier) {
  const binArr = toBinArray(generalise(nullifier));
  const padBinArr = Array(254 - binArr.length)
    .fill('0')
    .concat(...binArr)
    .slice(0, TRUNC_LENGTH);
  const membershipPath = _getnullifierMembershipWitness(
    padBinArr,
    nullifier,
    temp_smt_tree,
    [],
  );
  const root = getHash(temp_smt_tree);
  const witness = { path: membershipPath.path, root: root };
  return witness;
}
// This updates the nullifier Tree with constructor inputs
export async function addConstructorNullifiers() {
  const constructorInput = JSON.parse(
    fs.readFileSync("/app/orchestration/common/db/constructorTx.json", "utf-8")
  );
  const { nullifiers } = constructorInput;
  const { isNullfiersAdded } = constructorInput;
  if(isNullfiersAdded == false)
  {
      nullifiers.forEach(nullifier => {
      smt_tree = insertLeaf(nullifier, smt_tree);
    })
    temp_smt_tree = smt_tree;
    constructorInput.isNullfiersAdded = true;
    fs.writeFileSync(
      "/app/orchestration/common/db/constructorTx.json",
      JSON.stringify(constructorInput, null, 4)
    );
  
  }
}
export async function getSharedSecretskeys(
  _recipientAddress,
  _recipientPublicKey = 0,
) {
  const keys = JSON.parse(
    fs.readFileSync(keyDb, 'utf-8', err => {
      console.log(err);
    }),
  );
  const secretKey = generalise(keys.secretKey);
  const publicKey = generalise(keys.publicKey);
  let recipientPublicKey = generalise(_recipientPublicKey);
  const recipientAddress = generalise(_recipientAddress);
  if (_recipientPublicKey === 0) {
    recipientPublicKey = await this.instance.methods
      .zkpPublicKeys(recipientAddress.hex(20))
      .call();
    recipientPublicKey = generalise(recipientPublicKey);

    if (recipientPublicKey.length === 0) {
      throw new Error('WARNING: Public key for given  eth address not found.');
    }
  }

  const sharedKey = sharedSecretKey(secretKey, recipientPublicKey);
  console.log('sharedKey:', sharedKey);
  console.log('sharedKey:', sharedKey[1]);
  const keyJson = {
    secretKey: secretKey.integer,
    publicKey: publicKey.integer,
    sharedSecretKey: sharedKey[0].integer,
    sharedPublicKey: sharedKey[1].integer, // not req
  };
  fs.writeFileSync(keyDb, JSON.stringify(keyJson, null, 4));

  return sharedKey[1];
}
