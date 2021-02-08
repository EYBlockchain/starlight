/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.mjs';

export default {
  SourceUnit: {
    enter(path, state) {},

    exit(path, state) {},
  },

  PragmaDirective: {
    enter(path, state) {},
    exit(path, state) {},
  },

  ContractDefinition: {
    enter(path, state) {},

    exit(path, state) {},
  },

  FunctionDefinition: {
    enter(path, state) {},

    exit(path, state) {},
  },

  ParameterList: {
    enter(path) {},

    exit(path) {},
  },

  Block: {
    enter(path) {},

    exit(path) {},
  },

  VariableDeclarationStatement: {
    enter(path) {},

    exit(path) {},
  },

  BinaryOperation: {
    enter(path) {},

    exit(path) {},
  },

  Assignment: {
    enter(path, state) {},

    exit(path, state) {},
  },

  ExpressionStatement: {
    enter(path, state) {},

    exit(node, parent) {},
  },

  VariableDeclaration: {
    enter(path, state) {},

    exit(path) {},
  },

  ElementaryTypeName: {
    enter(path) {},

    exit(path) {},
  },

  Identifier: {
    enter(path, state) {},

    exit(path, state) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },

  FunctionCall: {
    enter(path, state) {
      const { node, parent } = path;

      // TODO: require statements are 'FunctionCall' nodes, and they should be able to have secret states as arguments
      // TODO: FunctionCalls to functions within the same contract ought to be allowed.
      // TODO: FunctionCalls to base contracts (i.e. this contract `is` baseContract) ought to be allowed.

      const args = node.arguments;
      args.forEach(arg => {
        const binding = arg.referencedDeclaration ? path.scope.getReferencedBinding(arg) : {};
        if (binding.isSecret)
          throw new Error(
            `Cannot pass a secret state (${binding.name}) to an external function call.`,
          );
      });
    },

    exit(path, state) {},
  },
};
