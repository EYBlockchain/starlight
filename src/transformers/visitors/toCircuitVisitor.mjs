/* eslint-disable no-param-reassign, no-shadow */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../utils/logger.mjs';
import { buildNode } from '../../types/zokrates-types.mjs';
import NP from '../../traverse/NodePath.mjs';

const visitor = {
  ContractDefinition: {
    enter(path) {
      const { node, parent } = path;
      node._newASTPointer = parent._newASTPointer;
    },
  },

  FunctionDefinition: {
    // parent._newASTPointer location is Folder.files[].
    enter(path, state) {
      const { node, parent, scope } = path;
      if (node.kind === 'constructor') {
        // We currently treat all constructors as publicly executed functions.
        state.skipSubNodes = true;
        return;
      }

      // Check the function for modifications to any stateVariables.
      // We'll need to create a new circuit file if we find a modification.
      // TODO: will we also need a new circuit file even if we're merely 'referring to' a secret state (because then a nullifier might be needed?)
      if (scope.modifiesSecretState()) {
        // Let's create a new circuit File to represent this function.
        // We'll add a new 'File' node to our newAST:

        // console.log('\n\n\nEntering FunctionDefinition node...')
        // console.log('SCOPE:', scope);

        const newFunctionDefinitionNode = buildNode('FunctionDefinition', { name: 'main' });
        const newImportStatementListNode = buildNode('ImportStatementList');

        const { indicators } = scope;

        newImportStatementListNode.imports.push(
          ...buildNode('Boilerplate', {
            bpSection: 'importStatements',
            indicators,
          }),
        );

        const newNode = buildNode('File', {
          fileName: node.name,
          nodes: [newImportStatementListNode, newFunctionDefinitionNode],
        });

        node._newASTPointer = newFunctionDefinitionNode; // TODO: we might want to make this point to newNode (the 'File') rather than newNode.nodes[1] (the 'FunctionDefinition'), so that in future we can more easily access the ImportStatements.

        const files = parent._newASTPointer;
        files.push(newNode);
      } else {
        // Not sure what to do 'else', yet.
        // If there are no global state modifications / 'references', then (currently) a circuit isn't needed for this function. In future, this could be a helper function which supports some other state-editing function, in which case a circuit would be needed.
        // I suppose other functions for which newFile = true (i.e. functions which actually modify secret state) will need to include any helper functions they reference within the circuit file (or import them).
        throw new Error(
          `Not yet supported. We haven't yet written code which can transpile functions which don't modify secret states.`,
        );
      }
    },

    exit(path) {
      const { node, scope } = path;
      const { indicators } = scope;
      const newFunctionDefinitionNode = node._newASTPointer;

      // We populate the boilerplate for the function
      newFunctionDefinitionNode.parameters.parameters.push(
        ...buildNode('Boilerplate', {
          bpSection: 'parameters',
          indicators,
        }),
      );

      newFunctionDefinitionNode.body.preStatements.push(
        ...buildNode('Boilerplate', {
          bpSection: 'preStatements',
          indicators,
        }),
      );

      newFunctionDefinitionNode.body.postStatements.push(
        ...buildNode('Boilerplate', {
          bpSection: 'postStatements',
          indicators,
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
  },

  Block: {
    enter(path) {
      const { node, parent } = path;
      const newNode = buildNode('Block');
      node._newASTPointer = newNode.statements;
      parent._newASTPointer.body = newNode;
    },
  },

  VariableDeclarationStatement: {
    enter(path) {
      const { node, parent } = path;
      const newNode = buildNode('VariableDeclarationStatement');
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },
  },

  BinaryOperation: {
    enter(path) {
      const { node, parent } = path;
      const { operator } = node;
      const newNode = buildNode('BinaryOperation', { operator });
      node._newASTPointer = newNode;
      parent._newASTPointer[path.containerName] = newNode;
    },
  },

  Assignment: {
    enter(path) {
      const { node, parent } = path;
      const { operator } = node;
      const newNode = buildNode('Assignment', { operator });
      node._newASTPointer = newNode;
      parent._newASTPointer.expression = newNode;
    },

    exit(path) {
      // Convert 'a += b' into 'a = a + b' for all operators, because zokrates doesn't support the shortened syntax.
      // We do this on exit, so that the child nodes of this assignment get transformed into the correct zokrates nodeTypes (otherwise they might get missed).
      const expandAssignment = node => {
        const { operator, leftHandSide, rightHandSide } = node;
        const expandableOps = ['+=', '-=', '*=', '/=', '%=', '|=', '&=', '^='];
        if (!expandableOps.includes(operator)) return node;
        const op = operator.charAt(0);
        const binOpNode = buildNode('BinaryOperation', {
          operator: op,
          leftExpression: leftHandSide,
          rightExpression: rightHandSide,
        });
        const assNode = buildNode('Assignment', {
          operator: '=',
          leftHandSide,
          rightHandSide: binOpNode,
        });
        return assNode;
      };

      const { parent } = path;
      const circuitNode = parent._newASTPointer.expression;
      const newNode = expandAssignment(circuitNode);
      // node._newASTPointer = newNode; // no need to ascribe the node._newASTPointer, because we're exiting.
      parent._newASTPointer.expression = newNode;
    },
  },

  ExpressionStatement: {
    enter(path, state) {
      const { node, parent, scope } = path;
      const { expression } = node;
      // TODO: make sure isDecremented / isIncremented are also ascribed to UnaryOperation node (not just Assignment nodes).
      // TODO: what other expressions are there?
      const { isIncremented, isDecremented } = expression;
      let newNode;

      // TODO: tidy this up...
      if (isIncremented || isDecremented) {
        switch (expression.nodeType) {
          case 'Assignment': {
            const { leftHandSide: lhs, rightHandSide: rhs } = expression;
            const lhsIndicator = scope.getReferencedIndicator(lhs);

            if (!lhsIndicator.isPartitioned) break;

            // console.log('\n\n\nIN EXPRESSION STATEMENT')
            // console.log('\n\n\npath', path)
            // console.log('\n\n\nlhs', lhs)
            // console.log('\n\n\nrhs', rhs)
            // console.log('\n\n\nscope.indicators', scope.indicators)

            const rhsPath = NP.getPath(rhs);
            // We need to _clone_ the path, because we want to temporarily modify some of its properties for this traversal. For future AST transformations, we'll want to revert to the original path.
            const tempRHSPath = cloneDeep(rhsPath);
            const tempRHSParent = tempRHSPath.parent;

            if (isDecremented) {
              newNode = buildNode('PartitionedDecrementationStatementBoilerplate', {
                indicators: lhsIndicator,
                subtrahendId: rhs.id,
                ...(lhsIndicator.isMapping && {
                  mappingKeyName: lhs.indexExpression?.name || lhs.indexExpression.expression.name,
                }), // TODO: this is an ugly hack.
              });
              tempRHSPath.containerName = 'subtrahend'; // a dangerous bodge that works
              node._newASTPointer = newNode.subtrahend;
            } else {
              // isIncremented
              newNode = buildNode('PartitionedIncrementationStatementBoilerplate', {
                indicators: lhsIndicator,
                addendId: rhs.id,
                ...(lhsIndicator.isMapping && {
                  mappingKeyName: lhs.indexExpression?.name || lhs.indexExpression.expression.name,
                }), // TODO: this is an ugly hack.
              });
              tempRHSPath.containerName = 'addend'; // a dangerous bodge that works
              node._newASTPointer = newNode.addend;
            }

            // The child of this 'ExpressionStatement' node is an 'Assignment' node. But we've built a newNode to replace the 'Assignment' node of the original tree. The child of this newNode will be the RHS of the original 'Assignment' node. We discard the LHS, so we need to 'skip' the traversal of the 'Assignment' (using skipSubNodes = true), and instead traverse directly into the RHS node.

            tempRHSParent._newASTPointer = newNode;
            tempRHSPath.traverse(visitor, {});
            state.skipSubNodes = true;
            parent._newASTPointer.push(newNode);
            return;
          }
          default:
            throw Error(
              `Expressions of nodeType ${expression.nodeType} are not yet supported. Please open a new issue in github (if none exists).`,
            );
        }
      }

      // Otherwise, copy this ExpressionStatement into the circuit's language.
      newNode = buildNode('ExpressionStatement');
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },
  },

  VariableDeclaration: {
    enter(path, state) {
      const { node, parent } = path;
      if (node.stateVariable) {
        // Then the node represents assignment of a state variable.
        // State variables don't get declared within a circuit;
        // their old/new values are passed in as parameters.
        node._newASTPointer = parent._newASTPointer;
        state.skipSubNodes = true;
        return;
      }

      // If it's not declaration of a state variable, it's either a function parameter or a local stack variable declaration. We _do_ want to add this to the newAST.
      const newNode = buildNode('VariableDeclaration', {
        name: node.name,
        isSecret: node.isSecret,
      });
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName].push(newNode);
      }
    },
  },

  ElementaryTypeName: {
    enter(path) {
      const { node, parent } = path;
      const supportedTypes = ['uint', 'uint256', 'address', 'bool'];
      if (!supportedTypes.includes(node.name))
        throw new Error(
          `Currently, only transpilation of types "${supportedTypes}" is supported. Got ${node.name} type.`,
        );

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode('ElementaryTypeName', {
        name: node.name === 'bool' ? 'bool' : 'field', // convert uint & address types to 'field', for now.
      });
    },
  },

  Identifier: {
    enter(path) {
      const { node, parent } = path;
      const { name } = node;

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode('Identifier', { name });
    },
  },

  Literal: {
    enter(path) {
      const { node, parent } = path;
      const { value } = node;

      if (node.kind !== 'number')
        throw new Error(
          `Only literals of kind "number" are currently supported. Found literal of kind ${node.kind}. Please open an issue.`,
        );

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode('Literal', { value });
    },
  },

  MemberAccess: {
    enter(path, state) {
      const { parent } = path;

      if (!path.isMsgSender()) throw new Error(`Struct property access isn't yet supported.`);

      // What follows assumes this node represents msg.sender:
      const newNode = buildNode('MsgSender');
      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = newNode;
      state.skipSubNodes = true;
    },
  },

  IndexAccess: {
    enter(path) {
      const { node, parent } = path;

      const newNode = buildNode('IndexAccess');
      node._newASTPointer = newNode;
      parent._newASTPointer[path.containerName] = newNode;
    },
  },
};

export default visitor;
