/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../utils/logger.mjs';
import { traverse } from '../../traverse/traverse.mjs';

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
        return;
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
            {
              nodeType: 'KeyRegistrationFunction',
              onChainKeyRegistry: scope.onChainKeyRegistry, // TODO this is the temp solution to have a mapping with eth addr -> zkp keys on chain (we don't always need it)
              contractName: contractName,
            },
            {
              // insert this FunctionDefinition node into our newly created circuit file.
              nodeType: node.nodeType, // FunctionDefinition
              name: node.name,
              body: {},
              parameters: {}, // node.parameters.parameters,
              // no returnParameters
            },
          ],
        };
        node._newASTPointer = newNode.nodes[2]; // eslint-disable-line prefer-destructuring
        parent._newASTPointer.push(newNode);
      } else {
        // Not sure what to do if we're not creating a file...
        // NODEBUILDING
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
      if (state.newCommitmentsRequired) {
        // Add a placeholder for common circuit files within the circuits Folder:
        const files = parent._newASTPointer;
        let EditableCommitmentCommonFilesBoilerplateAlreadyExists = false;
        for (const file of files) {
          if (file.nodeType === 'EditableCommitmentCommonFilesBoilerplate') {
            EditableCommitmentCommonFilesBoilerplateAlreadyExists = true;
            break;
          }
        }
        if (!EditableCommitmentCommonFilesBoilerplateAlreadyExists) {
          parent._newASTPointer.push({
            nodeType: 'EditableCommitmentCommonFilesBoilerplate',
          });
        }
        const contractName = `${parent.name}Shield`;

        if (state.snarkVerificationRequired) {
          parent._newASTPointer.push({
            nodeType: 'ZokratesSetupCommonFilesBoilerplate',
          });
          // NODEBUILDING
          parent._newASTPointer.push({
            nodeType: 'File',
            name: 'test',
            fileExtension: '.mjs',
            nodes: [
              {
                nodeType: 'IntegrationTestBoilerplate',
                contractName: contractName,
                functionName: node.name,
                parameters: node.parameters,
              },
            ],
          });
        }

        // assuming one secret state var per commitment
        const modifiedStateVariableBindings = scope.filterModifiedBindings(
          binding => binding.stateVariable && binding.isSecret,
        );

        node._newASTPointer.parameters.modifiedStateVariables = [];

        for (const [id, binding] of Object.entries(modifiedStateVariableBindings)) {
          const indicator = scope.indicators[id];
          const stateVarName = binding.node.name;
          node._newASTPointer.parameters.modifiedStateVariables.push({
            nodeType: binding.node.nodeType,
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
              if (statement.decrementsSecretState) {
                node._newASTPointer.decrementsSecretState = true;
                node._newASTPointer.decrementedSecretState = statement.secretStateName; // TODO make this an array
              }
            });
          }

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:
          // TODO - sep ReadPreimage into 1. read from db and 2. decide whether comm exists (skip 2 if below false)
          // Also do for MembershipWitness
          // NODEBUILDING
          if (indicator.initialisationRequired) {
            node._newASTPointer.body.statements.push({
              nodeType: 'ReadPreimage',
              privateStateName: stateVarName,
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
            });
          }

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:

          // - oldCommitment nullifier preimage check
          if (indicator.isNullified) {
            // - oldCommitment preimage check
            // - oldCommitment membership & check vs the commitmentRoot
            node._newASTPointer.body.statements.push({
              nodeType: 'MembershipWitness',
              privateStateName: stateVarName,
              increment: increment,
              isWhole: indicator.isWhole,
              isPartitioned: indicator.isPartitioned,
              contractName: contractName,
            });

            node._newASTPointer.body.statements.push({
              nodeType: 'CalculateNullifier',
              privateStateName: stateVarName,
              increment: increment,
              isWhole: indicator.isWhole,
              isPartitioned: indicator.isPartitioned,
            });
          }

          // - newCommitment preimage check
          node._newASTPointer.body.statements.push({
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
          });

          if (state.snarkVerificationRequired) {
            const circuitParams = [];
            // this adds other values we need in the circuit - v simple
            for (const param of node._newASTPointer.parameters.parameters) {
              if (param.isPrivate || param.isSecret || param.modifiesSecretState)
                circuitParams.push(param.name);
            }
            circuitParams.push(stateVarName);
            node._newASTPointer.body.statements.push({
              nodeType: 'GenerateProof',
              privateStateName: stateVarName,
              increment: increment,
              circuitName: node.name,
              parameters: circuitParams, // TODO this should be the name of the var inside the commitment
              nullifierRequired: indicator.isNullified,
              isWhole: indicator.isWhole,
              isPartitioned: indicator.isPartitioned,
              isOwned: binding.isOwned,
              owner: binding.isOwned ? binding.owner.node.name || binding.owner.name : null,
              ownerIsSecret: binding.isOwned
                ? binding.owner.isSecret || binding.owner.node.isSecret
                : null,
            });
          }

          const publicInputs = [];

          for (const param of node.parameters.parameters) {
            if (!param.isSecret) publicInputs.push(param.name);
          }

          node._newASTPointer.body.statements.push({
            nodeType: 'SendTransaction',
            privateStateName: stateVarName,
            functionName: node.name,
            contractName: contractName,
            increment: increment,
            isPartitioned: indicator.isPartitioned,
            isWhole: indicator.isWhole,
            publicInputs: publicInputs,
            nullifierRequired: indicator.isNullified,
          });

          node._newASTPointer.body.statements.push({
            nodeType: 'WritePreimage',
            privateStateName: stateVarName,
            increment: increment,
            parameters: [stateVarName], // TODO this should be the name of the var inside the commitment
            stateVarId: [id],
            nullifierRequired: indicator.isNullified,
            isWhole: indicator.isWhole,
            isPartitioned: indicator.isPartitioned,
            isOwned: binding.isOwned,
            owner: binding.isOwned ? binding.owner.node.name || binding.owner.name : null,
            ownerIsSecret: binding.isOwned
              ? binding.owner.isSecret || binding.owner.node.isSecret
              : null,
          });
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
      // ExpressionStatements can contain an Assignment node.
      if (node.expression.nodeType === 'Assignment') {
        const assignmentNode = node.expression;
        const { leftHandSide: lhs, rightHandSide: rhs } = assignmentNode;
        const referencedBinding = scope.getReferencedBinding(lhs);
        const referencedNode = referencedBinding.node;

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
          newNode = {
            nodeType: 'VariableDeclarationStatement',
            declarations: [
              {
                nodeType: 'VariableDeclaration',
                name: lhs.name,
                typeName: {
                  name: 'field',
                  nodeType: 'ElementaryTypeName',
                },
              },
            ],
            initialValue: {},
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
            secretStateName: referencedBinding.name,
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
      if (path.node._newASTPointer.incrementsSecretState) {
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
            } else {
              increment = path.node.expression.rightHandSide.leftHandSide.name;
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
      if (node.name !== 'uint256')
        throw new Error('Currently, only transpilation of "uint256" types is supported');

      const newNode = {
        nodeType: node.nodeType,
        name: 'field', // convert uint types to 'field', for now.
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
};
