/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import logger from '../../utils/logger.mjs';
import { getNodeLocation, findReferencedDeclaration } from '../../types/solidity-types.mjs';
import { collectAllStateVariableBindings, findReferencedBinding } from '../../traverse/Scope.mjs';
import circuitTypes from '../../types/circuit-types.mjs';
import { traverse } from '../../traverse/traverse.mjs';

export default {
  PragmaDirective: {
    // we ignore the Pragma Directive; it doesn't aid us in creating a circuit
    enter(path, state, scope) {},
    exit(path, state, scope) {},
  },

  ContractDefinition: {
    enter(path, state, scope) {
      const { node, parent } = path;
      node._context = parent._context;
    },

    exit(path) {},
  },

  FunctionDefinition: {
    enter(path, state, scope) {
      const { node, parent } = path;
      // define a 'nested' visitor that will traverse the subnodes of this node.
      // TODO: a simple, fast traversal function sith a single callback?
      const findSecretGlobalAssignmentVisitor = {
        Assignment: {
          enter(path, state, scope) {
            const { name, id } = state.global;
            const assignee = path.node.leftHandSide;
            if (assignee.name === name && assignee.referencedDeclaration === id) {
              state.globalFound = true;
              state.stopTraversal = true;
            }
          },
        },
      };

      // check the function for assignments to any global states:
      // we'll need to create a new circuit file if we find one:
      let newFile = false;
      // state.scope.assignedGlobals = [];
      // const stateVariableBindings = scope.bindings.filter(binding => binding.stateVariable);
      const stateVariableBindings = collectAllStateVariableBindings(scope);

      if (stateVariableBindings) {
        for (const binding of stateVariableBindings) {
          if (binding.node.sprinkle) {
            const nestedState = {
              global: binding.node,
              globalFound: false,
            };
            traverse(path, findSecretGlobalAssignmentVisitor, nestedState);
            if (nestedState.globalFound) {
              // then this secret global is assigned to within this function, and so we need to create a corresponding orchestration _file_ for this function. We'll add commitment boilerplate for this global to this file.
              newFile = true;
              // state.scope.assignedGlobals.push(global);
              // state.scope.EditableCommitmentCommonFilesBoilerplate = true;
            }
          }
        }
      } else {
        // Not sure what to do 'else', yet.
        // If there are no global states, then (currently) a circuit isn't needed for this function. In future, this could be a helper function which supports some other state-editing function, in which case a circuit would be needed.
        return;
      }

      if (newFile) {
        // If we've not yet added this function as a node to our newAST, let's do that:
        // Our location in the newAST (parent._context) should be Folder.files[].
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
        node._context = newNode.nodes[1]; // eslint-disable-line prefer-destructuring
        parent._context.push(newNode);
      } else {
        // Not sure what to do if we're not creating a file...
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
        node._context = newNode.nodes[0]; // eslint-disable-line prefer-destructuring
        parent._context.push(newNode);
      }
    },

    exit(path, state, scope) {
      const { node, parent } = path;
      // By this point, we've added a corresponding FunctionDefinition node to the newAST, with the same nodes as the original Solidity function, with some renaming here and there, and stripping out unused data from the oldAST.
      // Now let's add some commitment-related boilerplate!
      if (state.commitmentsRequired) {
        // Add a placeholder for common circuit files within the circuits Folder:
        const files = parent._context;
        let EditableCommitmentCommonFilesBoilerplateAlreadyExists = false;
        for (const file of files) {
          if (file.nodeType === 'EditableCommitmentCommonFilesBoilerplate') {
            EditableCommitmentCommonFilesBoilerplateAlreadyExists = true;
            break;
          }
        }
        if (!EditableCommitmentCommonFilesBoilerplateAlreadyExists) {
          parent._context.push({
            nodeType: 'EditableCommitmentCommonFilesBoilerplate',
          });
        }
        const contractName = `${node.name.charAt(0).toUpperCase() + node.name.slice(1)}Shield`;

        if (state.snarkVerificationRequired) {
          parent._context.push({
            nodeType: 'ZokratesSetupCommonFilesBoilerplate',
          });
          parent._context.push({
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
        const secretVariablesToCommit = scope.modifiedBindings.filter(
          binding => binding.stateVariable && binding.secretVariable,
        );

        for (const binding of secretVariablesToCommit) {
          const global = binding.node;
          // Add 'editable commitment'-related parameters to the function's parameters, for each global which is assigned-to within the function:
          // const editableCommitmentParameters = circuitTypes.buildEditableCommitmentParameters(
          //   global.name,
          // );
          // for (const param of editableCommitmentParameters) {
          //   node._context.parameters.parameters.push(param);
          // }

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:
          // TODO - sep ReadPreimage into 1. read from db and 2. decide whether comm exists (skip 2 if below false)
          // Also do for MembershipWitness
          if (scope.indicators[0].initialisationRequired) {
            node._context.body.statements.push({
              nodeType: 'ReadPreimage',
              privateStateName: global.name,
              parameters: [global.name], // TODO this should be the name of the var inside the commitment
            });
          }
          // - oldCommitment preimage check
          // - oldCommitment membership & check vs the commitmentRoot
          node._context.body.statements.push({
            nodeType: 'MembershipWitness',
            contractName: contractName,
          });

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:

          // - oldCommitment nullifier preimage check
          if (scope.indicators[0].nullifierRequired) {
            node._context.body.statements.push({
              nodeType: 'CalculateNullifier',
            });
          }

          // - newCommitment preimage check
          node._context.body.statements.push({
            nodeType: 'CalculateCommitment',
            privateStateName: global.name,
            parameters: [global.name], // TODO this should be the name of the var inside the commitment
          });

          if (state.snarkVerificationRequired) {
            const circuitParams = [];
            // this adds other values we need in the circuit - v simple
            binding.modifyingPaths.forEach(modifier => {
              if (modifier.parent.nodeType === 'Assignment')
                circuitParams.push(modifier.parent.rightHandSide.name);
            });
            circuitParams.push(global.name);
            node._context.body.statements.push({
              nodeType: 'GenerateProof',
              privateStateName: global.name,
              circuitName: node.name,
              parameters: circuitParams, // TODO this should be the name of the var inside the commitment
            });
          }

          node._context.body.statements.push({
            nodeType: 'SendTransaction',
            privateStateName: global.name,
            functionName: node.name,
            contractName: contractName,
          });

          node._context.body.statements.push({
            nodeType: 'WritePreimage',
            privateStateName: global.name,
            parameters: [global.name], // TODO this should be the name of the var inside the commitment
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
      node._context = newNode.parameters;
      parent._context[path.containerName] = newNode;
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
      node._context = newNode.statements;
      parent._context.body = newNode;
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
      node._context = newNode;
      parent._context.push(newNode);
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
      node._context = newNode;
      parent._context[path.containerName] = newNode;
    },

    exit(path) {},
  },

  Assignment: {
    enter(path, state, scope) {
      const { node, parent } = path;

      const newNode = {
        nodeType: node.nodeType,
        operator: node.operator,
        leftHandSide: {},
        rightHandSide: {},
      };
      node._context = newNode;
      parent._context.expression = newNode;
    },

    exit(path, state, scope) {},
  },

  ExpressionStatement: {
    enter(path, state, scope) {
      const { node, parent } = path;
      let newNode;
      // ExpressionStatements can contain an Assignment node.
      // If this ExpressionStatement contains an assignment `a = b` to a stateVariable `a`, and if it's the _first_ such assignment in this scope, then this ExpressionStatement needs to become a VariableDeclarationStatement in the circuit's AST, i.e. `field a = b`.
      if (node.expression.nodeType === 'Assignment') {
        const assignmentNode = node.expression;
        const { leftHandSide: lhs, rightHandSide: rhs } = assignmentNode;
        const referencedBinding = findReferencedBinding(scope, lhs);
        const referencedNode = referencedBinding.node;

        // We should only replace the _first_ assignment to this node. Let's look at the scope's modifiedBindings for any prior modifications to this binding:
        const modifiedBinding = scope.modifiedBindings.find(
          binding => binding === referencedBinding,
        );

        // TODO: could we alternatively look in referencedBinding.modifyingPaths? Possibly not, because that might include modifications from other scopes?
        // TODO: maybe have a 'find within Body' function to go up to the root of the body, and traverse it?
        // TODO: perhaps we could use the path.getFirstSiblingNode function? Or actually, path.getAllPrevSiblingNodes

        if (!modifiedBinding && referencedNode.sprinkle === 'secret') {
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

          node._context = newNode;
          parent._context.push(newNode);
          state.skipSubNodes = true;

          // Continue scoping subNodes, so that any references / modifications to bindings are collected. We'll require this data when exiting the tree.
          path.traverse({}, {}, scope);

          return;
        }
      }

      newNode = {
        nodeType: node.nodeType,
        expression: {},
      };
      node._context = newNode;
      parent._context.push(newNode);
    },

    exit(node, parent) {},
  },

  VariableDeclaration: {
    enter(path, state, scope) {
      const { node, parent } = path;
      if (node.stateVariable) {
        // then the node represents assignment of a state variable.
        node._context = parent._context;
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
      node._context = newNode;
      if (Array.isArray(parent._context)) {
        parent._context.push(newNode);
      } else {
        parent._context[path.containerName].push(newNode);
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

      // node._context = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._context[path.containerName] = newNode;
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

      // node._context = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._context[path.containerName] = newNode;
    },

    exit(path) {
      // findReferencedDeclaration example placement:
      // const declaration = findReferencedDeclaration(node, parent);
      // logger.debug('Found ref dec:');
      // console.log(declaration.name, declaration.nodeType);
      // if (dec.sprinkle) console.log(`Which is ${dec.sprinkle}!`);
    },
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
