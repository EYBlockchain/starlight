/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../utils/logger.mjs';
import circuitTypes from '../../types/circuit-types.mjs';
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
        node._newASTPointer = newNode.nodes[1]; // eslint-disable-line prefer-destructuring
        parent._newASTPointer.push(newNode);
      } else {
        // Not sure what to do if we're not creating a file...
      }
    },

    exit(path, state) {
      const { node, parent } = path;
      // By this point, we've added a corresponding FunctionDefinition node to the newAST, with the same nodes as the original Solidity function, with some renaming here and there, and stripping out unused data from the oldAST.
      // Now let's add some commitment-related boilerplate!
      const modifiedStateVariableBindings = path.scope.modifiedBindings.filter(
        binding => binding.stateVariable,
      );
      if (modifiedStateVariableBindings) {
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

        for (const binding of modifiedStateVariableBindings) {
          const global = binding.node;
          // Add 'editable commitment'-related parameters to the function's parameters, for each global which is assigned-to within the function:
          const editableCommitmentParameters = circuitTypes.buildEditableCommitmentParameters(
            global.name,
          );
          for (const param of editableCommitmentParameters) {
            node._newASTPointer.parameters.parameters.push(param);
          }

          // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:
          // - oldCommitment preimage check
          // - oldCommitment membership & check vs the commitmentRoot
          // - oldCommitment nullifier preimage check
          // - newCommitment preimage check
          // ^^^ do this for each global:
          node._newASTPointer.body.statements.push({
            nodeType: 'EditableCommitmentStatementsBoilerplate',
            privateStateName: global.name,
          });
        }

        // Add a commitmentRoot parameter (only 1 commitmentRoot param is needed for all globals being committed to)
        // NODEBUILDING
        node._newASTPointer.parameters.parameters.push({
          nodeType: 'VariableDeclaration',
          name: 'commitmentRoot',
          isPrivate: false,
          typeName: {
            nodeType: 'ElementaryTypeName',
            name: 'field',
          },
        });
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
      const { node, parent } = path;
      let newNode;
      // ExpressionStatements can contain an Assignment node.
      // If this ExpressionStatement contains an assignment `a = b` to a stateVariable `a`, and if it's the _first_ such assignment in this scope, then this ExpressionStatement needs to become a VariableDeclarationStatement in the circuit's AST, i.e. `field a = b`.
      if (node.expression.nodeType === 'Assignment') {
        const assignmentNode = node.expression;
        const { leftHandSide: lhs, rightHandSide: rhs } = assignmentNode;
        const referencedBinding = path.scope.getReferencedBinding(lhs);
        const referencedNode = referencedBinding.node;

        // We should only replace the _first_ assignment to this node. Let's look at the scope's modifiedBindings for any prior modifications to this binding:
        const modifiedBinding = path.scope.modifiedBindings.find(
          binding => binding === referencedBinding,
        );

        // TODO: could we alternatively look in referencedBinding.modifyingPaths? Possibly not, because that might include modifications from other scopes?
        // TODO: maybe have a 'find within Body' function to go up to the root of the body, and traverse it?
        // TODO: perhaps we could use the path.getFirstSiblingNode function? Or actually, path.getAllPrevSiblingNodes

        if (!modifiedBinding && referencedNode.isSecret) {
          // NODEBUILDING
          newNode = {
            nodeType: 'VariableDeclarationStatement',
            declarations: [
              {
                nodeType: 'VariableDeclaration',
                name: lhs.name,
                isPrivate: false, // despite the original VarDec being 'secret', this VarDec is now within the body of a circuit; hence 'secret' makes no sence. Declaring it as 'false' will help the codeGenerator.
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

    exit(node, parent) {},
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
        isPrivate: true, // for the zokrates code generator.
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
