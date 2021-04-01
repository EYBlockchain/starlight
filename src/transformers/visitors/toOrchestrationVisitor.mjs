/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../utils/logger.mjs';
import { traverse } from '../../traverse/traverse.mjs';

/**
 * @desc:
 * Visitor transforms a `.zol` AST into a `.js` AST
 * NB: the resulting `.js` AST is custom, and can only be interpreted by this
 * repo's code generator. JS compilers will not be able to interpret this
 * AST.
 */

export default {
  PragmaDirective: {
    // we ignore the Pragma Directive; it doesn't aid us in creating a circuit
    enter(path, state) {},
    exit(path, state) {},
  },

  ContractDefinition: {
    enter(path, state) {
      const { node, parent } = path;
      node._newASTPointer = parent._newASTPointer;
    },

    exit(path) {},
  },

  ImportDirective: {
    enter(path, state) {
      const { node, parent } = path;
      if (!state.contractImports) state.contractImports = [];
      state.contractImports.push({
        absolutePath: node.absolutePath,
        file: node.file,
      });
      // we assume all import statements come before all functions
    },

    exit(path) {},
  },

  FunctionDefinition: {
    enter(path, state) {
      const { node, parent, scope } = path;

      // Check the function for modifications to any global states:
      // we'll need to create a new circuit file if we find one:
      // TODO: will we also need a new circuit file even if we're merely 'referring to' a secret state (because then a nullifier might be needed?)
      let newFile = false;
      if (scope.modifiesSecretState()) {
        newFile = true;
      } else {
        // Not sure what to do 'else', yet.
        // If there are no global state modifications / 'references', then (currently) a circuit isn't needed for this function. In future, this could be a helper function which supports some other state-editing function, in which case a circuit would be needed.
      }

      if (newFile) {
        // If we've not yet added this function as a node to our newAST, let's do that:
        // Our location in the newAST (parent._newASTPointer) should be Folder.files[].
        // NODEBUILDING
        const contractName = `${parent.name}Shield`;
        const newNode = {
          nodeType: 'File',
          name: node.name, // the name of this function
          fileExtension: '.mjs',
          nodes: [
            {
              nodeType: 'Imports',
            },
            // {
            //   nodeType: 'KeyRegistrationFunction',
            //   onChainKeyRegistry: scope.onChainKeyRegistry, // TODO this is the temp solution to have a mapping with eth addr -> zkp keys on chain (we don't always need it)
            //   contractName: contractName,
            // },
            {
              // insert this FunctionDefinition node into our newly created circuit file.
              nodeType: node.nodeType, // FunctionDefinition
              name: node.name,
              contractName: contractName,
              body: {},
              parameters: {}, // node.parameters.parameters,
              // no returnParameters
            },
          ],
        };
        node._newASTPointer = newNode.nodes[1]; // eslint-disable-line prefer-destructuring
        parent._newASTPointer.push(newNode);
      } else {
        // Not sure what to do if we're not creating a file...
        // NODEBUILDING
        if (node.kind === 'constructor') node.name = node.kind;
        const newNode = {
          nodeType: 'NonSecretFunction',
          name: node.name, // the name of this function
          nodes: [
            {
              // insert this FunctionDefinition node into our newly created circuit file.
              nodeType: node.nodeType, // FunctionDefinition
              name: node.name,
              body: {},
              parameters: {}, // node.parameters.parameters,
              returnParameters: {},
            },
          ],
        };
        node._newASTPointer = newNode.nodes[0]; // eslint-disable-line prefer-destructuring
        parent._newASTPointer.push(newNode);
      }
    },

    exit(path, state) {
      const { node, parent, scope } = path;
      // By this point, we've added a corresponding FunctionDefinition node to the newAST, with the same nodes as the original Solidity function, with some renaming here and there, and stripping out unused data from the oldAST.
      // Now let's add some commitment-related boilerplate!
      if (state.newCommitmentsRequired && scope.modifiesSecretState()) {
        // Add a placeholder for common circuit files within the circuits Folder:
        const files = parent._newASTPointer;
        let EditableCommitmentCommonFilesBoilerplateAlreadyExists = false;
        let ZokratesSetupCommonFilesBoilerplateAlreadyExists = false;
        let IntegrationTestBoilerplateAlreadyExists = false;
        let constructorParams = [];
        for (const file of files) {
          if (file.nodeType === 'EditableCommitmentCommonFilesBoilerplate') {
            EditableCommitmentCommonFilesBoilerplateAlreadyExists = true;
          }
          if (file.nodes && file.nodes[0].nodeType === 'IntegrationTestBoilerplate') {
            IntegrationTestBoilerplateAlreadyExists = true;
          }
          if (file.nodeType === 'ZokratesSetupCommonFilesBoilerplate') {
            ZokratesSetupCommonFilesBoilerplateAlreadyExists = true;
            file.functions.push(node.name);
          }
          if (file.nodeType === 'NonSecretFunction' && file.name === 'constructor') {
            constructorParams = file.nodes[0].parameters.parameters;
          }
        }
        if (!EditableCommitmentCommonFilesBoilerplateAlreadyExists) {
          parent._newASTPointer.push({
            nodeType: 'EditableCommitmentCommonFilesBoilerplate',
          });
        }
        const contractName = `${parent.name}Shield`;

        if (state.snarkVerificationRequired && !ZokratesSetupCommonFilesBoilerplateAlreadyExists) {
          const zokratesSetupCommonFilesBoilerplateNode = {
            nodeType: 'ZokratesSetupCommonFilesBoilerplate',
            functions: [node.name],
            contractName: contractName,
          };
          if (constructorParams) zokratesSetupCommonFilesBoilerplateNode.constructorParams = constructorParams;
          if (state.contractImports) zokratesSetupCommonFilesBoilerplateNode.contractImports = state.contractImports;
          parent._newASTPointer.push(zokratesSetupCommonFilesBoilerplateNode);
        }

        if (state.snarkVerificationRequired && !IntegrationTestBoilerplateAlreadyExists) {
          // NODEBUILDING
          parent._newASTPointer.push({
            nodeType: 'File',
            name: 'test',
            fileExtension: '.mjs',
            nodes: [
              {
                nodeType: 'IntegrationTestBoilerplate',
                contractName: contractName,
                functions: [{ name: node.name, parameters: node._newASTPointer.parameters }],
              },
            ],
          });
        }

        if (state.snarkVerificationRequired && IntegrationTestBoilerplateAlreadyExists) {
          const testNode = parent._newASTPointer.filter(
            thisNode => thisNode.name === 'test' && thisNode.nodes,
          )[0];
          const functionExists = testNode.nodes[0].functions.filter(
            functionTestNode => functionTestNode.name === node.name,
          )[0];
          if (!functionExists) {
            testNode.nodes[0].functions.push({
              name: node.name,
              parameters: node._newASTPointer.parameters,
            });
          }
        }

        // assuming one secret state var per commitment
        const modifiedStateVariableBindings = scope.filterModifiedBindings(
          binding => binding.stateVariable && binding.isSecret,
        );

        node._newASTPointer.parameters.modifiedStateVariables = [];
        for (const [id, refbinding] of Object.entries(
          modifiedStateVariableBindings,
        )) {
          if (refbinding.isMapping) {
            const binding = refbinding;
            const modifiedKeys = Object.keys(scope.indicators[id].mappingKeys);
            for (const [key, mappingBinding] of Object.entries(
              binding.mappingKeys,
            )) {
              if (modifiedKeys.includes(key)) {
                mappingBinding.referencedKeyName = key;
                modifiedStateVariableBindings[`${id}.${key}`] = mappingBinding;
              }
            }
            delete modifiedStateVariableBindings[id];
          }
        }
        for (let [id, binding] of Object.entries(
          modifiedStateVariableBindings,
        )) {
          let indicator = scope.indicators[id];
          let stateVarName = binding.node ? binding.node.name : binding.name;
          if (id.includes('.')) {
            let key;
            [id, key] = id.split('.');
            indicator = scope.indicators[id].mappingKeys[key];
            stateVarName = binding.name.replace('[', '_').replace(']', '');
          }
          node._newASTPointer.parameters.modifiedStateVariables.push({
            nodeType: binding.node
              ? binding.node.nodeType
              : `VariableDeclaration`,
            name: stateVarName,
          });
          let increment;
          if (indicator.isPartitioned) {
            node._newASTPointer.body.statements.forEach(statement => {
              if (
                statement.nodeType === 'ExpressionStatement' &&
                statement.incrementsSecretState &&
                statement.secretStateName === stateVarName
              )
                increment = statement.increment;

              if (statement.decrementsSecretState && statement.secretStateName === stateVarName) {
                node._newASTPointer.decrementsSecretState = true;
                if (!node._newASTPointer.decrementedSecretStates) {
                  node._newASTPointer.decrementedSecretStates = [statement.secretStateName];
                } else if (
                  !node._newASTPointer.decrementedSecretStates.includes(statement.secretStateName)
                ) {
                  node._newASTPointer.decrementedSecretStates.push(statement.secretStateName);
                }

                const testNode = parent._newASTPointer.filter(
                  thisNode => thisNode.name === 'test' && thisNode.nodes,
                )[0];
                const fnTestNode = testNode.nodes[0].functions.filter(
                  thisNode => thisNode.name === node.name,
                )[0];
                fnTestNode.decrementsSecretState = true;
                fnTestNode.parameters.modifiedStateVariables.filter(
                  param => param.name === statement.secretStateName,
                )[0].isDecremented = true;

                // TODO make this an array
              }
            });
          }

          const generateProofNodeExists = !!node._newASTPointer.body.statements.filter(
            statement => statement.nodeType === 'GenerateProof',
          )[0];
          const SendTransactionNodeExists = !!node._newASTPointer.body.statements.filter(
            statement => statement.nodeType === 'SendTransaction',
          )[0];

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:
          // NODEBUILDING

          if (indicator.initialisationRequired) {
            if (binding.owner && !binding.owner.node) binding.owner.node = binding.owner;
            if (!generateProofNodeExists) {
              if (indicator.isWhole) {
                const initialisePreimageNode = {
                  nodeType: 'InitialisePreimage',
                  privateStates: [stateVarName],
                };
                node._newASTPointer.body.statements.splice(0, 0, initialisePreimageNode);
              }
              const readPreimageNode = {
                nodeType: 'ReadPreimage',
                privateStates: {},
                onChainKeyRegistry: scope.onChainKeyRegistry,
                contractName: contractName,
              };
              node._newASTPointer.body.statements.push(readPreimageNode);
            } else if (indicator.isWhole) {
              node._newASTPointer.body.statements[0].privateStates.push(stateVarName);
            }
            const index = node._newASTPointer.body.statements.findIndex(
              node => node.nodeType === 'ReadPreimage',
            );
            node._newASTPointer.body.statements[index].privateStates[stateVarName] = {
              increment: increment,
              parameters: [stateVarName], // TODO this should be the name of the var inside the commitment
              stateVarId: [id],
              isWhole: indicator.isWhole,
              isPartitioned: indicator.isPartitioned,
              nullifierRequired: indicator.isNullified,
              isOwned: binding.isOwned,
              owner: binding.isOwned ? binding.owner.node.name || binding.owner.name : null,
              ownerIsSecret: binding.isOwned
                ? binding.owner.isSecret || binding.owner.node.isSecret
                : null,
              ownerIsParam: binding.isOwned
                ? binding.owner.isParam || !binding.owner.node.stateVariable
                : null,
            };

            if (binding.referencedKeyId) {
              node._newASTPointer.body.statements[index].privateStates[
                stateVarName
              ].stateVarId.push(binding.referencedKeyName);
            }
          }

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:

          // - oldCommitment nullifier preimage check
          if (indicator.isNullified) {
            // - oldCommitment preimage check
            // - oldCommitment membership & check vs the commitmentRoot
            const membershipWitnessNode = {
              nodeType: 'MembershipWitness',
              privateStateName: stateVarName,
              increment: increment,
              isWhole: indicator.isWhole,
              isPartitioned: indicator.isPartitioned,
              contractName: contractName,
            };

            const calculateNullifierNode = {
              nodeType: 'CalculateNullifier',
              privateStateName: stateVarName,
              increment: increment,
              isWhole: indicator.isWhole,
              isPartitioned: indicator.isPartitioned,
            };

            if (!generateProofNodeExists) {
              node._newASTPointer.body.statements.push(membershipWitnessNode);
              node._newASTPointer.body.statements.push(calculateNullifierNode);
            } else {
              let index = node._newASTPointer.body.statements.findIndex(
                node => node.nodeType === 'MembershipWitness',
              );
              node._newASTPointer.body.statements.splice(index, 0, membershipWitnessNode);
              index = node._newASTPointer.body.statements.findIndex(
                node => node.nodeType === 'CalculateNullifier',
              );
              node._newASTPointer.body.statements.splice(index, 0, calculateNullifierNode);
            }
          }

          // - newCommitment preimage check
          const calculateCommitmentNode = {
            nodeType: 'CalculateCommitment',
            privateStateName: stateVarName,
            parameters: [stateVarName], // TODO this should be the name of the var inside the commitment
            stateVarId: [id],
            increment: increment,
            isWhole: indicator.isWhole,
            isPartitioned: indicator.isPartitioned,
            nullifierRequired: indicator.isNullified,
            isOwned: binding.isOwned,
            owner: binding.isOwned ? binding.owner.node.name || binding.owner.name : null,
            ownerIsSecret: binding.isOwned
              ? binding.owner.isSecret || binding.owner.node.isSecret
              : null,
          };

          if (binding.referencedKeyId) {
            calculateCommitmentNode.stateVarId.push(binding.referencedKeyName);
          }

          if (!generateProofNodeExists) {
            node._newASTPointer.body.statements.push(calculateCommitmentNode);
          } else {
            const index = node._newASTPointer.body.statements.findIndex(
              node => node.nodeType === 'CalculateCommitment',
            );
            node._newASTPointer.body.statements.splice(index, 0, calculateCommitmentNode);
          }

          if (state.snarkVerificationRequired) {
            const circuitParams = [];
            // this adds other values we need in the circuit - v simple
            for (const param of node._newASTPointer.parameters.parameters) {
              if (param.isPrivate || param.isSecret || param.modifiesSecretState)
                circuitParams.push(param.name);
            }
            circuitParams.push(stateVarName);
            if (!generateProofNodeExists) {
              node._newASTPointer.body.statements.push({
                nodeType: 'GenerateProof',
                privateStates: {},
                circuitName: node.name,
                parameters: circuitParams,
              });
            }
            const generateProofNode = node._newASTPointer.body.statements.filter(
              node => node.nodeType === 'GenerateProof',
            )[0];
            generateProofNode.privateStates[stateVarName] = {
              nullifierRequired: indicator.isNullified,
              increment: increment,
              isMapping: !!binding.referencedKeyName,
              isWhole: indicator.isWhole,
              isPartitioned: indicator.isPartitioned,
              isOwned: binding.isOwned,
              owner: binding.isOwned ? binding.owner.node.name || binding.owner.name : null,
              ownerIsSecret: binding.isOwned
                ? binding.owner.isSecret || binding.owner.node.isSecret
                : null,
            };
            generateProofNode.parameters.push(stateVarName);
          }

          const publicInputs = [];

          if (!SendTransactionNodeExists) {
            for (const param of node.parameters.parameters) {
              if (!param.isSecret) publicInputs.push(param.name);
            }

            node._newASTPointer.body.statements.push({
              nodeType: 'SendTransaction',
              privateStates: {},
              privateStateName: stateVarName,
              functionName: node.name,
              contractName: contractName,
              publicInputs: publicInputs,
            });
          }

          const sendTransactionNode = node._newASTPointer.body.statements.filter(
            node => node.nodeType === 'SendTransaction',
          )[0];
          sendTransactionNode.privateStates[stateVarName] = {
            increment: increment,
            isPartitioned: indicator.isPartitioned,
            isWhole: indicator.isWhole,
            nullifierRequired: indicator.isNullified,
          };

          if (!generateProofNodeExists) {
            const writePreimageNode = {
              nodeType: 'WritePreimage',
              privateStates: {},
            };
            node._newASTPointer.body.statements.push(writePreimageNode);
          }
          const index = node._newASTPointer.body.statements.findIndex(
            node => node.nodeType === 'WritePreimage',
          );
          node._newASTPointer.body.statements[index].privateStates[stateVarName] = {
            increment: increment,
            parameters: [stateVarName], // TODO this should be the name of the var inside the commitment
            stateVarId: [id],
            isWhole: indicator.isWhole,
            isPartitioned: indicator.isPartitioned,
            nullifierRequired: indicator.isNullified,
            isOwned: binding.isOwned,
            owner: binding.isOwned ? binding.owner.node.name || binding.owner.name : null,
            ownerIsSecret: binding.isOwned
              ? binding.owner.isSecret || binding.owner.node.isSecret
              : null,
          };
          if (binding.referencedKeyId) {
            node._newASTPointer.body.statements[index].privateStates[stateVarName].stateVarId.push(
              binding.referencedKeyName,
            );
          }
        }
      }
    },
  },

  ParameterList: {
    enter(path) {
      const { node, parent } = path;
      const newNode = {
        nodeType: node.nodeType,
        parameters: [],
      };
      node._newASTPointer = newNode.parameters;
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  Block: {
    enter(path) {
      const { node, parent } = path;
      const newNode = {
        nodeType: node.nodeType,
        statements: [],
      };
      node._newASTPointer = newNode.statements;
      parent._newASTPointer.body = newNode;
    },

    exit(path) {},
  },

  VariableDeclarationStatement: {
    enter(path) {
      const { node, parent } = path;
      const newNode = {
        nodeType: node.nodeType,
        declarations: [],
        initialValue: {},
      };
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },

    exit(path) {},
  },

  BinaryOperation: {
    enter(path) {
      const { node, parent } = path;
      const newNode = {
        nodeType: node.nodeType,
        operator: node.operator,
        leftExpression: {},
        rightExpression: {},
      };
      node._newASTPointer = newNode;
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  Assignment: {
    enter(path, state) {
      const { node, parent } = path;

      const newNode = {
        nodeType: node.nodeType,
        operator: node.operator,
        leftHandSide: {},
        rightHandSide: {},
      };
      node._newASTPointer = newNode;
      if (parent._newASTPointer.nodeType === 'VariableDeclarationStatement') {
        parent._newASTPointer.initialValue = newNode;
      } else {
        parent._newASTPointer.expression = newNode;
      }
    },

    exit(path, state) {},
  },

  ExpressionStatement: {
    enter(path, state) {
      const { node, parent, scope } = path;
      let newNode;
      let isMapping;
      // ExpressionStatements can contain an Assignment node.
      if (node.expression.nodeType === 'Assignment') {
        const assignmentNode = node.expression;
        const { leftHandSide: lhs, rightHandSide: rhs } = assignmentNode;
        let referencedBinding =
          scope.getReferencedBinding(lhs) || scope.getReferencedBinding(lhs.baseExpression);
        const referencedNode = referencedBinding.node;
        isMapping = referencedBinding.isMapping;
        if (isMapping)
          referencedBinding =
            referencedBinding.mappingKeys[scope.getMappingKeyName(lhs)];

        // We should only replace the _first_ assignment to this node. Let's look at the scope's modifiedBindings for any prior modifications to this binding:
        const modifiedPaths = referencedBinding.modifyingPaths.filter(
          path => path.scope.scopeId === scope.scopeId,
        );

        // NODEBUILDING
        // if its secret and this is the first assigment, we add a vardec
        if (
          modifiedPaths[0].node.id === lhs.id &&
          referencedNode.isSecret &&
          referencedBinding.isWhole
        ) {
          let accessed = false;

          if (referencedBinding.accessedNodes) {
            referencedBinding.accessedNodes.forEach(obj => {
              if (obj.id === lhs.id) accessed = true;
            });
          }

          newNode = {
            nodeType: 'VariableDeclarationStatement',
            declarations: [
              {
                nodeType: 'VariableDeclaration',
                name: lhs.name,
                isAccessed: accessed,
                typeName: {
                  name: 'field',
                  nodeType: 'ElementaryTypeName',
                },
              },
            ],
            initialValue: {},
            modifiesSecretState: true,
          };
          node._newASTPointer = newNode;
          parent._newASTPointer.push(newNode);
          // state.skipSubNodes = true;

          // Continue scoping subNodes, so that any references / modifications to bindings are collected. We'll require this data when exiting the tree.
          path.traverse({}, {});

          return;
        }
        if (node.expression.isIncremented && referencedBinding.isPartitioned) {
          newNode = {
            nodeType: node.nodeType,
            expression: {},
            incrementsSecretState: node.expression.isIncremented,
            decrementsSecretState: node.expression.isDecremented,
            secretStateName: isMapping
              ? referencedBinding.name.replace(`[`, `_`).replace(`]`, ``)
              : referencedBinding.name,
          };

          node._newASTPointer = newNode;
          parent._newASTPointer.push(newNode);
          // state.skipSubNodes = true;
          return;
        }
      }
      if (node.expression.nodeType !== 'FunctionCall') {
        newNode = {
          nodeType: node.nodeType,
          expression: {},
        };
        node._newASTPointer = newNode;
        parent._newASTPointer.push(newNode);
      }
    },

    exit(path) {
      if (path.node._newASTPointer && path.node._newASTPointer.incrementsSecretState) {
        let increment;
        switch (path.node.expression.rightHandSide.nodeType) {
          case 'Identifier':
            increment = path.node.expression.rightHandSide.name;
            break;
          case 'BinaryOperation':
            if (
              path.node.expression.rightHandSide.leftExpression.name ===
              path.node.expression.leftHandSide.name
            ) {
              increment = path.node.expression.rightHandSide.rightExpression.name;
              break;
            } else if (path.node.expression.rightHandSide.leftHandSide) {
              increment = path.node.expression.rightHandSide.leftHandSide.name;
              break;
            } else {
              increment = '';
              path.scope.indicators[
                path.node.expression.leftHandSide.referencedDeclaration
              ].increments.forEach(inc => {
                increment += inc.name ? `+ ${inc.name} ` : `+ ${inc.value} `;
              });
              path.scope.indicators[
                path.node.expression.leftHandSide.referencedDeclaration
              ].decrements.forEach(dec => {
                increment += dec.name ? `- ${dec.name} ` : `- ${dec.value} `;
              });
              break;
            }
          default:
            break;
        }
        path.node._newASTPointer.increment = increment;
      }
    },
  },

  VariableDeclaration: {
    enter(path, state) {
      const { node, parent, scope } = path;
      if (node.stateVariable) {
        // then the node represents assignment of a state variable.
        node._newASTPointer = parent._newASTPointer;
        state.skipSubNodes = true;
        return;
      }
      let modifiesSecretState = false;

      scope.bindings[node.id].referencingPaths.forEach(refPath => {
        if (scope.getReferencedBinding(refPath.node).isSecret) modifiesSecretState = true;
      });

      if (parent.nodeType === 'VariableDeclarationStatement' && modifiesSecretState)
        parent._newASTPointer.modifiesSecretState = modifiesSecretState;

      // if it's not declaration of a state variable, it's (probably) declaration of a new function parameter. We _do_ want to add this to the newAST.
      const newNode = {
        nodeType: node.nodeType,
        name: node.name,
        isPrivate: node.isSecret,
        modifiesSecretState: modifiesSecretState,
        typeName: {},
      };
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName].push(newNode);
      }
    },

    exit(path) {},
  },

  ElementaryTypeName: {
    enter(path) {
      const { node, parent } = path;
      // if (node.name !== 'uint256')
      //   throw new Error('Currently, only transpilation of "uint256" types is supported');

      const newNode = {
        nodeType: node.nodeType,
        name: node.name, // convert uint types to 'field', for now.
      };

      // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  Identifier: {
    enter(path) {
      const { node, parent } = path;
      const newNode = {
        nodeType: node.nodeType,
        name: node.name,
      };
      // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  IndexAccess: {
    enter(path, state) {
      const { node, parent } = path;
      if (!node.indexExpression.expression) node.indexExpression.expression = node.indexExpression;
      const newNode = {
        nodeType: node.nodeType,
        name: `${node.baseExpression.name}_${node.indexExpression.expression.name}`,
      };
      state.skipSubNodes = true; // the subnodes are baseExpression and indexExpression - we skip them
      // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  MemberAccess: {
    enter(path, state) {
      const { node, parent } = path;
      const newNode = {
        nodeType: node.nodeType,
        name: `${node.expression.name}_${node.memberName}`,
      };
      state.skipSubNodes = true; // the subnodes are baseExpression and indexExpression - we skip them
      // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  Literal: {
    enter(path) {
      const { node, parent } = path;
      const newNode = {
        nodeType: node.nodeType,
        name: node.value,
      };

      // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  FunctionCall: {
    enter(path, state) {
      // HACK: Not sure how to deal with FunctionCalls for Orchestration, so skipping them
      state.skipSubNodes = true;
    },
  },
};
