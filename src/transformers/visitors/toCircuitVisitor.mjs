/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../utils/logger.mjs';
import solidityTypes from '../../types/solidity-types.mjs';
import circuitTypes from '../../types/circuit-types.mjs';
import traverse from '../../traverse/traverse.mjs';

// a closure for assigning a variable to an object's property by reference
function property(object, prop) {
  return {
    get value() {
      return object[prop];
    },
    set value(val) {
      object[prop] = val;
    },
  };
}

export default {
  PragmaDirective: {
    // we ignore the Pragma Directive; it doesn't aid us in creating a circuit
    enter(node, parent, state) {},
    exit(node, parent, state) {},
  },

  ContractDefinition: {
    enter(node, parent, state) {
      // take note that we've entered a contract's scope
      const contractName = node.name;
      // wipes the previous scope
      state.scope = {
        contractName,
        globals: [],
      };

      node._context = parent._context;
    },

    exit(node, parent) {},
  },

  FunctionDefinition: {
    enter(node, parent, state) {
      // define a 'nested' visitor that will traverse the subnodes of this node.
      const findGlobalAssignmentVisitor = {
        Assignment: {
          enter(node, parent, state) {
            const { name, id } = state.global;
            const assignee = node.leftHandSide;
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
      state.scope.assignedGlobals = [];

      if (state.scope.globals) {
        for (const global of state.scope.globals) {
          const nestedState = {
            global,
            globalFound: false,
          };
          traverse(node, parent, findGlobalAssignmentVisitor, nestedState);
          if (nestedState.globalFound) {
            // then this global is assigned to within this function, and so we need to create a corresponding circuit _file_ for this function. We'll commitment boilerplate for this global to this file.
            newFile = true;
            state.scope.assignedGlobals.push(global);
            // state.scope.EditableCommitmentCommonFiles = true;
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
          fileExtension: '.zok',
          nodes: [
            {
              nodeType: 'ImportStatements',
              imports: [
                {
                  nodeType: 'EditableCommitmentImportsBoilerplate',
                },
              ],
            },
            {
              // insert this FunctionDefinition node into our newly created circuit file.
              nodeType: node.nodeType, // FunctionDefinition
              name: 'main',
              body: {},
              parameters: {},
              // no returnParameters
            },
          ],
        };
        node._context = newNode.nodes[1]; // eslint-disable-line prefer-destructuring
        parent._context.push(newNode);
      } else {
        // Not sure what to do if we're not creating a file...
      }
    },

    exit(node, parent, state) {
      // By this point, we've added a corresponding FunctionDefinition node to the newAST, with the same nodes as the original Solidity function, with some renaming here and there, and stripping out unused data from the oldAST.
      // Now let's add some commitment-related boilerplate!

      logger.debug("WASSUP");
      logger.debug("node._context:", node._context);
      logger.debug("parent._context:", parent._context);


      if (state.scope.assignedGlobals) {
        // Add a placeholder for common circuit files within the circuits Folder:
        const files = parent._context;
        let editableCommitmentCommonFilesAlreadyExist = false;
        for (const file of files) {
          if (file.nodeType === 'EditableCommitmentCommonFiles') {
            editableCommitmentCommonFilesAlreadyExist = true;
            break;
          }
        }
        if (!editableCommitmentCommonFilesAlreadyExist) {
          parent._context.push({
            nodeType: 'EditableCommitmentCommonFiles',
          });
        }

        // Add 'editable commitment'-related parameters to the function's parameters, for each global which is assigned-to within the function:
        for (const global of state.scope.assignedGlobals) {
          const editableCommitmentParameters = circuitTypes.buildEditableCommitmentParameters(
            global.name,
          );
          for (const param of editableCommitmentParameters) {
            node._context.parameters.parameters.push(param);
          }
        }

        // Add a commitmentRoot parameter (only 1 commitmentRoot param is needed for all globals being committed to)
        node._context.parameters.parameters.push({
          nodeType: 'VariableDeclaration',
          name: 'commitmentRoot',
          isPrivate: false,
          typeName: {
            nodeType: 'ElementaryTypeName',
            name: 'field',
          },
        });

        // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:
        // - oldCommitment preimage check
        // - oldCommitment membership & check vs the commitmentRoot
        // - oldCommitment nullifier preimage check
        // - newCommitment preimage check
        // ^^^ do this for each global:
        for (const global of state.scope.assignedGlobals) {
          node._context.body.statements.push({
            nodeType: 'EditableCommitmentStatementsBoilerplate',
            privateStateName: global.name,
          });
        }
      }
    },
  },

  ParameterList: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        parameters: [],
      };
      node._context = newNode.parameters;
      const { containerName } = solidityTypes.getNodeLocation(node, parent);
      parent._context[containerName] = newNode;
    },

    exit(node, parent) {},
  },

  Block: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        statements: [],
      };
      node._context = newNode.statements;
      parent._context.body = newNode;
    },

    exit(node, parent) {},
  },

  VariableDeclarationStatement: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        declarations: [],
        initialValue: {},
      };
      node._context = newNode;
      parent._context.push(newNode);
    },

    exit(node, parent) {},
  },

  BinaryOperation: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        leftExpression: {},
        rightExpression: {},
      };
      node._context = newNode;
      const { containerName } = solidityTypes.getNodeLocation(node, parent);
      parent._context[containerName] = newNode;
    },

    exit(node, parent) {},
  },

  Assignment: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        leftHandSide: {},
        rightHandSide: {},
      };
      node._context = newNode;
      parent._context.expression = newNode;
    },

    exit(node, parent) {},
  },

  ExpressionStatement: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        expression: {},
      };
      node._context = newNode;
      parent._context.push(newNode);
    },

    exit(node, parent) {},
  },

  VariableDeclaration: {
    enter(node, parent, state) {
      if (node.stateVariable) {
        // then the node represents assignment of a state variable.
        // Make note of this, for later, but don't add anything new to the newAST
        state.scope.globals.push(node);

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
        const { containerName } = solidityTypes.getNodeLocation(node, parent);
        parent._context[containerName].push(newNode);
      }
    },

    exit(node, parent) {},
  },

  ElementaryTypeName: {
    enter(node, parent) {
      if (node.name !== 'uint256') throw new Error('Currently, only transpilation of "uint256" types is supported');

      const newNode = {
        nodeType: node.nodeType,
        name: 'field', // convert uint types to 'field', for now.
      };

      // node._context = // no context needed, because this is a leaf, so we won't be recursing any further.
      const { containerName } = solidityTypes.getNodeLocation(node, parent);
      parent._context[containerName] = newNode;
    },

    exit(node, parent) {},
  },

  Identifier: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        name: node.name,
      };

      // node._context = // no context needed, because this is a leaf, so we won't be recursing any further.
      const { containerName } = solidityTypes.getNodeLocation(node, parent);
      parent._context[containerName] = newNode;
    },

    exit(node, parent) {},
  },

  Literal: {
    enter(node, parent) {},

    exit(node, parent) {},
  },
};
