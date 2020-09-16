/* eslint no-underscore-dangle: 0 */ // --> ON
/**
 * This module contains the logic needed to interact with the FTokenShield contract,
 * specifically handling the mint, transfer, simpleBatchTransfer, and burn functions for fungible commitments.
 *
 * @module erc20.js
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor
 */

const zokrates = require('@eyblockchain/zokrates.js');
const fs = require('fs');
const config = require('./config');
const merkleTree = require('./merkleTree');
const utils = require('./utils');
const logger = require('./logger');
const Element = require('./Element');
const {
  getTruffleContractInstance,
  getWeb3ContractInstance,
  sendSignedTransaction,
} = require('./contractUtils');

/**
 * Mint a fungible token commitment.
 *
 * Note that `ownerPublicKey` is NOT the same as the user's Ethereum address. This is a 32 byte hex that is unique to a given user.
 *
 * @param {String} amount - the value of the coin
 * @param {String} zkpPublicKey - The minter's ZKP public key. Note that this is NOT the same as their Ethereum address.
 * @param {String} salt - Alice's token serial number as a hex string
 * @param {Object} blockchainOptions
 * @param {String} blockchainOptions.erc20Address - Address of ERC20 contract
 * @param {String} blockchainOptions.fTokenShieldAddress - Address of deployed fTokenShieldContract
 * @param {String} blockchainOptions.account - Account that is sending these transactions. Must be token owner.
 * @returns {String} commitment - Commitment of the minted coins
 * @returns {Number} commitmentIndex
 */
async function mint(
  amount,
  zkpPublicKey,
  salt,
  blockchainOptions,
  zokratesOptions,
  signingMethod = undefined,
) {
  const { fTokenShieldAddress, erc20Address } = blockchainOptions;
  const erc20AddressPadded = `0x${utils.strip0x(erc20Address).padStart(64, '0')}`;
  const account = utils.ensure0x(blockchainOptions.account);

  const {
    codePath,
    outputDirectory,
    witnessName = 'witness',
    pkPath,
    provingScheme = 'gm17',
    createProofJson = true,
    proofName = 'proof.json',
  } = zokratesOptions;

  const fTokenShieldInstance = signingMethod
    ? await getWeb3ContractInstance('FTokenShield', fTokenShieldAddress)
    : await getTruffleContractInstance('FTokenShield', fTokenShieldAddress);

  logger.debug('\nIN MINT...');

  // Calculate new arguments for the proof:
  const commitment = utils.shaHash(erc20AddressPadded, amount, zkpPublicKey, salt);

  logger.debug('Existing Proof Variables:');
  const p = config.ZOKRATES_PACKING_SIZE;
  const pt = Math.ceil((config.LEAF_HASHLENGTH * 8) / config.ZOKRATES_PACKING_SIZE); // packets in bits
  logger.debug(
    'erc20AddressPadded',
    erc20AddressPadded,
    ' : ',
    utils.hexToFieldPreserve(erc20AddressPadded, 248, 1),
  );
  logger.debug('amount: ', `${amount} : `, utils.hexToFieldPreserve(amount, p, 1));
  logger.debug('publicKey: ', zkpPublicKey, ' : ', utils.hexToFieldPreserve(zkpPublicKey, p, pt));
  logger.debug('salt: ', salt, ' : ', utils.hexToFieldPreserve(salt, p, pt));

  logger.debug('New Proof Variables:');
  logger.debug('commitment: ', commitment, ' : ', utils.hexToFieldPreserve(commitment, p, pt));

  const publicInputHash = utils.shaHash(erc20AddressPadded, amount, commitment);
  logger.debug(
    'publicInputHash:',
    publicInputHash,
    ' : ',
    utils.hexToFieldPreserve(publicInputHash, 248, 1, 1),
  );

  // compute the proof
  logger.debug('Computing witness...');

  const allInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
    new Element(erc20AddressPadded, 'field', 248, 1),
    new Element(amount, 'field', 128, 1),
    new Element(zkpPublicKey, 'field'),
    new Element(salt, 'field'),
    new Element(commitment, 'field'),
  ]);

  logger.debug(
    'To debug witness computation, use ./zok to run up a zokrates container then paste these arguments into the terminal:',
  );
  logger.debug(`./zokrates compute-witness -a ${allInputs.join(' ')} -i gm17/ft-mint/out`);

  await zokrates.computeWitness(codePath, outputDirectory, witnessName, allInputs);

  logger.debug('Computing proof...');
  await zokrates.generateProof(pkPath, codePath, `${outputDirectory}/witness`, provingScheme, {
    createFile: createProofJson,
    directory: outputDirectory,
    fileName: proofName,
  });

  let { proof } = JSON.parse(fs.readFileSync(`${outputDirectory}/${proofName}`));

  proof = Object.values(proof);
  // convert to flattened array:
  proof = utils.flattenDeep(proof);
  // convert to decimal, as the solidity functions expect uints
  proof = proof.map(el => utils.hexToDec(el));

  // Approve fTokenShieldInstance to take tokens from minter's account.
  let fTokenInstance;
  if (signingMethod) {
    fTokenInstance = await getWeb3ContractInstance('ERC20Interface', erc20Address);
    const encodedRawTransaction = fTokenInstance.methods
      .approve(fTokenShieldInstance._address, parseInt(amount, 16))
      .encodeABI();
    const signedTransaction = await signingMethod(encodedRawTransaction, fTokenInstance._address);
    await sendSignedTransaction(signedTransaction);
  } else {
    fTokenInstance = await getTruffleContractInstance('ERC20Interface', erc20Address);
    await fTokenInstance.approve(fTokenShieldInstance.address, parseInt(amount, 16), {
      from: account,
      gas: 4000000,
      gasPrice: config.GASPRICE,
    });
  }

  logger.debug('Minting within the Shield contract');

  const publicInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
  ]);

  logger.debug('proof:');
  logger.debug(proof);
  logger.debug('publicInputs:');
  logger.debug(publicInputs);

  // Mint the commitment
  logger.debug(
    'Approving ERC-20 spend from: ',
    signingMethod ? fTokenShieldInstance._address : fTokenShieldInstance.address,
  );

  let txReceipt;
  let commitmentIndex;
  if (signingMethod) {
    const encodedRawTransaction = fTokenShieldInstance.methods
      .mint(erc20AddressPadded, proof, publicInputs, amount, commitment)
      .encodeABI();
    const signedTransaction = await signingMethod(
      encodedRawTransaction,
      fTokenShieldInstance._address,
    );
    txReceipt = await sendSignedTransaction(signedTransaction);
    const newLeafEvents = await fTokenShieldInstance.getPastEvents('NewLeaf', {
      filter: { transactionHash: txReceipt.transactionHash },
    });
    commitmentIndex = newLeafEvents[0].returnValues.leafIndex;
    logger.debug('ERC-20 spend approved!', parseInt(amount, 16));
    const balance = await fTokenInstance.methods.balanceOf(account).call();
    logger.debug('Balance of account', account, balance);
  } else {
    txReceipt = await fTokenShieldInstance.mint(
      erc20AddressPadded,
      proof,
      publicInputs,
      amount,
      commitment,
      {
        from: account,
        gas: 6500000,
        gasPrice: config.GASPRICE,
      },
    );
    utils.gasUsedStats(txReceipt, 'mint');
    const newLeafLog = txReceipt.logs.filter(log => {
      return log.event === 'NewLeaf';
    });
    commitmentIndex = newLeafLog[0].args.leafIndex;
    logger.debug('ERC-20 spend approved!', parseInt(amount, 16));
    logger.debug(
      'Balance of account',
      account,
      (await fTokenInstance.balanceOf.call(account)).toNumber(),
    );
  }

  logger.debug('Mint output: [zA, zAIndex]:', commitment, commitmentIndex.toString());
  logger.debug('MINT COMPLETE\n');

  return { commitment, commitmentIndex };
}

/**
 * This function actually transfers a coin.
 * @param {Array} inputCommitments - Array of two commitments owned by the sender.
 * @param {Array} outputCommitments - Array of two commitments.
 * Currently the first is sent to the receiverPublicKey, and the second is sent to the sender.
 * @param {String} receiverZkpPublicKey - Receiver's Zkp Public Key
 * @param {String} senderZkpPrivateKey - Private key of the sender's
 * @param {Object} blockchainOptions
 * @param {String} blockchainOptions.erc20Address - Address of ERC20 contract
 * @param {String} blockchainOptions.fTokenShieldAddress - Address of deployed fTokenShieldContract
 * @param {String} blockchainOptions.account - Account that is sending these transactions
 * @returns {Object[]} outputCommitments - Updated outputCommitments with their commitments and indexes.
 * @returns {Object} Transaction object
 */
async function transfer(
  _inputCommitments,
  _outputCommitments,
  receiverZkpPublicKey,
  senderZkpPrivateKey,
  blockchainOptions,
  zokratesOptions,
  signingMethod = undefined,
) {
  const { fTokenShieldAddress, erc20Address } = blockchainOptions;
  const erc20AddressPadded = `0x${utils.strip0x(erc20Address).padStart(64, '0')}`;
  const account = utils.ensure0x(blockchainOptions.account);

  const {
    codePath,
    outputDirectory,
    witnessName = 'witness',
    pkPath,
    provingScheme = 'gm17',
    createProofJson = true,
    proofName = 'proof.json',
  } = zokratesOptions;

  logger.debug('\nIN TRANSFER...');
  logger.debug('Finding the relevant Shield and Verifier contracts');

  let fTokenShieldInstance = await getTruffleContractInstance('FTokenShield', fTokenShieldAddress);

  const inputCommitments = _inputCommitments;
  const outputCommitments = _outputCommitments;

  // due to limitations in the size of the adder implemented in the proof dsl, we need C+D and E+F to easily fit in <128 bits (16 bytes). They could of course be bigger than we allow here.
  const inputSum =
    parseInt(inputCommitments[0].value, 16) + parseInt(inputCommitments[1].value, 16);
  const outputSum =
    parseInt(outputCommitments[0].value, 16) + parseInt(outputCommitments[1].value, 16);
  if (inputSum > 0xffffffff || outputSum > 0xffffffff)
    throw new Error(`Input commitments' values are too large`);

  // Calculate new arguments for the proof:
  const senderPublicKey = utils.hash(senderZkpPrivateKey);
  inputCommitments[0].nullifier = utils.shaHash(inputCommitments[0].salt, senderZkpPrivateKey);

  inputCommitments[1].nullifier = utils.shaHash(inputCommitments[1].salt, senderZkpPrivateKey);

  outputCommitments[0].commitment = utils.shaHash(
    erc20AddressPadded,
    outputCommitments[0].value,
    receiverZkpPublicKey,
    outputCommitments[0].salt,
  );
  outputCommitments[1].commitment = utils.shaHash(
    erc20AddressPadded,
    outputCommitments[1].value,
    senderPublicKey,
    outputCommitments[1].salt,
  );

  // Get the sibling-path from the token commitments (leaves) to the root. Express each node as an Element class.
  inputCommitments[0].siblingPath = await merkleTree.getSiblingPath(
    fTokenShieldInstance,
    inputCommitments[0].commitment,
    inputCommitments[0].commitmentIndex,
  );
  inputCommitments[1].siblingPath = await merkleTree.getSiblingPath(
    fTokenShieldInstance,
    inputCommitments[1].commitment,
    inputCommitments[1].commitmentIndex,
  );

  // TODO: edit merkle-tree microservice API to accept 2 path requests at once, to avoid the possibility of the merkle-tree DB's root being updated between the 2 GET requests. Until then, we need to check that both paths share the same root with the below check:
  if (inputCommitments[0].siblingPath[0] !== inputCommitments[1].siblingPath[0])
    throw new Error("The sibling paths don't share a common root.");

  const root = inputCommitments[0].siblingPath[0];
  // TODO: checkRoot() is not essential. It's only useful for debugging as we make iterative improvements to nightfall's zokrates files. Possibly delete in future.
  merkleTree.checkRoot(
    inputCommitments[0].commitment,
    inputCommitments[0].commitmentIndex,
    inputCommitments[0].siblingPath,
    root,
  );
  merkleTree.checkRoot(
    inputCommitments[1].commitment,
    inputCommitments[1].commitmentIndex,
    inputCommitments[1].siblingPath,
    root,
  );

  inputCommitments[0].siblingPathElements = inputCommitments[0].siblingPath.map(
    nodeValue => new Element(nodeValue, 'field', config.NODE_HASHLENGTH * 8, 1),
  ); // we truncate to 216 bits - sending the whole 256 bits will overflow the prime field

  inputCommitments[1].siblingPathElements = inputCommitments[1].siblingPath.map(
    element => new Element(element, 'field', config.NODE_HASHLENGTH * 8, 1),
  ); // we truncate to 216 bits - sending the whole 256 bits will overflow the prime field

  // console logging:
  logger.debug('Existing Proof Variables:');
  const p = config.ZOKRATES_PACKING_SIZE;
  logger.debug(
    `inputCommitments[0].value: ${inputCommitments[0].value} : ${utils.hexToFieldPreserve(
      inputCommitments[0].value,
      p,
    )}`,
  );
  logger.debug(
    `inputCommitments[1].value: ${inputCommitments[1].value} : ${utils.hexToFieldPreserve(
      inputCommitments[1].value,
      p,
    )}`,
  );
  logger.debug(
    `outputCommitments[0].value: ${outputCommitments[0].value} : ${utils.hexToFieldPreserve(
      outputCommitments[0].value,
      p,
    )}`,
  );
  logger.debug(
    `outputCommitments[1].value: ${outputCommitments[1].value} : ${utils.hexToFieldPreserve(
      outputCommitments[1].value,
      p,
    )}`,
  );
  logger.debug(
    `receiverPublicKey: ${receiverZkpPublicKey} : ${utils.hexToFieldPreserve(
      receiverZkpPublicKey,
      p,
    )}`,
  );
  logger.debug(
    `inputCommitments[0].salt: ${inputCommitments[0].salt} : ${utils.hexToFieldPreserve(
      inputCommitments[0].salt,
      p,
    )}`,
  );
  logger.debug(
    `inputCommitments[1].salt: ${inputCommitments[1].salt} : ${utils.hexToFieldPreserve(
      inputCommitments[1].salt,
      p,
    )}`,
  );
  logger.debug(
    `outputCommitments[0].salt: ${outputCommitments[0].salt} : ${utils.hexToFieldPreserve(
      outputCommitments[0].salt,
      p,
    )}`,
  );
  logger.debug(
    `outputCommitments[1].salt: ${outputCommitments[1].salt} : ${utils.hexToFieldPreserve(
      outputCommitments[1].salt,
      p,
    )}`,
  );
  logger.debug(
    `senderSecretKey: ${senderZkpPrivateKey} : ${utils.hexToFieldPreserve(senderZkpPrivateKey, p)}`,
  );
  logger.debug(
    `inputCommitments[0].commitment: ${inputCommitments[0].commitment} : ${utils.hexToFieldPreserve(
      inputCommitments[0].commitment,
      p,
    )}`,
  );
  logger.debug(
    `inputCommitments[1].commitment: ${inputCommitments[1].commitment} : ${utils.hexToFieldPreserve(
      inputCommitments[1].commitment,
      p,
    )}`,
  );

  logger.debug('New Proof Variables:');
  logger.debug(`pkA: ${senderPublicKey} : ${utils.hexToFieldPreserve(senderPublicKey, p)}`);
  logger.debug(
    `inputCommitments[0].nullifier: ${inputCommitments[0].nullifier} : ${utils.hexToFieldPreserve(
      inputCommitments[0].nullifier,
      p,
    )}`,
  );
  logger.debug(
    `inputCommitments[1].nullifier: ${inputCommitments[1].nullifier} : ${utils.hexToFieldPreserve(
      inputCommitments[1].nullifier,
      p,
    )}`,
  );
  logger.debug(
    `outputCommitments[0].commitment: ${
      outputCommitments[0].commitment
    } : ${utils.hexToFieldPreserve(outputCommitments[0].commitment, p)}`,
  );
  logger.debug(
    `outputCommitments[1].commitment: ${
      outputCommitments[1].commitment
    } : ${utils.hexToFieldPreserve(outputCommitments[1].commitment, p)}`,
  );
  logger.debug(`root: ${root} : ${utils.hexToFieldPreserve(root, p)}`);
  logger.debug(`inputCommitments[0].siblingPath:`, inputCommitments[0].siblingPath);
  logger.debug(`inputCommitments[1].siblingPath:`, inputCommitments[1].siblingPath);
  logger.debug(`inputCommitments[0].commitmentIndex:`, inputCommitments[0].commitmentIndex);
  logger.debug(`inputCommitments[1].commitmentIndex:`, inputCommitments[1].commitmentIndex);

  const publicInputHash = utils.shaHash(
    root,
    inputCommitments[0].nullifier,
    inputCommitments[1].nullifier,
    outputCommitments[0].commitment,
    outputCommitments[1].commitment,
  );
  logger.debug(
    'publicInputHash:',
    publicInputHash,
    ' : ',
    utils.hexToFieldPreserve(publicInputHash, 248, 1, 1),
  );

  const rootElement =
    process.env.HASH_TYPE === 'mimc'
      ? new Element(root, 'field', 256, 1)
      : new Element(root, 'field', 128, 2);

  // compute the proof
  logger.debug('Computing witness...');

  const allInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
    new Element(erc20AddressPadded, 'field', 248, 1),
    new Element(inputCommitments[0].value, 'field', 128, 1),
    new Element(senderZkpPrivateKey, 'field'),
    new Element(inputCommitments[0].salt, 'field'),
    ...inputCommitments[0].siblingPathElements.slice(1),
    new Element(inputCommitments[0].commitmentIndex, 'field', 128, 1), // the binary decomposition of a leafIndex gives its path's 'left-right' positions up the tree. The decomposition is done inside the circuit.,
    new Element(inputCommitments[1].value, 'field', 128, 1),
    new Element(inputCommitments[1].salt, 'field'),
    ...inputCommitments[1].siblingPathElements.slice(1),
    new Element(inputCommitments[1].commitmentIndex, 'field', 128, 1), // the binary decomposition of a leafIndex gives its path's 'left-right' positions up the tree. The decomposition is done inside the circuit.,
    new Element(inputCommitments[0].nullifier, 'field'),
    new Element(inputCommitments[1].nullifier, 'field'),
    new Element(outputCommitments[0].value, 'field', 128, 1),
    new Element(receiverZkpPublicKey, 'field'),
    new Element(outputCommitments[0].salt, 'field'),
    new Element(outputCommitments[0].commitment, 'field'),
    new Element(outputCommitments[1].value, 'field', 128, 1),
    new Element(outputCommitments[1].salt, 'field'),
    new Element(outputCommitments[1].commitment, 'field'),
    rootElement,
  ]);

  logger.debug(
    'To debug witness computation, use ./zok to run up a zokrates container then paste these arguments into the terminal:',
  );
  logger.debug(`./zokrates compute-witness -a ${allInputs.join(' ')} -i gm17/ft-transfer/out`);

  await zokrates.computeWitness(
    codePath,
    outputDirectory,
    `${outputCommitments[0].commitment}-${witnessName}`,
    allInputs,
  );

  logger.debug('Computing proof...');

  await zokrates.generateProof(
    pkPath,
    codePath,
    `${outputDirectory}/${outputCommitments[0].commitment}-witness`,
    provingScheme,
    {
      createFile: createProofJson,
      directory: outputDirectory,
      fileName: `${outputCommitments[0].commitment}-${proofName}`,
    },
  );

  let { proof } = JSON.parse(
    fs.readFileSync(`${outputDirectory}/${outputCommitments[0].commitment}-${proofName}`),
  );

  proof = Object.values(proof);
  // convert to flattened array:
  proof = utils.flattenDeep(proof);
  // convert to decimal, as the solidity functions expect uints
  proof = proof.map(el => utils.hexToDec(el));

  logger.debug('Transferring within the Shield contract');

  const publicInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
  ]);

  logger.debug('proof:');
  logger.debug(proof);
  logger.debug('publicInputs:');
  logger.debug(publicInputs);

  // Transfers commitment
  let txReceipt;
  if (signingMethod) {
    fTokenShieldInstance = await getWeb3ContractInstance('FTokenShield', fTokenShieldAddress);
    const encodedRawTransaction = fTokenShieldInstance.methods
      .transfer(
        proof,
        publicInputs,
        root,
        inputCommitments[0].nullifier,
        inputCommitments[1].nullifier,
        outputCommitments[0].commitment,
        outputCommitments[1].commitment,
      )
      .encodeABI();
    const signedTransaction = await signingMethod(
      encodedRawTransaction,
      fTokenShieldInstance._address,
      true,
    );
    txReceipt = await sendSignedTransaction(signedTransaction);
    const newLeavesEvents = await fTokenShieldInstance.getPastEvents('NewLeaves', {
      filter: { transactionHash: txReceipt.transactionHash },
    });
    outputCommitments[0].commitmentIndex = parseInt(
      newLeavesEvents[0].returnValues.minLeafIndex,
      10,
    );
    outputCommitments[1].commitmentIndex = outputCommitments[0].commitmentIndex + 1;
  } else {
    txReceipt = await fTokenShieldInstance.transfer(
      proof,
      publicInputs,
      root,
      inputCommitments[0].nullifier,
      inputCommitments[1].nullifier,
      outputCommitments[0].commitment,
      outputCommitments[1].commitment,
      {
        from: account,
        gas: 6500000,
        gasPrice: config.GASPRICE,
      },
    );
    utils.gasUsedStats(txReceipt, 'transfer');
    const newLeavesLog = txReceipt.logs.filter(log => {
      return log.event === 'NewLeaves';
    });
    outputCommitments[0].commitmentIndex = parseInt(newLeavesLog[0].args.minLeafIndex, 10);
    outputCommitments[1].commitmentIndex = outputCommitments[0].commitmentIndex + 1;
  }

  if (fs.existsSync(`${outputDirectory}/${outputCommitments[0].commitment}-${proofName}`))
    fs.unlinkSync(`${outputDirectory}/${outputCommitments[0].commitment}-${proofName}`);

  if (fs.existsSync(`${outputDirectory}/${outputCommitments[0].commitment}-witness`))
    fs.unlinkSync(`${outputDirectory}/${outputCommitments[0].commitment}-witness`);

  logger.debug(
    `Deleted file ${outputDirectory}/${outputCommitments[0].commitment}-${proofName} \n`,
  );

  logger.debug('TRANSFER COMPLETE\n');

  return {
    outputCommitments,
    txReceipt,
  };
}

/**
 * This function burns a commitment, i.e. it recovers ERC-20 into your
 * account. All values are hex strings.
 * @param {string} amount - the value of the commitment in hex (i.e. the amount you are burning)
 * @param {string} receiverZkpPrivateKey - the secret key of the person doing the burning (in hex)
 * @param {string} salt - the random nonce used in the commitment
 * @param {string} commitment - the value of the commitment being burned
 * @param {string} commitmentIndex - the index of the commitment in the Merkle Tree
 * @param {Object} blockchainOptions
 * @param {String} blockchainOptions.erc20Address - Address of ERC20 contract
 * @param {String} blockchainOptions.fTokenShieldAddress - Address of deployed fTokenShieldContract
 * @param {String} blockchainOptions.account - Account that is sending these transactions
 * @param {String} blockchainOptions.tokenReceiver - Account that will receive the tokens
 */
async function burn(
  amount,
  receiverZkpPrivateKey,
  salt,
  commitment,
  commitmentIndex,
  blockchainOptions,
  zokratesOptions,
  signingMethod = undefined,
) {
  const { fTokenShieldAddress, erc20Address, tokenReceiver: _payTo } = blockchainOptions;
  const erc20AddressPadded = `0x${utils.strip0x(erc20Address).padStart(64, '0')}`;

  const account = utils.ensure0x(blockchainOptions.account);

  const {
    codePath,
    outputDirectory,
    witnessName = 'witness',
    pkPath,
    provingScheme = 'gm17',
    createProofJson = true,
    proofName = 'proof.json',
  } = zokratesOptions;

  let payTo = _payTo;
  if (payTo === undefined) payTo = account; // have the option to pay out to another address
  // before we can burn, we need to deploy a verifying key to mintVerifier (reusing mint for this)
  logger.debug('\nIN BURN...');
  logger.debug('Finding the relevant Shield and Verifier contracts');

  let fTokenShieldInstance = await getTruffleContractInstance('FTokenShield', fTokenShieldAddress);

  // Calculate new arguments for the proof:
  const nullifier = utils.shaHash(salt, receiverZkpPrivateKey);

  // Get the sibling-path from the token commitments (leaves) to the root. Express each node as an Element class.
  const siblingPath = await merkleTree.getSiblingPath(
    fTokenShieldInstance,
    commitment,
    commitmentIndex,
  );

  const root = siblingPath[0];
  // TODO: checkRoot() is not essential. It's only useful for debugging as we make iterative improvements to nightfall's zokrates files. Possibly delete in future.
  merkleTree.checkRoot(commitment, commitmentIndex, siblingPath, root);

  const siblingPathElements = siblingPath.map(
    nodeValue => new Element(nodeValue, 'field', config.NODE_HASHLENGTH * 8, 1),
  ); // we truncate to 216 bits - sending the whole 256 bits will overflow the prime field

  // Summarise values in the console:
  logger.debug('Existing Proof Variables:');
  const p = config.ZOKRATES_PACKING_SIZE;
  logger.debug(`amount: ${amount} : ${utils.hexToFieldPreserve(amount, p)}`);
  logger.debug(
    `receiverSecretKey: ${receiverZkpPrivateKey} : ${utils.hexToFieldPreserve(
      receiverZkpPrivateKey,
      p,
    )}`,
  );
  logger.debug(`salt: ${salt} : ${utils.hexToFieldPreserve(salt, p)}`);
  logger.debug(`payTo: ${payTo} : ${utils.hexToFieldPreserve(payTo, p)}`);
  const payToLeftPadded = utils.leftPadHex(payTo, config.LEAF_HASHLENGTH * 2); // left-pad the payToAddress with 0's to fill all 256 bits (64 octets) (so the sha256 function is hashing the same thing as inside the zokrates proof)
  logger.debug(`payToLeftPadded: ${payToLeftPadded}`);

  logger.debug('New Proof Variables:');
  logger.debug(`nullifier: ${nullifier} : ${utils.hexToFieldPreserve(nullifier, p)}`);
  logger.debug(`commitment: ${commitment} : ${utils.hexToFieldPreserve(commitment, p)}`);
  logger.debug(`root: ${root} : ${utils.hexToFieldPreserve(root, p)}`);
  logger.debug(`siblingPath:`, siblingPath);
  logger.debug(`commitmentIndex:`, commitmentIndex);

  const publicInputHash = utils.shaHash(
    erc20AddressPadded,
    root,
    nullifier,
    amount,
    payToLeftPadded,
  ); // notice we're using the version of payTo which has been padded to 256-bits; to match our derivation of publicInputHash within our zokrates proof.
  logger.debug(
    'publicInputHash:',
    publicInputHash,
    ' : ',
    utils.hexToFieldPreserve(publicInputHash, 248, 1, 1),
  );
  const rootElement =
    process.env.HASH_TYPE === 'mimc'
      ? new Element(root, 'field', 256, 1)
      : new Element(root, 'field', 128, 2);
  // compute the proof
  logger.debug('Computing witness...');

  const allInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
    new Element(erc20AddressPadded, 'field', 248, 1),
    new Element(payTo, 'field'),
    new Element(amount, 'field', 128, 1),
    new Element(receiverZkpPrivateKey, 'field'),
    new Element(salt, 'field'),
    ...siblingPathElements.slice(1),
    new Element(commitmentIndex, 'field', 128, 1), // the binary decomposition of a leafIndex gives its path's 'left-right' positions up the tree. The decomposition is done inside the circuit.,
    new Element(nullifier, 'field'),
    rootElement,
  ]);

  logger.debug(
    'To debug witness computation, use ./zok to run up a zokrates container then paste these arguments into the terminal:',
  );
  logger.debug(`./zokrates compute-witness -a ${allInputs.join(' ')} -i gm17/ft-burn/out`);

  await zokrates.computeWitness(
    codePath,
    outputDirectory,
    `${commitment}-${witnessName}`,
    allInputs,
  );

  logger.debug('Computing proof...');

  await zokrates.generateProof(
    pkPath,
    codePath,
    `${outputDirectory}/${commitment}-witness`,
    provingScheme,
    {
      createFile: createProofJson,
      directory: outputDirectory,
      fileName: `${commitment}-${proofName}`,
    },
  );

  let { proof } = JSON.parse(fs.readFileSync(`${outputDirectory}/${commitment}-${proofName}`));

  proof = Object.values(proof);
  // convert to flattened array:
  proof = utils.flattenDeep(proof);
  // convert to decimal, as the solidity functions expect uints
  proof = proof.map(el => utils.hexToDec(el));

  logger.debug('Burning within the Shield contract');

  const publicInputs = utils.formatInputsForZkSnark([
    new Element(publicInputHash, 'field', 248, 1),
  ]);

  logger.debug('proof:');
  logger.debug(proof);
  logger.debug('publicInputs:');
  logger.debug(publicInputs);

  // Burn the commitment and return tokens to the payTo account.
  let txReceipt;
  if (signingMethod) {
    fTokenShieldInstance = await getWeb3ContractInstance('FTokenShield', fTokenShieldAddress);
    const encodedRawTransaction = fTokenShieldInstance.methods
      .burn(erc20AddressPadded, proof, publicInputs, root, nullifier, amount, payTo)
      .encodeABI();
    const signedTransaction = await signingMethod(
      encodedRawTransaction,
      fTokenShieldInstance._address,
    );
    txReceipt = await sendSignedTransaction(signedTransaction);
  } else {
    txReceipt = await fTokenShieldInstance.burn(
      erc20AddressPadded,
      proof,
      publicInputs,
      root,
      nullifier,
      amount,
      payTo,
      {
        from: account,
        gas: 6500000,
        gasPrice: config.GASPRICE,
      },
    );
    utils.gasUsedStats(txReceipt, 'burn');
    const newRoot = await fTokenShieldInstance.latestRoot();
    logger.debug(`Merkle Root after burn: ${newRoot}`);
  }

  if (fs.existsSync(`${outputDirectory}/${commitment}-${proofName}`))
    fs.unlinkSync(`${outputDirectory}/${commitment}-${proofName}`);

  if (fs.existsSync(`${outputDirectory}/${commitment}-witness`))
    fs.unlinkSync(`${outputDirectory}/${commitment}-witness`);

  logger.debug(`Deleted File ${outputDirectory}/${commitment}-${proofName} \n`);

  logger.debug('BURN COMPLETE\n');

  return { z_C: commitment, z_C_index: commitmentIndex, txReceipt };
}

module.exports = {
  mint,
  transfer,
  burn,
};
