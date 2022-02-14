/* eslint-disable no-param-reassign, no-shadow, no-unused-vars, no-continue */

import buildBoilerplate from './boilerplate-generator.mjs';

/**
 * @desc:
 * Generates boilerplate for orchestration files
 * Handles logic for ordering and naming inside a function.mjs file
 */

export const sendTransactionBoilerplate = node => {
  const { privateStates } = node;
  const output = [];
  output[0] = [];
  output[1] = [];
  output[2] = [];
  output[3] = [];
  // output[0] = arr of nullifiers
  // output[1] = root(s)
  // output[2] = arr of commitments
  // output[3] = arr of nullifiers to check, not add (for accessed states)
  for (const [privateStateName, stateNode] of Object.entries(privateStates)) {
    switch (stateNode.isPartitioned) {
      case true:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            output[1].push(`${privateStateName}_root.integer`);
            output[0].push(
              `${privateStateName}_0_nullifier.integer, ${privateStateName}_1_nullifier.integer`,
            );
            output[2].push(`${privateStateName}_2_newCommitment.integer`);
            break;
          case false:
          default:
            // increment
            output[2].push(`${privateStateName}_newCommitment.integer`);
            break;
        }
        break;
      case false:
      default:
        // whole
        if (stateNode.accessedOnly) {
          output[3].push(`${privateStateName}_nullifier.integer`);
        } else {
          if (!stateNode.reinitialisedOnly) {
            output[1].push(`${privateStateName}_root.integer`);
            output[0].push(`${privateStateName}_nullifier.integer`);
          }
          if (!stateNode.burnedOnly)
            output[2].push(`${privateStateName}_newCommitment.integer`);
        }

        break;
    }
  }
  return output;
};

export const generateProofBoilerplate = node => {
  const output = [];
  const privateStateNames = Object.keys(node.privateStates);
  for (const [stateName, stateNode] of Object.entries(node.privateStates)) {
    const parameters = [];
    // we include the state variable key (mapping key) if its not a param (we include params separately)
    const stateVarIdLines =
      stateNode.isMapping && !node.parameters.includes(stateNode.stateVarId[1])
        ? [`\n\t\t\t\t\t\t\t\t${stateName}_stateVarId_key.integer,`]
        : [];
    // we add any extra params the circuit needs
    node.parameters
      .filter(
        para =>
          !privateStateNames.includes(para) &&
          !output.join().includes(`${para}.integer`),
      )
      .forEach(param => {
        parameters.push(`\t${param}.integer,`);
      });
    // then we build boilerplate code per state
    switch (stateNode.isWhole) {
      case true:
        output.push(
          buildBoilerplate('GenerateProof', {
            stateName,
            stateType: 'whole',
            reinitialisedOnly: stateNode.reinitialisedOnly,
            burnedOnly: stateNode.burnedOnly,
            accessedOnly: stateNode.accessedOnly,
            parameters,
            stateVarIds: stateVarIdLines,
          }),
        );
        break;
      case false:
      default:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            stateNode.increment.forEach(inc => {
              // +inc.name tries to convert into a number -  we don't want to add constants here
              if (
                !output.join().includes(`\t${inc.name}.integer`) &&
                !parameters.includes(`\t${inc.name}.integer,`) &&
                !privateStateNames.includes(inc.name) &&
                !+inc.name
              )
                output.push(`\n\t\t\t\t\t\t\t\t${inc.name}.integer`);
            });
            output.push(
              buildBoilerplate('GenerateProof', {
                stateName,
                stateType: 'decrement',
                parameters,
                stateVarIds: stateVarIdLines,
              }),
            );
            break;
          case false:
          default:
            // increment
            stateNode.increment.forEach(inc => {
              if (
                !output.join().includes(`\t${inc.name}.integer`) &&
                !parameters.includes(`\t${inc.name}.integer,`) &&
                !+inc.name
              )
                output.push(`\n\t\t\t\t\t\t\t\t${inc.name}.integer`);
            });
            output.push(
              buildBoilerplate('GenerateProof', {
                stateName,
                stateType: 'increment',
                parameters,
                stateVarIds: stateVarIdLines,
              }),
            );
            break;
        }
    }
  }
  output.push(`\n].flat(Infinity);`);
  return output;
};

export const preimageBoilerPlate = node => {
  const output = [];
  for (const [privateStateName, stateNode] of Object.entries(
    node.privateStates,
  )) {
    const stateVarIds = [];
    const initialiseParams = [];
    const preimageParams = [];

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
        privateStateName.includes(stateNode.stateVarId[1]) &&
        stateNode.stateVarId[1] !== 'msg'
      ) {
        stateVarIds.push(
          `\nconst ${privateStateName}_stateVarId_key = ${stateNode.stateVarId[1]};`,
        );
      }
      // ... and the mapping key is msg, and the caller of the fn has the msg key
      if (
        stateNode.stateVarId[1] === 'msg' &&
        privateStateName.includes('msg')
      ) {
        // TODO make sure this line goes before _newOwnerPublicKey in every case
        stateVarIds.push(
          `\nconst ${privateStateName}_stateVarId_key = ${privateStateName}_newOwnerPublicKey;`,
        );
      }
      stateVarIds.push(
        `\n${privateStateName}_stateVarId = generalise(utils.mimcHash([generalise(${privateStateName}_stateVarId).bigInt, ${privateStateName}_stateVarId_key.bigInt], 'ALT_BN_254')).hex(32);`,
      );
    }

    if (stateNode.accessedOnly) {
      output.push(
        buildBoilerplate('ReadPreimage', {
          stateType: 'whole',
          stateName: privateStateName,
          accessedOnly: true,
          stateVarIds,
        }),
      );
      continue;
    }

    initialiseParams.push(`\nlet ${privateStateName}_prev = generalise(0);`);
    preimageParams.push(`\t${privateStateName}: 0,`);

    // ownership (PK in commitment)
    const newOwner = stateNode.isOwned ? stateNode.owner : null;
    let newOwnerStatment;
    switch (newOwner) {
      case null:
        newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? publicKey : ${privateStateName}_newOwnerPublicKey;`;
        break;
      case 'msg':
        if (privateStateName.includes('msg')) {
          newOwnerStatment = `publicKey;`;
        } else if (stateNode.mappingOwnershipType === 'key') {
          // the stateVarId[1] is the mapping key
          newOwnerStatment = `${stateNode.stateVarId[1]};`; // above logic ensures this is a zkpKey
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
        } else if (stateNode.ownerIsParam) {
          newOwnerStatment = `_${privateStateName}_newOwnerPublicKey === 0 ? ${newOwner} : ${privateStateName}_newOwnerPublicKey;`;
        }
        break;
    }

    switch (stateNode.isWhole) {
      case true:
        output.push(
          buildBoilerplate('ReadPreimage', {
            stateType: 'whole',
            stateName: privateStateName,
            reinitialisedOnly: stateNode.reinitialisedOnly,
            increment: stateNode.increment,
            newOwnerStatment,
            stateVarIds,
          }),
        );
        break;
      case false:
      default:
        switch (stateNode.nullifierRequired) {
          case true:
            // decrement
            output.push(
              buildBoilerplate('ReadPreimage', {
                stateType: 'decrement',
                stateName: privateStateName,
                increment: stateNode.increment,
                mappingKey: stateNode.mappingKey
                  ? `[${privateStateName}_stateVarId_key.integer]`
                  : ``,
                mappingName: stateNode.mappingName || privateStateName,
                newOwnerStatment,
                stateVarIds,
              }),
            );
            break;
          case false:
          default:
            // increment
            output.push(
              buildBoilerplate('ReadPreimage', {
                stateType: 'increment',
                stateName: privateStateName,
                increment: stateNode.increment,
                newOwnerStatment,
                stateVarIds,
              }),
            );
        }
    }
  }
  return output;
};

/**
 * Parses the boilerplate import statements, and grabs any common statements.
 * @param {Object} options - must always include stage, for some cases includes other info
 * @return {Object} - common statements
 */

export const OrchestrationCodeBoilerPlate = node => {
  const lines = [];
  const params = [];
  const states = [];
  const rtnparams = [];
  switch (node.nodeType) {
    case 'Imports':
      return { statements: buildBoilerplate(node.nodeType) };

    case 'FunctionDefinition':
      // the main function
      lines.push(
        `\n\n// Initialisation of variables:
        \nconst instance = await getContractInstance('${node.contractName}');`,
      );
      if (node.msgSenderParam)
        lines.push(`
              \nconst msgSender = generalise(config.web3.options.defaultAccount);`);
      node.inputParameters.forEach(param => {
        lines.push(`\nconst ${param} = generalise(_${param});`);
        params.push(`_${param}`);
      });

      node.parameters.modifiedStateVariables.forEach(param => {
        states.push(`_${param.name}_newOwnerPublicKey = 0`);
        lines.push(
          `\nlet ${param.name}_newOwnerPublicKey = generalise(_${param.name}_newOwnerPublicKey);`,
        );
      });

      if (node.decrementsSecretState) {
        node.decrementedSecretStates.forEach(decrementedState => {
          states.push(` _${decrementedState}_0_oldCommitment = 0`);
          states.push(` _${decrementedState}_1_oldCommitment = 0`);
        });
      }
      node.returnParameters.forEach(param =>
        rtnparams.push(`, ${param.integer}`),
      );
      if (params) params[params.length - 1] += `,`;

      return {
        signature: [
          `\nexport default async function ${node.name}(${params} ${states}) {`,
          `\nreturn { tx ${rtnparams.join('')}};
        \n}`,
        ],
        statements: lines,
      };

    case 'InitialisePreimage':
      for (const [stateName, stateNode] of Object.entries(node.privateStates)) {
        let mappingKey;
        switch (stateNode.mappingKey) {
          case 'msg':
            // msg.sender => key is _newOwnerPublicKey
            mappingKey = `[${stateName}_newOwnerPublicKey.integer]`;
            break;
          case null:
            // not a mapping => no key
            mappingKey = ``;
            break;
          default:
            // any other => a param or accessed var
            mappingKey = `[${stateNode.mappingKey}.integer]`;
        }
        lines.push(
          buildBoilerplate(node.nodeType, {
            stateName,
            accessedOnly: stateNode.accessedOnly,
            mappingKey,
            mappingName: stateNode.mappingName || stateName,
          }),
        );
      }
      return {
        statements: lines,
      };

    case 'InitialiseKeys':
      states[0] = node.onChainKeyRegistry ? `true` : `false`;
      return {
        statements: [
          `${buildBoilerplate(node.nodeType, {
            contractName: node.contractName,
            onChainKeyRegistry: states[0],
          })}`,
        ],
      };

    case 'ReadPreimage':
      lines[0] = preimageBoilerPlate(node);
      for (const [stateName, stateNode] of Object.entries(node.privateStates)) {
        if (stateNode.accessedOnly) {
          params.push(
            `\nconst ${stateName} = generalise(${stateName}_preimage.${stateName});`,
          );
        } else if (stateNode.isWhole)
          params.push(`\n${stateName} = generalise(${stateName});`);
      }
      return {
        statements: [`${params.join('\n')}`, lines[0].join('\n')],
      };

    case 'WritePreimage':
      for (const [stateName, stateNode] of Object.entries(node.privateStates)) {
        // TODO commitments with more than one value inside
        switch (stateNode.isPartitioned) {
          case true:
            switch (stateNode.nullifierRequired) {
              case true:
                lines.push(
                  buildBoilerplate(node.nodeType, {
                    stateName,
                    stateType: 'decrement',
                    mappingKey: stateNode.mappingKey
                      ? `[${stateName}_stateVarId_key.integer]`
                      : ``,
                    mappingName: stateNode.mappingName || stateName,
                  }),
                );
                break;
              case false:
              default:
                if (stateNode.mappingKey) {
                  lines.push(`
                  \nif (!preimage.${stateNode.mappingName}) preimage.${stateNode.mappingName} = {};
                  \nif (!preimage.${stateNode.mappingName}[${stateName}_stateVarId_key.integer]) preimage.${stateNode.mappingName}[${stateName}_stateVarId_key.integer] = {};`);
                } else {
                  lines.push(`
                  \nif (!preimage.${stateName}) preimage.${stateName} = {};`);
                }

                lines.push(
                  buildBoilerplate(node.nodeType, {
                    stateName,
                    stateType: 'increment',
                    mappingKey: stateNode.mappingKey
                      ? `[${stateName}_stateVarId_key.integer]`
                      : ``,
                    mappingName: stateNode.mappingName || stateName,
                  }),
                );
                break;
            }
            break;
          case false:
          default:
            lines.push(
              buildBoilerplate(node.nodeType, {
                stateName,
                stateType: 'whole',
                burnedOnly: stateNode.burnedOnly,
                mappingKey: stateNode.mappingKey
                  ? `[${stateName}_stateVarId_key.integer]`
                  : ``,
                mappingName: stateNode.mappingName || stateName,
              }),
            );
        }
      }
      return {
        statements: [
          `\n// Write new commitment preimage to db: \n
          \nlet preimage = {};`,
          `\nif (fs.existsSync(db)) {
            preimage = JSON.parse(
                fs.readFileSync(db, 'utf-8', err => {
                  console.log(err);
                }),
              );
            }`,
          lines.join('\n'),
          `\nfs.writeFileSync(db, JSON.stringify(preimage, null, 4));`,
        ],
      };

    case 'MembershipWitness':
      for (const [stateName, stateNode] of Object.entries(node.privateStates)) {
        if (stateNode.isPartitioned) {
          lines.push(
            buildBoilerplate(node.nodeType, {
              stateName,
              contractName: node.contractName,
              stateType: 'partitioned',
            }),
          );
        }
        if (stateNode.accessedOnly) {
          lines.push(
            buildBoilerplate(node.nodeType, {
              stateName,
              contractName: node.contractName,
              stateType: 'accessedOnly',
            }),
          );
        } else if (stateNode.isWhole) {
          lines.push(
            buildBoilerplate(node.nodeType, {
              stateName,
              contractName: node.contractName,
              stateType: 'whole',
            }),
          );
        }
      }
      return {
        statements: [`\n// Extract set membership witness: \n\n`, ...lines],
      };

    case 'CalculateNullifier':
      for (const [stateName, stateNode] of Object.entries(node.privateStates)) {
        if (stateNode.isPartitioned) {
          lines.push(
            buildBoilerplate(node.nodeType, {
              stateName,
              stateType: 'partitioned',
            }),
          );
        } else {
          lines.push(
            buildBoilerplate(node.nodeType, {
              stateName,
              stateType: 'whole',
            }),
          );
        }
      }
      return {
        statements: [`\n// Calculate nullifier(s): \n`, ...lines],
      };

    case 'CalculateCommitment':
      for (const [stateName, stateNode] of Object.entries(node.privateStates)) {
        switch (stateNode.isPartitioned) {
          case undefined:
          case false:
            lines.push(
              buildBoilerplate(node.nodeType, {
                stateName,
                stateType: 'whole',
              }),
            );
            break;
          case true:
          default:
            switch (stateNode.nullifierRequired) {
              case true:
                // decrement
                lines.push(
                  buildBoilerplate(node.nodeType, {
                    stateName,
                    stateType: 'decrement',
                  }),
                );
                break;
              case false:
              default:
                // increment
                lines.push(
                  buildBoilerplate(node.nodeType, {
                    stateName,
                    stateType: 'increment',
                  }),
                );
            }
        }
      }
      return {
        statements: [`\n\n// Calculate commitment(s): \n`, ...lines],
      };

    case 'GenerateProof':
      return {
        statements: [
          `\n\n// Call Zokrates to generate the proof:
          \nconst allInputs = [`,
          generateProofBoilerplate(node),
          `\nconst res = await generateProof('${node.circuitName}', allInputs);`,
          `\nconst proof = generalise(Object.values(res.proof).flat(Infinity))
          .map(coeff => coeff.integer)
          .flat(Infinity);`,
        ],
      };

    case 'SendTransaction':
      if (node.publicInputs[0]) {
        node.publicInputs.forEach(input => {
          lines.push(`${input}.integer`);
        });
        lines[lines.length - 1] += `, `;
      }
      params[0] = sendTransactionBoilerplate(node);
      // params[0] = arr of nullifiers
      // params[1] = root(s)
      // params[2] = arr of commitments
      if (params[0][1][0]) params[0][1] = `${params[0][1]},`; // root - single input
      if (params[0][0][0]) params[0][0] = `[${params[0][0]}],`; // nullifiers - array
      if (params[0][2][0]) params[0][2] = `[${params[0][2]}],`; // commitments - array
      if (params[0][3][0]) params[0][3] = `[${params[0][3]}],`; // accessed nullifiers - array
      return {
        statements: [
          `\n\n// Send transaction to the blockchain:
          \nconst tx = await instance.methods
          .${node.functionName}(${lines}${params[0][0]} ${params[0][1]} ${params[0][2]} ${params[0][3]} proof)
          .send({
              from: config.web3.options.defaultAccount,
              gas: config.web3.options.defaultGas,
            });\n`,
        ],
      };
    default:
      return {};
  }
};

export default OrchestrationCodeBoilerPlate;
