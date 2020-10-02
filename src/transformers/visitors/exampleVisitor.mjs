/* eslint-disable no-param-reassign */

import { getNodeContext } from '../../types/types.mjs';

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
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
      };
      // node._context = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._context.push(newNode);
    },

    exit(node, parent) {},
  },

  ContractDefinition: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        nodes: [],
      };
      node._context = newNode.nodes;
      parent._context.push(newNode);
    },

    exit(node, parent) {},
  },

  FunctionDefinition: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        parameters: {},
        returnParameters: {},
        body: {},
      };

      // node._context = {};
      // node._context.parameters = newNode.parameters;
      // node._context.returnParameters = newNode.returnParameters;
      // node._context.body = newNode.body;

      // node._context = {};
      // node._context.parameters = property(newNode, 'parameters');
      // node._context.returnParameters = property(newNode, 'returnParameters');
      // node._context.body = property(newNode, 'body');

      node._context = newNode;
      parent._context.push(newNode);
    },

    exit(node, parent) {},
  },

  ParameterList: {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        parameters: [],
      };
      node._context = newNode.parameters;
      const { containerName } = getNodeContext(node, parent);
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
      const { containerName } = getNodeContext(node, parent);
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
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
        typeName: {},
      };
      node._context = newNode;
      if (Array.isArray(parent._context)) {
        parent._context.push(newNode);
      } else {
        const { containerName } = getNodeContext(node, parent);
        console.log('CONTAINERNAME', containerName)
        parent._context[containerName].push(newNode);
      }
    },

    exit(node, parent) {},
  },

  'Identifier|Literal|ElementaryTypeName': {
    enter(node, parent) {
      const newNode = {
        nodeType: node.nodeType,
      };

      // node._context = // no context needed, because this is a leaf, so we won't be recursing any further.
      const { containerName } = getNodeContext(node, parent);
      parent._context[containerName] = newNode;
    },

    exit(node, parent) {},
  },
};
