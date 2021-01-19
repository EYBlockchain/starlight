/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../utils/logger.mjs';
import { buildNode } from '../../types/zokrates-types.mjs';
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
        // I suppose other functions for which newFile = true (i.e. functions which actually modify secret state) will need to include any helper functions they reference within the circuit file (or import them).
        return;
      }

      if (newFile) {
        // If we've not yet added this function as a node to our newAST, let's do that:
        // Our location in the newAST (parent._newASTPointer) should be Folder.files[].
        // TODO: why is the decision to add import statements separate from adding the nodes of the files which get imported by these statements?
        const newNode = buildNode('File', {
          fileName: node.name,
          nodes: [
            buildNode('ImportStatementList', {
              imports: [buildNode('EditableCommitmentImportStatementsBoilerplate')],
            }),
            buildNode('FunctionDefinition', { name: 'main' }),
          ],
        });

        node._newASTPointer = newNode.nodes[1]; // eslint-disable-line prefer-destructuring
        const files = parent._newASTPointer;
        files.push(newNode);

        // Add a placeholder for common circuit files within the circuits Folder:
        if (!files.some(file => file.nodeType === 'EditableCommitmentCommonFilesBoilerplate')) {
          files.push(buildNode('EditableCommitmentCommonFilesBoilerplate'));
        }
      } else {
        // Not sure what to do if we're not creating a file...
      }
    },

    exit(path, state) {
      const { node, parent, scope } = path;
      // By this point, we've added a body and parameters to the skeleton functionDefinition node created during 'enter'. Let's populate the body and paramters with some boilerplate...

      const newFunctionDefinitionNode = node._newASTPointer;

      // Now let's add some commitment-related boilerplate!
      const modifiedStateVariableBindings = scope.filterModifiedBindings(
        binding => binding.stateVariable && binding.isSecret,
      );

      for (const binding of Object.values(modifiedStateVariableBindings)) {
        const privateStateName = binding.node.name;

        // Add 'editable commitment'-related parameters to the function's parameters, for each global which is assigned-to within the function:
        newFunctionDefinitionNode.parameters.parameters.push(
          buildNode('EditableCommitmentParametersBoilerplate', {
            privateStateName,
          }),
        );

        // Add 'editable commitment' boilerplate code to the body of the function, which does the standard checks:
        // - oldCommitment preimage check
        // - oldCommitment membership & check vs the commitmentRoot
        // - oldCommitment nullifier preimage check
        // - newCommitment preimage check
        // ^^^ do this for each global:
        newFunctionDefinitionNode.body.statements.push(
          buildNode('EditableCommitmentStatementsBoilerplate', {
            privateStateName,
          }),
        );
      }

      // Add a commitmentRoot parameter (only 1 commitmentRoot param is needed for all globals being committed to)
      newFunctionDefinitionNode.parameters.parameters.push(
        buildNode('VariableDeclaration', {
          name: 'commitmentRoot',
          type: 'field',
        }),
      );
    },
  },

  ParameterList: {
    enter(path) {
      const { node, parent } = path;
      const newNode = buildNode('ParameterList');
      node._newASTPointer = newNode.parameters;
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  Block: {
    enter(path) {
      const { node, parent } = path;
      const newNode = buildNode('Block');
      node._newASTPointer = newNode.statements;
      parent._newASTPointer.body = newNode;
    },

    exit(path) {},
  },

  VariableDeclarationStatement: {
    enter(path) {
      const { node, parent } = path;
      const newNode = buildNode('VariableDeclarationStatement');
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },

    exit(path) {},
  },

  BinaryOperation: {
    enter(path) {
      const { node, parent } = path;
      const newNode = buildNode('BinaryOperation');
      node._newASTPointer = newNode;
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path) {},
  },

  Assignment: {
    enter(path, state) {
      const { node, parent } = path;
      const { operator } = node;
      const newNode = buildNode('Assignment', { operator });
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
        const referencedNode = scope.getReferencedNode(lhs);

        // We should only replace the _first_ node in this scope which modifies the referencedNode. Let's look at the scope's modifiedBindings for the first modifyingNode.
        const modifiedBinding = scope.modifiedBindings[referencedNode.id];

        if (lhs === modifiedBinding.modifyingPaths[0].node && referencedNode.isSecret) {
          newNode = buildNode('VariableDeclarationStatement', {
            declarations: [buildNode('VariableDeclaration', { name: lhs.name, type: 'field' })],
            initialValue: { ...rhs },
          });

          node._newASTPointer = newNode;
          parent._newASTPointer.push(newNode);
          state.skipSubNodes = true;

          return;
        }
      }

      newNode = buildNode('ExpressionStatement');
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
      const newNode = buildNode('VariableDeclaration', { name: node.name, isPrivate: true });
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

      // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode('ElementaryTypeName', {
        name: 'field', // convert uint types to 'field', for now.
      });
    },

    exit(path) {},
  },

  Identifier: {
    enter(path) {
      const { node, parent } = path;
      const { name } = node;
      // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode('Identifier', { name });
    },

    exit(path) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
