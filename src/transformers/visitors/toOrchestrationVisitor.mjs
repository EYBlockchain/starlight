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
        const newNode = {
          nodeType: 'File',
          name: node.name, // the name of this function
          fileExtension: '.mjs',
          nodes: [
            {
              nodeType: 'Imports',
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
        node._newASTPointer = newNode.nodes[1]; // eslint-disable-line prefer-destructuring
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
        const contractName = `${node.name.charAt(0).toUpperCase() + node.name.slice(1)}Shield`;

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

        for (const [id, binding] of Object.entries(modifiedStateVariableBindings)) {
          const indicator = scope.indicators[id];
          const stateVarName = binding.node.name;

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:
          // TODO - sep ReadPreimage into 1. read from db and 2. decide whether comm exists (skip 2 if below false)
          // Also do for MembershipWitness
          // NODEBUILDING
          if (indicator.initialisationRequired) {
            node._newASTPointer.body.statements.push({
              nodeType: 'ReadPreimage',
              privateStateName: stateVarName,
              parameters: [stateVarName], // TODO this should be the name of the var inside the commitment
            });
          }
          // - oldCommitment preimage check
          // - oldCommitment membership & check vs the commitmentRoot
          node._newASTPointer.body.statements.push({
            nodeType: 'MembershipWitness',
            contractName: contractName,
          });

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:

          // - oldCommitment nullifier preimage check
          if (indicator.isNullified) {
            node._newASTPointer.body.statements.push({
              nodeType: 'CalculateNullifier',
            });
          }

          // - newCommitment preimage check
          node._newASTPointer.body.statements.push({
            nodeType: 'CalculateCommitment',
            privateStateName: stateVarName,
            parameters: [stateVarName], // TODO this should be the name of the var inside the commitment
          });

          if (state.snarkVerificationRequired) {
            const circuitParams = [];
            // this adds other values we need in the circuit - v simple
            for (const modifier of binding.modifyingPaths) {
              if (modifier.parent.nodeType === 'Assignment')
                circuitParams.push(modifier.parent.rightHandSide.name);
            }
            circuitParams.push(stateVarName);
            node._newASTPointer.body.statements.push({
              nodeType: 'GenerateProof',
              privateStateName: stateVarName,
              circuitName: node.name,
              parameters: circuitParams, // TODO this should be the name of the var inside the commitment
            });
          }

          node._newASTPointer.body.statements.push({
            nodeType: 'SendTransaction',
            privateStateName: stateVarName,
            functionName: node.name,
            contractName: contractName,
          });

          node._newASTPointer.body.statements.push({
            nodeType: 'WritePreimage',
            privateStateName: stateVarName,
            parameters: [stateVarName], // TODO this should be the name of the var inside the commitment
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
      parent._newASTPointer.expression = newNode;
    },

    exit(path, state) {},
  },

  ExpressionStatement: {
    enter(path, state) {
      const { node, parent, scope } = path;
      let newNode;
      // ExpressionStatements can contain an Assignment node.
      // If this ExpressionStatement contains an assignment `a = b` to a stateVariable `a`, and if it's the _first_ such assignment in this scope, then this ExpressionStatement needs to become a VariableDeclarationStatement in the circuit's AST, i.e. `field a = b`.
      if (node.expression.nodeType === 'Assignment') {
        const assignmentNode = node.expression;
        const { leftHandSide: lhs, rightHandSide: rhs } = assignmentNode;
        const referencedBinding = scope.getReferencedBinding(lhs);
        const referencedNode = referencedBinding.node;

        // We should only replace the _first_ assignment to this node. Let's look at the scope's modifiedBindings for any prior modifications to this binding:
        const modifiedBinding = scope.modifiedBindings[referencedBinding.id];

        // NODEBUILDING
        if (!modifiedBinding && referencedNode.isSecret) {
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
            initialValue: {
              ...rhs,
            },
          };

          node._newASTPointer = newNode;
          parent._newASTPointer.push(newNode);
          state.skipSubNodes = true;

          // Continue scoping subNodes, so that any references / modifications to bindings are collected. We'll require this data when exiting the tree.
          path.traverse({}, {});

          return;
        }
      }

      newNode = {
        nodeType: node.nodeType,
        expression: {},
      };
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },

    exit(path, parent) {},
  },

  VariableDeclaration: {
    enter(path, state) {
      const { node, parent } = path;
      if (node.stateVariable) {
        // then the node represents assignment of a state variable.
        node._newASTPointer = parent._newASTPointer;
        state.skipSubNodes = true;
        return;
      }

      // if it's not declaration of a state variable, it's (probably) declaration of a new function parameter. We _do_ want to add this to the newAST.
      const newNode = {
        nodeType: node.nodeType,
        name: node.name,
        isPrivate: true, // assume all params are private for now? TODO: think this through better.
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
    enter(path) {},

    exit(path) {},
  },
};
