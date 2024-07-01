/* eslint-disable import/no-cycle, no-param-reassign */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import { collectImportFiles, localFile } from '../../common.js'
import OrchestrationBP from '../../../boilerplate/orchestration/javascript/raw/boilerplate-generator.js';
import codeGenerator from '../nodejs/toOrchestration.js';
import logger from '../../../utils/logger.js';


/**
 * Parses the boilerplate import statements, and grabs any common files.
 * @return - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
 const Orchestrationbp = new OrchestrationBP();
const editableCommitmentCommonFilesBoilerplate = () => {
  const importBoilerplate = Orchestrationbp.generateProof.import();
  if (!(importBoilerplate instanceof Array)) return;
  return collectImportFiles(importBoilerplate.join(''), 'orchestration');
};

/**
 * @param type - a solidity type
 * @returns - a suitable function input of that type
 */

const apiServiceInputs = [];

const testInputsByType = (solidityType: any) => {
  switch (solidityType.name) {
    case 'bool':
      return `true`;
    case 'uint':
    case 'uint256':
      return Math.floor(Math.random() * Math.floor(200) + 1); // random number between 1 and 200
    case 'address':
      return `config.web3.options.defaultAccount`;
    // return `'this-is-an-address'`;
    case 'key':
      // return `'this-is-a-zkp-key'`;
      return `0`;
    case 'commitment':
      return `0`;
    //  return `'this-is-an-old-commitment'`;
    default:
      if (solidityType.isStruct) {
        return `{ ${solidityType.properties.map(p => `${p.name}:${testInputsByType({name: p.type})}`)}}`
      }
      return 0;
  }
};

/**
 * @param node - an IntegrationTestBoilerplate node
 * @returns string - a custom integration test file to write
 */

const prepareIntegrationTest = (node: any) => {
  // import generic test skeleton
  const genericTestFile: any = Orchestrationbp.integrationTestBoilerplate;
  // replace references to contract and functions with ours
  let outputTestFile = genericTestFile.preStatements().replace(
    /CONTRACT_NAME/g,
    node.contractName,
  );

  const relevantFunctions = node.functions.filter((fn: any) => fn.name !== 'cnstrctr');

  relevantFunctions.forEach((fn: any) => {
    let fnboilerplate = genericTestFile.postStatements()
      .replace(/CONTRACT_NAME/g, node.contractName)
      .replace(/FUNCTION_NAME/g, fn.name);
    // we remove the second call to the blockchain if we are decrementing
    // the user may not have enough commitments to do so
    let removeSecondCall = false;
    let removeMerkleTreeTest = false;
    const paramTypes = fn.parameters.parameters.map((obj: any) => obj.typeName);
    if (fn.decrementsSecretState) {
      removeSecondCall = true;
    }
    if (!fn.newCommitmentsRequired) {
      removeMerkleTreeTest = true;
    }
    // replace the signature with test inputs
    fnboilerplate = fnboilerplate.replace(
      /FUNCTION_SIG_1/g,
      paramTypes.map(testInputsByType).join(', '),
    );
    fnboilerplate = fnboilerplate.replace(
      /FUNCTION_SIG_2/g,
      paramTypes.map(testInputsByType).join(', '),
    );
    // remove second call
    if (removeSecondCall) {
      // regex: matches everything after `describe('Second Call'`
      const toRemove = fnboilerplate.match(
        /describe\('Second Call'?[\s\S]*/g,
      )[0];
      fnboilerplate = fnboilerplate.replace(toRemove, `\n});`);
    }

    // test encryption
    if (fn.encryptionRequired) {
      const indexToInsert = fnboilerplate.split(`it('should update`);
      fnboilerplate = indexToInsert[0] + '\n' + genericTestFile.encryption() + '\n' + `it('should update`+ indexToInsert[1];
    }

    // remove merkle tree test
    if (removeMerkleTreeTest) {
      // regex: matches everything between 'it('should update the merkle tree'' and the first '});'
      const toRemove = fnboilerplate.match(
        /it\('should update the merkle tree'?[\s\S]*?}\);/g,
      )[0];
      fnboilerplate = fnboilerplate.replace(toRemove, `\n`);
    }
    // replace function imports at top of file
    const fnimport = genericTestFile.import().replace(
      /FUNCTION_NAME/g,
      fn.name,
    );
    // for each function, add the new imports and boilerplate to existing test
    outputTestFile = `${fnimport}\n${outputTestFile}\n${fnboilerplate}`;
  });
  // add linting and config
  const preprefix = `/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */ \nimport config from 'config';\nimport assert from 'assert';\n`;
  outputTestFile = `${preprefix}\n${outputTestFile}\n });\n`;
  return outputTestFile;
};

const prepareIntegrationApiServices = (node: any) => {
  // import generic test skeletonfr
  const genericApiServiceFile: any = Orchestrationbp.integrationApiServicesBoilerplate;
  // replace references to contract and functions with ours
  let outputApiServiceFile = genericApiServiceFile.preStatements().replace(
    /CONTRACT_NAME/g,
    node.contractName,
  );
  const relevantFunctions = node.functions.filter((fn: any) => fn.name !== 'cnstrctr');

  relevantFunctions.forEach((fn: any) => {
  let fnboilerplate = genericApiServiceFile.postStatements()
    .replace(/CONTRACT_NAME/g, node.contractName)
    .replace(/FUNCTION_NAME/g, fn.name)
    .replace(/CONSTRUCTOR_INPUTS/g, node.functionNames.includes('cnstrctr') ? `await addConstructorNullifiers();` : ``);
  let fnParam: string[] = [];
  let structparams;
    const paramName = fn.parameters.parameters.map((obj: any) => obj.name);
    fn.parameters.parameters.forEach(p => {
      if (p.typeName.isStruct) {
        structparams = `{ ${p.typeName.properties.map(prop => `${prop.name}: req.body.${p.name}.${prop.name}`)}}`;
        fnParam.push( `const ${p.name} = ${structparams} ;\n`);
      } else {
        fnParam.push( `const { ${p.name} } = req.body;\n`);
      }
    });

    fn.parameters.modifiedStateVariables.forEach(m => {
      fnParam.push(`const ${m.name}_newOwnerPublicKey = req.body.${m.name}_newOwnerPublicKey || 0;\n`);
      paramName.push(`${m.name}_newOwnerPublicKey`);
    });

    // remove any duplicates from fnction parameters
    fnParam = [...new Set(fnParam)];
    // Adding Return parameters
    let returnParams: string[] = [];
      let returnParamsName = fn.returnParameters.parameters.filter((paramnode: any) => (paramnode.isSecret || paramnode.typeName.name === 'bool')).map(paramnode => (paramnode.name)) || []; // Adapt
      if(returnParamsName.length > 0){
      returnParamsName.forEach(param => {
        if(param !== 'true') 
         returnParams.push(param+'_newCommitmentValue');
         else 
         returnParams.push('bool');
      });
    }
   
    // replace the signature with test inputs
    fnboilerplate = fnboilerplate.replace(/const FUNCTION_SIG/g, fnParam);
    fnboilerplate = fnboilerplate.replace(/,const/g, `const`);
    fnboilerplate = fnboilerplate.replace(
      /FUNCTION_SIG/g,
      paramName,
    );

    fnboilerplate = fnboilerplate.replace(/_RESPONSE_/g, returnParams);

    // replace function imports at top of file
    const fnimport = genericApiServiceFile.import().replace(
      /FUNCTION_NAME/g,
      fn.name,
    );
    // for each function, add the new imports and boilerplate to existing test
    outputApiServiceFile = `${fnimport}\n${outputApiServiceFile}\n${fnboilerplate}`;

  });
  // add linting and config
  const preprefix = `/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */ \nimport config from 'config';\nimport assert from 'assert';\n`;
  outputApiServiceFile = `${preprefix}\n${outputApiServiceFile}\n ${genericApiServiceFile.commitments()}\n`; 
  return outputApiServiceFile;
};
const prepareIntegrationApiRoutes = (node: any) => {
  // import generic test skeleton
  let outputApiRoutesFile =``;
  let fnimport =``;
  let outputApiRoutesimport=``;
  let outputApiRoutesboilerplate =``;
  const genericApiRoutesFile: any = Orchestrationbp.integrationApiRoutesBoilerplate;

  // replace references to contract and functions with ours
  const relevantFunctions = node.functions.filter((fn: any) => fn.name !== 'cnstrctr');

  relevantFunctions.forEach((fn: any) => {
    let fnboilerplate = genericApiRoutesFile.postStatements()
      .replace(/FUNCTION_NAME/g, fn.name);

    // replace function imports at top of file
     fnimport = genericApiRoutesFile.import().replace(
      /FUNCTION_NAME/g,
      fn.name,
    );

    // for each function, add the new imports and boilerplate to existing test
    outputApiRoutesimport = `${outputApiRoutesimport}\n${fnimport}\n`;
    outputApiRoutesboilerplate = `${outputApiRoutesboilerplate}\n${fnboilerplate}\n`
  });
  // add getters for commitments
  outputApiRoutesimport = `${outputApiRoutesimport}\n${genericApiRoutesFile.commitmentImports()}\n`;
  outputApiRoutesboilerplate = `${outputApiRoutesboilerplate}\n${genericApiRoutesFile.commitmentRoutes()}\n`
  const fnprestatement = genericApiRoutesFile.preStatements();
  const postfix = `export default router;`;
  outputApiRoutesFile = `${outputApiRoutesimport}\n${fnprestatement}\n${outputApiRoutesboilerplate}\n ${postfix}`;
  // add linting and config
  return outputApiRoutesFile;
};

const prepareIntegrationEncryptedListener = ( node: any) => {
let readPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../src/boilerplate/common/encrypted-data-listener.mjs')
const file = { filepath: 'orchestration/common/encrypted-data-listener.mjs', file: fs.readFileSync(readPath, 'utf8') };  
file.file = file.file.replace(/CONTRACT_NAME/g, node.contractName);
let encryptedCode = '';
let encryptedStateVarId = '';
let encryptedValue = ''
node.stateVariables?.forEach(
  variable => {
    variable.isMapping ?  encryptedStateVarId = `const ${variable.name}_stateVarId = generalise(utils.mimcHash([generalise(${variable.id}).bigInt, self.ethAddress.bigInt], 'ALT_BN_254')).hex(32);`
  : `const ${variable.name}_stateVarId = ${variable.id}`;
    variable.isStruct ?  variable.structProperty.forEach( (structProp, index) => {
       encryptedValue += `
       const ${structProp} = generalise(decrypted[${index+1}]);`
    }) : encryptedValue += ` const value =  generalise(decrypted[1]); `;
    if(variable.isStruct) {
    encryptedCode += `
    const newCommitment = poseidonHash([
      BigInt(stateVarId.hex(32)),
      ${variable.structProperty.map(structProp => `BigInt(${structProp}.hex(32))`).join(', \n')},
      BigInt(self.publicKey.hex(32)),
      BigInt(salt.hex(32))
    ]);

    if (stateVarId.integer === ${variable.name}_stateVarId.integer) {
      try {
        await storeCommitment({
          hash: newCommitment,
          name: '${variable.name}',
          source: 'encrypted data',
          mappingKey: stateVarId.integer,
          preimage: {
            stateVarId,
            value: {
              ${variable.structProperty.map((structProp, index) => `${structProp}`).join(', ')}
            },
            salt,
            publicKey: self.publicKey,
          },
          secretKey: self.secretKey,
          isNullified: false,
        });
        console.log('Added commitment', newCommitment.hex(32));
      } catch (e) {
        if (e.toString().includes('E11000 duplicate key')) {
          console.log(
            'encrypted-data-listener -',
            'receiving EncryptedData event with balances.',
            'This ${variable.name} already exists. Ignore it.',
          );
        }
      }
    }`;
      
    } else {
      encryptedCode += `

      const newCommitment = poseidonHash([
        BigInt(stateVarId.hex(32)),
        BigInt(value.hex(32)),
        BigInt(self.publicKey.hex(32)),
        BigInt(salt.hex(32))
      ]);
  
    if (stateVarId.integer === ${variable.name}_stateVarId.integer) {
      try {
        await storeCommitment({
          hash: newCommitment,
          name: '${variable.name}',
          source: 'encrypted data',
          mappingKey: stateVarId.integer,
          preimage: {
            stateVarId,
            value,
            salt,
            publicKey: self.publicKey,
          },
          secretKey: self.secretKey,
          isNullified: false,
        });
        console.log('Added commitment', newCommitment.hex(32));
      } catch (e) {
        if (e.toString().includes('E11000 duplicate key')) {
          console.log(
            'encrypted-data-listener -',
            'receiving EncryptedData event with balances.',
            'This ${variable.name} already exists. Ignore it.',
          );
        }
      }
    }
` ;

    }
   
  }
)
encryptedCode = encryptedStateVarId + encryptedValue + encryptedCode;
file.file = file.file.replace(/ENCRYPTEDVARIABLE_CODE/g, encryptedCode);
return file.file;
} 

/**
 * @param file - a generic migrations file skeleton to mutate
 * @param contextDirPath - a SetupCommonFilesBoilerplate node
 */

const prepareMigrationsFile = (file: localFile, node: any) => {
  // insert filepath and replace with our contract and function names
  file.filepath = `./migrations/2_shield.js`;
  file.file = file.file.replace(/CONTRACT_NAME/g, node.contractName);
  file.file = file.file.replace(
    /FUNCTION_NAMES/g,
    `'${node.functionNames.join(`', '`)}'`,
  );
  // collect any extra constructor parameters
  const constructorParams = node.constructorParams?.filter((obj: any) => !obj.isSecret).map((obj: any) => obj.name) || ``;
  const iwsConstructorParams = node.constructorParams?.filter((param: any) => param.interactsWithSecret === true);
  // initialise variables
  let customImports = ``;
  let customDeployments = ``;
  let constructorParamsIncludesAddr = false;
  let customProofImport = ``;
  let customProofInputs = ``;
  const constructorAddrParams: string[] = [];
  // we check weter we must pass in an address to the constructor
  node.constructorParams?.forEach((arg: any) => {
    if (arg.typeName.name === 'address') {
      constructorParamsIncludesAddr = true;
      constructorAddrParams.push(arg.name);
    }
  });
  // we collect any imported contracts which must be migrated
  if (node.contractImports && constructorParamsIncludesAddr) {
    node.contractImports.forEach((importObj: any) => {
      // read each imported contract
      if(!fs.existsSync(`./contracts/${importObj.absolutePath}`)){
        logger.warn(`Please Make Sure you Deploy all the imports before testing the zApp.`);
        return;
      } 
      const importedContract = fs.readFileSync(
        `./contracts/${importObj.absolutePath}`,
        'utf8',
      );
     
      let importedContractName = path.basename(
        importObj.absolutePath,
        path.extname(importObj.absolutePath),
      );
      // if import is an interface, we need to deploy contract e.g. IERC20 -> deploy ERC20
      if (
        importedContractName.startsWith(`I`) &&
        importedContract.replace(/{.*$/, '').includes('interface')
      ) {
        // if we import an interface, we must find the original contract
        // we assume that any interface begins with I (substring(1)) and the remaining chars are the original contract name
        const newPath = importObj.absolutePath.replace(
          importedContractName,
          importedContractName.substring(1),
        );
        importedContractName = importedContractName.substring(1);
        const check = fs.existsSync(`./contracts/${newPath}`);
        if (check) {
          // if we can find the imported contract, we add it to migrations
          customImports += `const ${importedContractName} = artifacts.require("${importedContractName}"); \n`;
          if (
            importedContractName === 'ERC20' ||
            importedContractName === 'ERC721' || importedContractName === 'ERC1155'
          ) {
            // HACK ERC contracts are commonly used, so we support them in migrations
            logger.warn(
              `It looks like you're using an ERC contract - please make sure you increase the allowance of the shield contract before testing!`,
            );
            switch (importedContractName) {
              case 'ERC20': customDeployments += `await deployer.deploy(${importedContractName}, 'MyCoin', 'MC'); \n`;
              break;
              case 'ERC721':
                customDeployments += `await deployer.deploy(${importedContractName}); \n`;
                break;
              case 'ERC1155':
                customDeployments += `await deployer.deploy(${importedContractName}, https://Mytokens.example/api/item/{id}.json); \n`;
                break; 
            }
          } else {
            customDeployments += `await deployer.deploy(${importedContractName}); \n`;
          }
        }
        // for each address in the shield contract constructor...
        constructorAddrParams.forEach(name => {
          if (
            name
              .toLowerCase()
              .includes(importedContractName.substring(1).toLowerCase()) ||
            importedContractName
              .substring(1)
              .toLowerCase()
              .includes(name.toLowerCase())
          ) {
            // if that address is of the current importedContractName, we add it to the migration arguments
            const index = constructorParams.indexOf(name);
            constructorParams[index] = `${importedContractName}.address`;
          }
        });
      }
    });
  } else if(constructorParamsIncludesAddr) {
    // for each address in the shield contract constructor...
    constructorAddrParams.forEach(name => {
      // we have an address input which is likely not a another contract
      // we just replace it with the default address
      customImports += `const ${name} = process.env.DEFAULT_ACCOUNT; \n`;
      logger.warn(
        `Looks like you are using a constructor with a public address ${name}. This will be set to the default account address.
        If you'd like to change it, edit the variable in migrations/2_shield.js in the output zApp.`
      );
    });
  }
  if (node.functionNames.includes('cnstrctr')) {
    // we have a constructor which requires a proof
    customProofImport += `const constructorInput = JSON.parse(
      fs.readFileSync('/app/orchestration/common/db/constructorTx.json', 'utf-8'),
    );

    \nconst { proofInput } = constructorInput;`;
    iwsConstructorParams?.forEach((param: any) => {
      customProofImport += `\nconst { ${param.name} } = constructorInput;`
    });
    customProofInputs += `, ...proofInput`
  }
  // we need to add a comma if we have 1+ constructor param
  if (constructorParams?.length >= 1) constructorParams[constructorParams.length - 1] += `,`;
  // finally, import all above findings to the migrationsfile
  file.file = file.file.replace(/CUSTOM_CONTRACT_IMPORT/g, customImports);
  file.file = file.file.replace(/CUSTOM_CONTRACTS/g, customDeployments);
  file.file = file.file.replace(/CUSTOM_INPUTS/g, constructorParams);
  file.file = file.file.replace(/CUSTOM_PROOF_IMPORT/g, customProofImport);
  file.file = file.file.replace(/CUSTOM_PROOF/g, customProofInputs);
};

/**
 * @param file - a generic migrations file skeleton to mutate
 * @param node - a SetupCommonFilesBoilerplate node
 */

const prepareStartupScript = (file: localFile, node: any) => {
  let constructorCall = ``;
  if (!node.functionNames.includes('cnstrctr')) {
    file.file = file.file.replace(/CONSTRUCTOR_CALL/g, ``);
    return;
  } else if (!node.constructorParams[0]) {
    constructorCall += `docker-compose -f docker-compose.zapp.yml run zapp node -e 'import("/app/orchestration/cnstrctr.mjs").then(file => file.default())'`
    file.file = file.file.replace(/CONSTRUCTOR_CALL/g, constructorCall);
    return;
  }
  constructorCall += `read -p "Please enter your constructor parameters separated by commas:" inputs

  docker-compose -f docker-compose.zapp.yml run --rm zapp node --experimental-repl-await -e "import('/app/orchestration/cnstrctr.mjs').then(async file => await Promise.resolve(file.default(\${inputs})))"`

  file.file = file.file.replace(/CONSTRUCTOR_CALL/g, constructorCall);
}

const prepareBackupDataRetriever = (node: any) => {
  // import generic test skeleton
  let genericApiServiceFile: any = `/* eslint-disable prettier/prettier, camelcase, prefer-const, no-unused-vars */
  import config from "config";
  import utils from "zkp-utils";
  import GN from "general-number";
  import fs from "fs";
  import mongo from './common/mongo.mjs';
  
  import {
    storeCommitment,
    markNullified,
  } from "./common/commitment-storage.mjs";
  
  import {
    getContractInstance,
    getContractAddress,
  } from "./common/contract.mjs";
  
  import Web3 from "./common/web3.mjs";
  import {
    decompressStarlightKey,
    compressStarlightKey,
    encrypt,
    decrypt,
    poseidonHash,
    scalarMult,
  } from "./common/number-theory.mjs";
  
  const { generalise } = GN;
  const web3 = Web3.connection();
  const keyDb = "/app/orchestration/common/db/key.json";
  const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;

  
  export async function backupDataRetriever() {

    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(COMMITMENTS_DB);

    try {
      // Get the list of all collections in the database
      const collections = await db.listCollections().toArray();

      // Drop each collection
      for (let collection of collections) {
        await db.collection(collection.name).drop();
      }
      console.log("Database emptied");
    } catch (err) {
      console.error("Error emptying database:", err);
    }
  
    const instance = await getContractInstance("CONTRACT_NAME");
  
    const contractAddr = await getContractAddress("CONTRACT_NAME");
  
    const backDataEvent =   await instance.getPastEvents('EncryptedBackupData',{fromBlock: 0, toBlock: 'latest'} );
  
    const keys = JSON.parse(
      fs.readFileSync(keyDb, "utf-8", (err) => {
        console.log(err);
      })
    );
    const secretKey = generalise(keys.secretKey);
    const publicKey = generalise(keys.publicKey);
    let storedCommitments = [];
    for (const log of backDataEvent) {
      for (let i = 0; i < log.returnValues.encPreimages.length; i++) {
        let cipherText = log.returnValues.encPreimages[i].cipherText;
        let ephPublicKey = log.returnValues.encPreimages[i].ephPublicKey;
        let varName = log.returnValues.encPreimages[i].varName;
        let name = varName.replace(" a", "").replace(" s", "").replace(" u", "");
        let isArray = false;
        let isStruct = false;
        if (varName.includes(" a")) {
          isArray = true;
        } else if (varName.includes(" s")) {
          isStruct = true;
        }
        const plainText = decrypt(
          cipherText,
          secretKey.hex(32),
          [
            decompressStarlightKey(generalise(ephPublicKey))[0].hex(32),
            decompressStarlightKey(generalise(ephPublicKey))[1].hex(32),
          ]
        );	
        let mappingKey = null;
        let stateVarId;
        let value;
        console.log("Decrypted pre-image of commitment for variable name: " + name + ": ");
        let salt = generalise(plainText[0]);
        console.log(\`\\tSalt: \${salt.integer}\`);
        if (isArray){
          console.log(\`\\tState variable StateVarId: \${plainText[2]}\`);
          mappingKey = generalise(plainText[1]);
          console.log(\`\\tMapping Key: \${mappingKey.integer}\`);
          let reGenStateVarId = generalise(
            utils.mimcHash(
              [
                generalise(plainText[2]).bigInt,
                generalise(plainText[1]).bigInt,
              ],
              "ALT_BN_254"
            )
          );
          stateVarId = reGenStateVarId;
          console.log(\`Regenerated StateVarId: \${reGenStateVarId.bigInt}\`);
          value = generalise(plainText[3]);
          console.log(\`\\tValue: \${value.integer}\`);
        } else {
          stateVarId = generalise(plainText[1]);
          console.log(\`\\tStateVarId: \${plainText[1]}\`);
          if (isStruct){
            value = {};`;

            node.privateStates.forEach((stateVar: any) => {
              if (stateVar.structProperties){
                let propCount = 2;
                genericApiServiceFile += `\nif (stateVarId.integer === '${stateVar.stateVarId}') {`
                stateVar.structProperties.forEach((prop: any) => {
                  genericApiServiceFile += `value.${prop} = plainText[${propCount}];\n`;
                  propCount++;
                });
                genericApiServiceFile += `}\n`;
              }
            });
        
            genericApiServiceFile += `console.log(\`\\tValue: \${value}\`);
          } else {
            value = generalise(plainText[2]);
            console.log(\`\\tValue: \${value.integer}\`);
          }
        }
        let newCommitment;
        if (isStruct){
          let hashInput = [BigInt(stateVarId.hex(32))];
          for (let i = 2; i < plainText.length; i++) {
            hashInput.push(BigInt(generalise(plainText[i]).hex(32)));
          }
          hashInput.push(BigInt(publicKey.hex(32)));
          hashInput.push(BigInt(salt.hex(32)));
          newCommitment = generalise(poseidonHash(hashInput));
        } else {
          newCommitment = generalise(poseidonHash([
            BigInt(stateVarId.hex(32)),
            BigInt(value.hex(32)),
            BigInt(publicKey.hex(32)),
            BigInt(salt.hex(32)),
          ]));
        }
        if (!varName.includes(" u")){
          let oldCommitments = storedCommitments.filter(
            (element) =>
              element.stateVarId.integer === stateVarId.integer &&
              (!mappingKey || element.mappingKey === mappingKey?.integer)
            );
          for (const oldCommitment of oldCommitments){
            await markNullified(oldCommitment.hash, secretKey.hex(32));
            let index = storedCommitments.findIndex(element => element === oldCommitment);
            if (index !== -1) {
            storedCommitments.splice(index, 1);
            }
          }
        }
        await storeCommitment({
          hash: newCommitment,
          name: name,
          mappingKey: mappingKey?.integer,
          preimage: {
            stateVarId: stateVarId,
            value: value,
            salt: salt,
            publicKey: publicKey,
          },
          secretKey: secretKey,
          isNullified: false,
        });
        storedCommitments.push({stateVarId: stateVarId, hash: newCommitment, mappingKey: mappingKey?.integer});
      }
    };
  }`;
  
  // replace references to contract and functions with ours
  let outputApiServiceFile = genericApiServiceFile.replace(
    /CONTRACT_NAME/g,
    node.contractName,
  );
  return outputApiServiceFile;
};

/**
 * @param {string} file - a stringified file
 * @param {string} contextDirPath - the import statements of the `file` will be
 * relative to this dir. This path itself is relative to process.cwd().
 * @returns {Object} - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */

export default function fileGenerator(node: any) {
  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'Folder':
      return OrchestrationBP.uniqueify(node.files
        .filter((x: any) => x.nodeType !== 'NonSecretFunction')
        .flatMap(fileGenerator));

    case 'File':
      return [
        {
          filepath: path.join(
            `./orchestration`,
            `${node.fileName}${node.fileExtension}`,
          ),
          file: node.nodes.map(codeGenerator).join(''),
        },
      ];
      // case 'ImportStatementList':
      //   return `${OrchestrationBP.uniqueify(node.imports.flatMap(codeGenerator)).join('\n')}`;
    case 'EditableCommitmentCommonFilesBoilerplate': {
      // collects imported files needed for editing commitments
      // direct imports at the top of each fn file
      const check = editableCommitmentCommonFilesBoilerplate();
      return check;
    }

    case 'SetupCommonFilesBoilerplate': {
      // complex setup files which require some setting up:
      const files = collectImportFiles(
        [
          `import './common/write-vk.mjs'`,
          `import './common/zkp-setup.mjs'`,
          `import './common/migrations/2_shield.js'`,
        ].join('\n'),
        'orchestration',
      );

      let readPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../src/boilerplate/common/bin/setup');
      const setupScript = { filepath: 'bin/setup', file: fs.readFileSync(readPath, 'utf8') };
      files.push(setupScript);
      readPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../src/boilerplate/common/bin/startup');
      const startupScript = { filepath: 'bin/startup', file: fs.readFileSync(readPath, 'utf8') };
      files.push(startupScript);
      readPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../src/boilerplate/common/bin/startup-double');
      const startupScriptDouble = { filepath: 'bin/startup-double', file: fs.readFileSync(readPath, 'utf8') };
      files.push(startupScriptDouble);
      const vkfile = files.filter(obj => obj.filepath.includes(`write-vk`))[0];
      const setupfile = files.filter(obj =>
        obj.filepath.includes(`zkp-setup`),
      )[0];
      const migrationsfile = files.filter(obj =>
        obj.filepath.includes(`shield`),
      )[0];

      if (node.functionNames.includes('cnstrctr')) {
        const redeployPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../src/boilerplate/common/bin/redeploy');
        const redeployFile = { filepath: 'bin/redeploy', file: fs.readFileSync(redeployPath, 'utf8') };
        prepareStartupScript(redeployFile, node);
        files.push(redeployFile);
      }
      // replace placeholder values with ours
      vkfile.file = vkfile.file.replace(
        /FUNCTION_NAMES/g,
        `'${node.functionNames.join(`', '`)}'`,
      );
      setupfile.file = setupfile.file.replace(
        /FUNCTION_NAMES/g,
        `'${node.functionNames.join(`', '`)}'`,
      );
      // build the migrations file
      prepareMigrationsFile(migrationsfile, node);
      prepareStartupScript(startupScript, node);
      prepareStartupScript(startupScriptDouble, node);
      return files;
    }

    case 'IntegrationTestBoilerplate': {
      const test = prepareIntegrationTest(node);
      return test;
    }
    case 'IntegrationApiServicesBoilerplate': {
      const api_services = prepareIntegrationApiServices(node);
      return api_services;
    }
    case 'IntegrationApiRoutesBoilerplate': {
      const api_routes = prepareIntegrationApiRoutes(node);
      return api_routes;
    }
    case 'BackupDataRetrieverBoilerplate': {
      const backupDataRetriever = prepareBackupDataRetriever(node);
      return backupDataRetriever;
    }
    case 'IntegrationEncryptedListenerBoilerplate': {
       const  encryptedListener = prepareIntegrationEncryptedListener(node); 
      return encryptedListener;
    }
    default:
      throw new TypeError(`I dont recognise this type: ${node.nodeType}`);
  }
}
