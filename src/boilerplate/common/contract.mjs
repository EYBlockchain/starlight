import fs from 'fs';
import config from 'config';
import GN from 'general-number';
import utils from 'zkp-utils';
import Web3 from './web3.mjs';
import logger from './logger.mjs';
import { generateProof } from './zokrates.mjs';


const web3 = Web3.connection();
const { generalise } = GN;
const db = '/app/orchestration/common/db/preimage.json';
const keyDb = '/app/orchestration/common/db/key.json';

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
  let errorCount = 0;

  if (!deployedAddress) {
    while (errorCount < 25) {
      try {
        const contractInterface = await getContractInterface(contractName);
        const networkId = await web3.eth.net.getId();
        logger.silly('networkId:', networkId);

        if (
          contractInterface &&
          contractInterface.networks &&
          contractInterface.networks[networkId]
        ) {
          deployedAddress = contractInterface.networks[networkId].address;
        }
        if (deployedAddress === undefined) throw new Error('Shield address was undefined');
        if (deployedAddress) break;
      } catch (err) {
        errorCount++;
        logger.warn('Unable to get a contract address - will try again in 5 seconds');
        await new Promise(resolve => setTimeout(() => resolve(), 5000));
      }
    }
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
  logger.info(`${contractName} Address: ${deployedAddress}`);

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

export async function registerKey(
  _secretKey,
  contractName,
  registerWithContract,
) {
  const secretKey = generalise(_secretKey);
  const publicKey = generalise(utils.shaHash(secretKey.hex(32)));
  if (registerWithContract) {
    const instance = await getContractInstance(contractName);
    await instance.methods.registerZKPPublicKey(publicKey.integer).send({
      from: config.web3.options.defaultAccount,
      gas: config.web3.options.defaultGas,
    });
  }
  const keyJson = {
    secretKey: secretKey.integer,
    publicKey: publicKey.integer, // not req
  };
  fs.writeFileSync(keyDb, JSON.stringify(keyJson, null, 4));

  return publicKey;
}

export function getInputCommitments(publicKey, value, commitments) {
  const possibleCommitments = Object.entries(commitments).filter(
    entry => entry[1].publicKey === publicKey && !entry[1].isNullified,
  );
  possibleCommitments.sort(
    (preimageA, preimageB) =>
      parseInt(preimageB[1].value, 10) - parseInt(preimageA[1].value, 10),
  );
  var commitmentsSum = 0;
	for (var i = 0; i < possibleCommitments.length; i++) {
	  for (var j = 0 ;  j < possibleCommitments.length; j++){
		 if(possibleCommitments[i][j] && possibleCommitments[i][j].value)
		 commitmentsSum = commitmentsSum + parseInt(possibleCommitments[i][j].value, 10);
	  }
	}
  if (
    parseInt(possibleCommitments[0][1].value, 10) +
      parseInt(possibleCommitments[1][1].value, 10) >=
    parseInt(value, 10)
  ) {
    return [true, possibleCommitments[0][0], possibleCommitments[1][0]];
  }
  else if(commitmentsSum >= parseInt(value, 10))
	 return  [false, possibleCommitments[0][0], possibleCommitments[1][0]];
  return null;
}
  export async function joinCommitments(contractName, statename, secretKey, publicKey, stateVarId, commitments, commitmentsID, witnesses, instance){

  logger.warn('Existing Commitments are not appropriate and we need to call Join Commitment Circuit. It will generate proof to join commitments, this will require an on-chain verification');
  const oldCommitment_0 = commitmentsID[0];

	const oldCommitment_1 = commitmentsID[1];

	const oldCommitment_0_prevSalt = generalise(commitments[oldCommitment_0].salt);
	const oldCommitment_1_prevSalt = generalise(commitments[oldCommitment_1].salt);
	const oldCommitment_0_prev = generalise(commitments[oldCommitment_0].value);
	const oldCommitment_1_prev = generalise(commitments[oldCommitment_1].value);

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
   if(stateVarId.length > 1){
       oldCommitment_stateVarId =  generalise(
         utils.mimcHash(
           [
             generalise(stateVarId[0]).bigInt,
             generalise(stateVarId[1]).bigInt,
           ],
           "ALT_BN_254"
         )
       ).hex(32);
     }



	let oldCommitment_0_nullifier = generalise(
		utils.shaHash(oldCommitment_stateVarId, secretKey.hex(32), oldCommitment_0_prevSalt.hex(32))
	);
	let oldCommitment_1_nullifier = generalise(
		utils.shaHash(oldCommitment_stateVarId, secretKey.hex(32), oldCommitment_1_prevSalt.hex(32))
	);
	oldCommitment_0_nullifier = generalise(oldCommitment_0_nullifier.hex(32, 31)); // truncate
	oldCommitment_1_nullifier = generalise(oldCommitment_1_nullifier.hex(32, 31)); // truncate

	// Calculate commitment(s):

	const newCommitment_newSalt = generalise(utils.randomHex(32));

	let newCommitment_value =
		parseInt(oldCommitment_0_prev.integer, 10) +
		parseInt(oldCommitment_1_prev.integer, 10);

	newCommitment_value = generalise(newCommitment_value);

	let newCommitment = generalise(
		utils.shaHash(
			oldCommitment_stateVarId,
			newCommitment_value.hex(32),
			publicKey.hex(32),
			newCommitment_newSalt.hex(32)
		)
	);

	newCommitment = generalise(newCommitment.hex(32, 31)); // truncate

  let stateVarID = parseInt(oldCommitment_stateVarId,16);
  let  fromID = 0;
  let isMapping=0;
  if(stateVarId.length > 1 ){
    stateVarID  = stateVarId[0];
    fromID = stateVarId[1].integer;;
     isMapping = 1;
  }


// Call Zokrates to generate the proof:
const allInputs = [
fromID,
stateVarID,
isMapping,
secretKey.limbs(32, 8),
secretKey.limbs(32, 8),
oldCommitment_0_nullifier.integer,
oldCommitment_1_nullifier.integer,
oldCommitment_0_prev.integer,
oldCommitment_0_prevSalt.limbs(32, 8),
oldCommitment_1_prev.integer,
oldCommitment_1_prevSalt.limbs(32, 8),
oldCommitment_root.integer,
oldCommitment_0_index.integer,
oldCommitment_0_path.integer,
oldCommitment_1_index.integer,
oldCommitment_1_path.integer,
publicKey.limbs(32, 8),
newCommitment_newSalt.limbs(32, 8),
newCommitment.integer,
].flat(Infinity);


const res = await generateProof( "joinCommitments", allInputs);
const proof = generalise(Object.values(res.proof).flat(Infinity))
.map((coeff) => coeff.integer)
.flat(Infinity);

// Send transaction to the blockchain:

const tx = await instance.methods
.joinCommitments(
  [oldCommitment_0_nullifier.integer, oldCommitment_1_nullifier.integer,],
  oldCommitment_root.integer,
  [newCommitment.integer],
  proof
)
.send({
  from: config.web3.options.defaultAccount,
  gas: config.web3.options.defaultGas,
});

      let preimage = {};
      if (fs.existsSync(db)) {
        preimage = JSON.parse(
          fs.readFileSync(db, "utf-8", (err) => {
            console.log(err);
          })
        );
      }

      Object.keys(preimage).forEach((key) => {
    		if (key === statename) {

    			preimage[key][oldCommitment_0].isNullified = true;
    			preimage[key][oldCommitment_1].isNullified = true;
    			preimage[key][newCommitment.hex(32)] = {
    				value: newCommitment_value.integer,
    				salt: newCommitment_newSalt.integer,
    				publicKey: publicKey.integer,
    				commitment: newCommitment.integer,
    			}
    		}

    			else	if (key === statename.split('[')[0]){
    					Object.keys(preimage[key]).forEach((id) => {
    						if(parseInt(id,10) === parseInt(fromID,10)){
    							preimage[key][id][oldCommitment_0].isNullified = true;
    							preimage[key][id][oldCommitment_1].isNullified = true;
    							preimage[key][id][newCommitment.hex(32)] = {
    								value: newCommitment_value.integer,
    								salt: newCommitment_newSalt.integer,
    								publicKey: publicKey.integer,
    								commitment: newCommitment.integer,
    						}
    					}
    					})
    				}
    			fs.writeFileSync(db, JSON.stringify(preimage, null, 4));
       });

  return { tx };
}
