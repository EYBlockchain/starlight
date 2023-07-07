/* eslint-disable no-param-reassign, no-shadow, no-unused-vars, no-continue */

import OrchestrationBP from './boilerplate-generator.js';


const stateVariableIds = (node: any) => {
  const {privateStateName, stateNode} = node;
  const stateVarIds: string[] = [];
  // state variable ids
  // if not a mapping, use singular unique id (if mapping, stateVarId is an array)
  if (!stateNode.stateVarId[1]) {
    stateVarIds.push(
      `\nconst ${privateStateName}_stateVarId = generalise(${stateNode.stateVarId}).hex(32);`,
    );
  } else {
    // if is a mapping...
    stateVarIds.push(
      `\nlet ${privateStateName}_stateVarId = ${stateNode.stateVarId[0]};`,
    );
    // ... and the mapping key is not msg.sender, but is a parameter
    if (
      privateStateName.includes(stateNode.stateVarId[1].replaceAll('.', 'dot')) &&
      stateNode.stateVarId[1] !== 'msg'
    ) {
      if (+stateNode.stateVarId[1] || stateNode.stateVarId[1] === '0') {
        stateVarIds.push(
          `\nconst ${privateStateName}_stateVarId_key = generalise(${stateNode.stateVarId[1]});`,
        );
      } else {
        stateVarIds.push(
          `\nconst ${privateStateName}_stateVarId_key = ${stateNode.stateVarId[1]};`,
        );
      }
    }
    // ... and the mapping key is msg, and the caller of the fn has the msg key
    if (
      stateNode.stateVarId[1] === 'msg' &&
      privateStateName.includes('msg')
    ) {
      stateVarIds.push(
        `\nconst ${privateStateName}_stateVarId_key = generalise(config.web3.options.defaultAccount); // emulates msg.sender`,
      );
    }
    stateVarIds.push(
      `\n${privateStateName}_stateVarId = generalise(utils.mimcHash([generalise(${privateStateName}_stateVarId).bigInt, ${privateStateName}_stateVarId_key.bigInt], 'ALT_BN_254')).hex(32);`,
    );
  }
  return stateVarIds;
}

/**
 * @desc:
 * Generates boilerplate for orchestration files
 * Handles logic for ordering and naming inside a function.mjs file
 */
const Orchestrationbp = new OrchestrationBP();
export const sendTransactionBoilerplate = (node: any) => {
  const { privateStates } = node;
  const output: string[][] = [[],[],[],[],[],[]];
  // output[0] = nullifier root(s)
  // output[1] = arr of nullifiers
  // output[2] = commitments root(s)
  // output[3] = arr of commitments
  // output[4] = arr of cipherText
  // output[5] = arr of enc keys
  let privateStateName: string;
  let stateNode: any;
  for ([privateStateName, stateNode] of Object.entries(privateStates)) {
    switch (stateNode.isPartitioned) {
      case true:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            output[2].push(`${privateStateName}_root.integer`);
            output[0].push(`${privateStateName}_nullifierRoot.integer`, `${privateStateName}_newNullifierRoot.integer`);
            output[1].push(
              `${privateStateName}_0_nullifier.integer, ${privateStateName}_1_nullifier.integer`,
            );
            output[3].push(`${privateStateName}_2_newCommitment.integer`);
            break;
          case false:
          default:
            // increment
            output[3].push(`${privateStateName}_newCommitment.integer`);
            if (stateNode.encryptionRequired) {
              output[4].push(`${privateStateName}_cipherText`);
              output[5].push(`${privateStateName}_encKey`);
            }
            break;
        }
        break;
      case false:
      default:
        // whole
        if (!stateNode.reinitialisedOnly)
          output[2].push(`${privateStateName}_root.integer`);
          if (!stateNode.accessedOnly && !stateNode.reinitialisedOnly) {
            output[1].push(`${privateStateName}_nullifier.integer`);
            output[0].push(`${privateStateName}_nullifierRoot.integer`,`${privateStateName}_newNullifierRoot.integer`);
          }
          if (!stateNode.accessedOnly && !stateNode.burnedOnly)
            output[3].push(`${privateStateName}_newCommitment.integer`);
          if (stateNode.encryptionRequired) {
            output[4].push(`${privateStateName}_cipherText`);
            output[5].push(`${privateStateName}_encKey`);
          }

        break;
    }
  }
  return output;
};

export const generateProofBoilerplate = (node: any) => {
  const output: (string[] | string)[] = [];
  const enc: any[][] = [];
  const cipherTextLength: number[] = [];
  let containsRoot = false;
  let containsNullifierRoot = false;
  const privateStateNames = Object.keys(node.privateStates);
  let stateName: string;
  let stateNode: any;
  for ([stateName, stateNode] of Object.entries(node.privateStates)) {
    // we prepare the return cipherText and encKey when required
    if (stateNode.encryptionRequired) {
      stateNode.structProperties ? cipherTextLength.push(stateNode.structProperties.length + 2) : cipherTextLength.push(3);
      enc[0] ??= [];
      enc[0].push(`const ${stateName}_cipherText = res.inputs.slice(START_SLICE, END_SLICE).map(e => generalise(e).integer);`);
      enc[1] ??= [];
      enc[1].push(`const ${stateName}_encKey = res.inputs.slice(START_SLICE END_SLICE).map(e => generalise(e).integer);`);
    }
    const parameters: string[] = [];
    // we include the state variable key (mapping key) if its not a param (we include params separately)
    const msgSenderParamAndMappingKey = stateNode.isMapping && (node.parameters.includes('msgSender') || output.join().includes('_msg_stateVarId_key.integer')) && stateNode.stateVarId[1] === 'msg';
    const msgValueParamAndMappingKey = stateNode.isMapping && (node.parameters.includes('msgValue') || output.join().includes('_msg_stateVarId_key.integer')) && stateNode.stateVarId[1] === 'msg';

    const constantMappingKey = stateNode.isMapping && (+stateNode.stateVarId[1] || stateNode.stateVarId[1] === '0');
    const stateVarIdLines =
      stateNode.isMapping && !node.parameters.includes(stateNode.stateVarId[1]) && !msgSenderParamAndMappingKey && !msgValueParamAndMappingKey && !constantMappingKey
        ? [`\n\t\t\t\t\t\t\t\t${stateName}_stateVarId_key.integer,`]
        : [];
    // we add any extra params the circuit needs
    node.parameters
      .filter(
        (para: string) =>
          !privateStateNames.includes(para) && (
          !output.join().includes(`${para}.integer`) && !output.join().includes('msgValue')),
      )
      ?.forEach((param: string) => {
        if (param == 'msgSender') {
          parameters.unshift(`\t${param}.integer,`);
        } 
        else if (param == 'msgValue') {
          parameters.unshift(`\t${param},`);
        }
        else {
          parameters.push(`\t${param}.integer,`);
        }

      });
    // then we build boilerplate code per state
    switch (stateNode.isWhole) {
      case true:
        output.push(
          Orchestrationbp.generateProof.parameters({
            stateName,
            stateType: 'whole',
            stateVarIds: stateVarIdLines,
            structProperties: stateNode.structProperties,
            reinitialisedOnly: stateNode.reinitialisedOnly,
            burnedOnly: stateNode.burnedOnly,
            accessedOnly: stateNode.accessedOnly,
            nullifierRootRequired: !containsNullifierRoot,
            initialisationRequired: stateNode.initialisationRequired,
            encryptionRequired: stateNode.encryptionRequired,
            rootRequired: !containsRoot,
            parameters,
          })
        );
        if(stateNode.nullifierRequired) containsNullifierRoot = true;
        if (!stateNode.reinitialisedOnly) containsRoot = true;
        break;

      case false:
      default:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            if (stateNode.structProperties) stateNode.increment = Object.values(stateNode.increment).flat(Infinity);
            stateNode.increment.forEach((inc: any) => {
              // +inc.name tries to convert into a number -  we don't want to add constants here
              if (
                !output.join().includes(`\t${inc.name}.integer`) &&
                !parameters.includes(`\t${inc.name}.integer,`) &&
                !privateStateNames.includes(inc.name) && !inc.accessed &&
                !+inc.name
              )
                output.push(`\n\t\t\t\t\t\t\t\t${inc.name}.integer`);
            });
            output.push(
              Orchestrationbp.generateProof.parameters({
                stateName,
                stateType: 'decrement',
                stateVarIds: stateVarIdLines,
                structProperties: stateNode.structProperties,
                reinitialisedOnly: false,
                burnedOnly: false,
                nullifierRootRequired: !containsNullifierRoot,
                initialisationRequired: false,
                encryptionRequired: stateNode.encryptionRequired,
                rootRequired: !containsRoot,
                accessedOnly: false,
                parameters,
              })
            );
            containsNullifierRoot = true;
            containsRoot = true;
            break;
          case false:
          default:
            // increment
            if (stateNode.structProperties) stateNode.increment = Object.values(stateNode.increment).flat(Infinity);
            stateNode.increment.forEach((inc: any) => {
              if (
                !output.join().includes(`\t${inc.name}.integer`) &&
                !parameters.includes(`\t${inc.name}.integer,`) && !inc.accessed &&
                !+inc.name
              )
                output.push(`\n\t\t\t\t\t\t\t\t${inc.name}.integer`);
            });
            output.push(
              Orchestrationbp.generateProof.parameters( {
                stateName,
                stateType: 'increment',
                stateVarIds: stateVarIdLines,
                structProperties: stateNode.structProperties,
                reinitialisedOnly: false,
                burnedOnly: false,
                nullifierRootRequired: false,
                initialisationRequired: false,
                encryptionRequired: stateNode.encryptionRequired,
                rootRequired: false,
                accessedOnly: false,
                parameters,
              })
            );
            break;
        }
    }
  }
  // we now want to go backwards and calculate where our cipherText is
  let start = 0;
  for (let i = cipherTextLength.length -1; i >= 0; i--) {
    // extract enc key
    enc[1][i] = start === 0 ? enc[1][i].replace('END_SLICE', '') : enc[1][i].replace('END_SLICE', ', ' + start);
    enc[1][i] = enc[1][i].replace('START_SLICE', start - 2);
    // extract cipherText
    enc[0][i] = enc[0][i].replace('END_SLICE', start - 2);
    start -= cipherTextLength[i] + 2;
    enc[0][i] = enc[0][i].replace('START_SLICE', start);
  }
  
   // extract the nullifier Root

  output.push(`\n].flat(Infinity);`);
  return [output, [enc]];
};

export const preimageBoilerPlate = (node: any) => {
  const output: string[][] = [];
  let privateStateName: string;
  let stateNode: any;
  for ([privateStateName, stateNode] of Object.entries(node.privateStates)) {
    const stateVarIds = stateVariableIds({ privateStateName, stateNode });
    const initialiseParams: string[] = [];
    const preimageParams:string[] = [];
    if (stateNode.accessedOnly) {
      output.push(
        Orchestrationbp.readPreimage.postStatements({
          stateName:privateStateName,
          contractName: node.contractName,
          stateType: 'whole',
          mappingName: null,
          mappingKey: null,
          increment: false,
          newOwnerStatment: null,
          reinitialisedOnly: false,
          initialised: stateNode.initialised,
          structProperties: stateNode.structProperties,
          accessedOnly: true,
          stateVarIds,
        }));

      continue;
    }

    initialiseParams.push(`\nlet ${privateStateName}_prev = generalise(0);`);
    preimageParams.push(`\t${privateStateName}: 0,`);

    // ownership (PK in commitment)
    const newOwner = stateNode.isOwned ? stateNode.owner : null;
    let newOwnerStatment: string;
    switch (newOwner) {
      case null:
        newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? publicKey : ${privateStateName}_newOwnerPublicKey;`;
        break;
      case 'msg':
        if (privateStateName.includes('msg')) {
          newOwnerStatment = `publicKey;`;
        } else if (stateNode.mappingOwnershipType === 'key') {
          // the stateVarId[1] is the mapping key
          newOwnerStatment = `generalise(await instance.methods.zkpPublicKeys(${stateNode.stateVarId[1]}.hex(20)).call()); // address should be registered`;
        } else if (stateNode.mappingOwnershipType === 'value') {
          // TODO test below
          // if the private state is an address (as here) its still in eth form - we need to convert
          newOwnerStatment = `await instance.methods.zkpPublicKeys(${privateStateName}.hex(20)).call();
          \nif (${privateStateName}_newOwnerPublicKey === 0) {
            console.log('WARNING: Public key for given eth address not found - reverting to your public key');
            ${privateStateName}_newOwnerPublicKey = publicKey;
          }
          \n${privateStateName}_newOwnerPublicKey = generalise(${privateStateName}_newOwnerPublicKey);`;
        } else {
          newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? publicKey : ${privateStateName}_newOwnerPublicKey;`;
        }
        break;
      default:
        // TODO - this is the case where the owner is an admin (state var)
        // we have to let the user submit the key and check it in the contract
        if (!stateNode.ownerIsSecret && !stateNode.ownerIsParam) {
          newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? generalise(await instance.methods.zkpPublicKeys(await instance.methods.${newOwner}().call()).call()) : ${privateStateName}_newOwnerPublicKey;`;
        } else if (stateNode.ownerIsParam && newOwner) {
          newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? ${newOwner} : ${privateStateName}_newOwnerPublicKey;`;
        } else {
          // is secret - we just use the users to avoid revealing the secret owner
          newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? publicKey : ${privateStateName}_newOwnerPublicKey;`

          // BELOW reveals the secret owner as we check the public key in the contract
          // `_${privateStateName}_newOwnerPublicKey === 0 ? generalise(await instance.methods.zkpPublicKeys(${newOwner}.hex(20)).call()) : ${privateStateName}_newOwnerPublicKey;`
        }
        break;
    }

    switch (stateNode.isWhole) {
      case true:
        output.push(
          Orchestrationbp.readPreimage.postStatements({
            stateName: privateStateName,
            contractName: node.contractName,
            stateType: 'whole',
            mappingName: null,
            mappingKey: null,
            initialised: stateNode.initialised,
            structProperties: stateNode.structProperties,
            reinitialisedOnly: stateNode.reinitialisedOnly,
            increment: stateNode.increment,
            newOwnerStatment,
            accessedOnly: false,
            stateVarIds,
          }));

        break;
      case false:
      default:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            output.push(
              Orchestrationbp.readPreimage.postStatements({
                stateName: privateStateName,
                contractName: node.contractName,
                stateType: 'decrement',
                mappingName: stateNode.mappingName || privateStateName,
                mappingKey: stateNode.mappingKey
                  ? `[${privateStateName}_stateVarId_key.integer]`
                  : ``,
                increment: stateNode.increment,
                structProperties: stateNode.structProperties,
                newOwnerStatment,
                initialised: false,
                reinitialisedOnly: false,
                accessedOnly: false,
                stateVarIds,
              }));

            break;
          case false:
          default:
            // increment
            output.push(
            Orchestrationbp.readPreimage.postStatements({
                stateName: privateStateName,
                contractName: node.contractName,
                stateType: 'increment',
                mappingName: null,
                mappingKey: null,
                increment: stateNode.increment,
                newOwnerStatment,
                structProperties: stateNode.structProperties,
                initialised: false,
                reinitialisedOnly: false,
                accessedOnly: false,
                stateVarIds,
              }));

        }
    }
  }
  return output;
};

/**
 * Parses the boilerplate import statements, and grabs any common statements.
 * @param node - must always include stage, for some cases includes other info
 * @return - common statements
 */

export const OrchestrationCodeBoilerPlate: any = (node: any) => {
  const lines: any[] = [];
  const params:any[] = [];
  const states: string[] = [];
  const rtnparams: string[] = [];
  let stateName: string;
  let stateNode: any;

  switch (node.nodeType) {
    case 'Imports':
      return { statements:  Orchestrationbp.generateProof.import() }

    case 'FunctionDefinition':
      // the main function
      if (node.name !== 'cnstrctr') lines.push(
        `\n\n// Initialisation of variables:
        \nconst instance = await getContractInstance('${node.contractName}');
        \nconst contractAddr = await getContractAddress('${node.contractName}');        `,
      );
      if (node.msgSenderParam)
        lines.push(`
              \nconst msgSender = generalise(config.web3.options.defaultAccount);`);
      if (node.msgValueParam)
        lines.push(`
              \nconst msgValue = 1;`);
              else
              lines.push(`
              \nconst msgValue = 0;`);  
      node.inputParameters.forEach((param: string) => {
        lines.push(`\nconst ${param} = generalise(_${param});`);
        params.push(`_${param}`);
      });

      node.parameters.modifiedStateVariables.forEach((param: any) => {
        states.push(`_${param.name}_newOwnerPublicKey = 0`);
        lines.push(
          `\nlet ${param.name}_newOwnerPublicKey = generalise(_${param.name}_newOwnerPublicKey);`,
        );
      });

      if (node.decrementsSecretState) {
        node.decrementedSecretStates.forEach((decrementedState: string) => {
          states.push(` _${decrementedState}_0_oldCommitment = 0`);
          states.push(` _${decrementedState}_1_oldCommitment = 0`);
        });
      }

      node.returnParameters.forEach( (param, index) => {
       if(param === 'true')
        rtnparams?.push('bool: bool');
       else if(param?.includes('Commitment'))
        rtnparams?.push( ` ${param} : ${param}.integer  `);
       else
        rtnparams.push(`   ${param} :${param}.integer`);
     });
      if (params) params[params.length - 1] += `,`;

      if (node.name === 'cnstrctr')
        return {
          signature: [
            `\nexport default async function ${node.name}(${params} ${states}) {`,
            `\nprocess.exit(0);
          \n}`,
          ],
          statements: lines,
        };
        if(rtnparams.length == 0) {
          return {
            signature: [
              `\nexport default async function ${node.name}(${params} ${states}) {`,
              `\n return  { tx, encEvent };
            \n}`,
            ],
            statements: lines,
          };
        }

      if(rtnparams.includes('bool: bool')) {
        return {
          signature: [
            `\nexport default async function ${node.name}(${params} ${states}) {`,
            `\n const bool = true; \n return  { tx, encEvent,  ${rtnparams} };
          \n}`,
          ],
          statements: lines,
        };
      }

      return {
        signature: [
          `\nexport default async function ${node.name}(${params} ${states}) {`,
          `\nreturn  { tx, encEvent, ${rtnparams} };
        \n}`,
        ],
        statements: lines,
      };

    case 'InitialisePreimage':
      for ([stateName, stateNode] of Object.entries(node.privateStates)) {
        let mappingKey: string;
        switch (stateNode.mappingKey) {
          case 'msg':
            // msg.sender => key is _newOwnerPublicKey
            mappingKey = `[${stateName}_stateVarId_key.integer]`;
            break;
          case null:
          case undefined:
            // not a mapping => no key
            mappingKey = ``;
            break;
          default:
            if (+stateNode.mappingKey || stateNode.mappingKey === '0') {
              // we have a constant number
              mappingKey = `[${stateNode.mappingKey}]`;
            } else {
              // any other => a param or accessed var
              mappingKey = `[${stateNode.mappingKey}.integer]`;
            }
        }
        lines.push(
          Orchestrationbp.initialisePreimage.preStatements( {
            stateName,
            accessedOnly: stateNode.accessedOnly,
            stateVarIds: stateVariableIds({ privateStateName: stateName, stateNode}),
            mappingKey,
            mappingName: stateNode.mappingName || stateName,
            structProperties: stateNode.structProperties
          }));

      }
      return {
        statements: lines,
      };

    case 'InitialiseKeys':
      states[0] = node.onChainKeyRegistry ? `true` : `false`;
      return {
        statements: [
          `${Orchestrationbp.initialiseKeys.postStatements(
           node.contractName,
           states[0],
          ) }`,
        ],
      };

    case 'ReadPreimage':
      lines[0] = preimageBoilerPlate(node);
      return {
        statements: [`${params.join('\n')}`, lines[0].join('\n')],
      };

    case 'WritePreimage':
      for ([stateName, stateNode] of Object.entries(node.privateStates)) {
        // TODO commitments with more than one value inside
        switch (stateNode.isPartitioned) {
          case true:
            switch (stateNode.nullifierRequired) {
              case true:
                lines.push(
                  Orchestrationbp.writePreimage.postStatements({
                    stateName,
                    stateType: 'decrement',
                    mappingName: stateNode.mappingName || stateName,
                    mappingKey: stateNode.mappingKey
                      ? `${stateName}_stateVarId_key.integer`
                      : ``,
                    burnedOnly: false,
                    structProperties: stateNode.structProperties,
                  }));

                break;
              case false:
              default:
                lines.push(
                    Orchestrationbp.writePreimage.postStatements({
                    stateName,
                    stateType: 'increment',
                    mappingName:stateNode.mappingName || stateName,
                    mappingKey: stateNode.mappingKey
                      ? `${stateName}_stateVarId_key.integer`
                      : ``,
                    burnedOnly: false,
                    structProperties: stateNode.structProperties,
                  }));

                break;
            }
            break;
          case false:
          default:
            lines.push(
                Orchestrationbp.writePreimage.postStatements({
                stateName,
                stateType: 'whole',
                mappingName: stateNode.mappingName || stateName,
                mappingKey: stateNode.mappingKey
                  ? `${stateName}_stateVarId_key.integer`
                  : ``,
                burnedOnly: stateNode.burnedOnly,
                structProperties: stateNode.structProperties,
              }));
        }
      }
      if (node.isConstructor) lines.push(`\nfs.writeFileSync("/app/orchestration/common/db/constructorTx.json", JSON.stringify(tx, null, 4));`)
      return {
        statements: [
          `\n// Write new commitment preimage to db: \n`,
          lines.join('\n'),
        ],
      };

    case 'MembershipWitness':
      for ([stateName, stateNode] of Object.entries(node.privateStates)) {
        if (node.isConstructor) {
          lines.push([`
            const ${stateName}_index = generalise(0);
            const ${stateName}_root = generalise(0);
            const ${stateName}_path = generalise(new Array(32).fill(0)).all;\n
            `]);
            continue;
        }
        if (stateNode.isPartitioned) {
          lines.push(
            Orchestrationbp.membershipWitness.postStatements({
              stateName,
              contractName: node.contractName,
              stateType: 'partitioned',
            }));

        }
        if (stateNode.accessedOnly) {
          lines.push(
            Orchestrationbp.membershipWitness.postStatements({
              stateName,
              contractName: node.contractName,
              stateType: 'accessedOnly',
            }));

        } else if (stateNode.isWhole) {
          lines.push(
            Orchestrationbp.membershipWitness.postStatements({
              stateName,
              contractName: node.contractName,
              stateType: 'whole',
            }));

        }
      }
      return {
        statements: [`\n// Extract set membership witness: \n\n`, ...lines],
      };

    case 'CalculateNullifier':
      for ([stateName, stateNode] of Object.entries(node.privateStates)) {
        if (stateNode.isPartitioned) {
          lines.push(
            Orchestrationbp.calculateNullifier.postStatements({
              stateName,
              accessedOnly: stateNode.accessedOnly,
              stateType: 'partitioned',
            }));

        } else {
          lines.push(
            Orchestrationbp.calculateNullifier.postStatements({
              stateName,
              accessedOnly: stateNode.accessedOnly,
              stateType: 'whole',
            }));
        }
      }

      for ([stateName, stateNode] of Object.entries(node.privateStates)) {
        if (stateNode.isPartitioned) {
          lines.push(
            Orchestrationbp.temporaryUpdatedNullifier.postStatements({
              stateName,
              accessedOnly: stateNode.accessedOnly,
              stateType: 'partitioned',
            }));

        } else {
          lines.push(
            Orchestrationbp.temporaryUpdatedNullifier.postStatements({
              stateName,
              accessedOnly: stateNode.accessedOnly,
              stateType: 'whole',
            }));
        }
      }

      for ([stateName, stateNode] of Object.entries(node.privateStates)) {
        if (stateNode.isPartitioned) {
          lines.push(
            Orchestrationbp.calculateUpdateNullifierPath.postStatements({
              stateName,
              accessedOnly: stateNode.accessedOnly,
              stateType: 'partitioned',
            }));

        } else {
          lines.push(
            Orchestrationbp.calculateUpdateNullifierPath.postStatements({
              stateName,
              accessedOnly: stateNode.accessedOnly,
              stateType: 'whole',
            }));
        }
      }

      return {
        statements: [`\n// Calculate nullifier(s): \n`, ...lines],
      };

    case 'CalculateCommitment':
      for ([stateName, stateNode] of Object.entries(node.privateStates)) {
        switch (stateNode.isPartitioned) {
          case undefined:
          case false:
            lines.push(
              Orchestrationbp.calculateCommitment.postStatements( {
                stateName,
                stateType: 'whole',
                structProperties: stateNode.structProperties,
              }));

            break;
          case true:
          default:
            switch (stateNode.nullifierRequired) {
              case true:
                // decrement
                lines.push(
                  Orchestrationbp.calculateCommitment.postStatements( {
                    stateName,
                    stateType: 'decrement',
                    structProperties: stateNode.structProperties,
                  }));

                break;
              case false:
              default:
                // increment
                lines.push(
                  Orchestrationbp.calculateCommitment.postStatements( {
                    stateName,
                    stateType: 'increment',
                    structProperties: stateNode.structProperties,
                  }));

            }
        }
      }
      return {
        statements: [`\n\n// Calculate commitment(s): \n`, ...lines],
      };

    case 'GenerateProof':
      [ lines[0], params[0] ] = generateProofBoilerplate(node);
      return {
        statements: [
          `\n\n// Call Zokrates to generate the proof:
          \nconst allInputs = [`,
          `${lines[0]}`,
          `\nconst res = await generateProof('${node.circuitName}', allInputs);`,
          `\nconst proof = generalise(Object.values(res.proof).flat(Infinity))
          .map(coeff => coeff.integer)
          .flat(Infinity);`,
          `${params[0].flat(Infinity).join('\n')}`
        ],
      };

    case 'SendTransaction':
      if (node.publicInputs[0]) {
        node.publicInputs.forEach((input: any) => {
          if (input.properties) {
            lines.push(`[${input.properties.map(p => `${input.name}${input.isConstantArray ? '.all' : ''}.${p}.integer`).join(',')}]`)
          } else if (input.isConstantArray) {
            lines.push(`${input.name}.all.integer`);
          } else {
            lines.push(`${input}.integer`);
          }           
        });
        lines[lines.length - 1] += `, `;
      }
      params[0] = sendTransactionBoilerplate(node);
      // params[0] = arr of nullifier root(s)
      // params[1] = arr of commitment root(s)
      // params[2] =  arr of nullifiers 
      // params[3] = arr of commitments
      

      if (params[0][0][0]) params[0][0] = `${params[0][0][0]},${params[0][0][1]},`; // nullifierRoot - array 
      if (params[0][2][0]) params[0][2] = `${params[0][2][0]},`; // commitmentRoot - array 
      if (params[0][1][0]) params[0][1] = `[${params[0][1]}],`; // nullifiers - array
      if (params[0][3][0]) params[0][3] = `[${params[0][3]}],`; // commitments - array
      if (params[0][4][0]) params[0][4] = `[${params[0][4]}],`; // cipherText - array of arrays
      if (params[0][5][0]) params[0][5] = `[${params[0][5]}],`; // cipherText - array of arrays


      if (node.functionName === 'cnstrctr') return {
        statements: [
          `\n\n// Save transaction for the constructor:
          \nconst tx = { proofInput: [${params[0][0]}${params[0][1]} ${params[0][2]} ${params[0][3]} proof], ${node.publicInputs?.map(input => `${input}: ${input}.integer,`)}};`
        ]
      }

      return {
        statements: [
          `\n\n// Send transaction to the blockchain:
          \nconst txData = await instance.methods
          .${node.functionName}(${lines}${params[0][0]} ${params[0][1]} ${params[0][2]} ${params[0][3]} ${params[0][4]} ${params[0][5]} proof).encodeABI();
          \n	let txParams = {
            from: config.web3.options.defaultAccount,
            to: contractAddr,
            gas: config.web3.options.defaultGas,
            gasPrice: config.web3.options.defaultGasPrice,
            data: txData,
            chainId: await web3.eth.net.getId(),
            };
            \n 	const key = config.web3.key;
            \n 	const signed = await web3.eth.accounts.signTransaction(txParams, key);
            \n 	const sendTxn = await web3.eth.sendSignedTransaction(signed.rawTransaction);
            \n  let tx = await instance.getPastEvents("NewLeaves");
            \n tx = tx[0];\n
            \n if (!tx) {
              throw new Error( 'Tx failed - the commitment was not accepted on-chain, or the contract is not deployed.');
            } \n
            let encEvent = '';
            \n try {
            \n  encEvent = await instance.getPastEvents("EncryptedData");
            \n } catch (err) {
            \n  console.log('No encrypted event');
            \n}`,

          // .send({
          //     from: config.web3.options.defaultAccount,
          //     gas: config.web3.options.defaultGas,
          //     value: msgValue,
          //   });\n`,
        ],
      };
    default:
      return {};
  }
};

export default OrchestrationCodeBoilerPlate;
