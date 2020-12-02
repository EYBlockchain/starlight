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

    exit(path, state) {
      // console.log('scope');
      // console.log(scope);
      // scope.referencedBindings.forEach(binding => {
      //   console.log('binding:');
      //   console.log(binding.node, binding.referencingPaths);
      // });
    },
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

    exit(path, state) {
      // Why here? Because we need the indicatorObj of the individual elts before we decide
      const { node } = path;
      const expressionNode = node.expression;
      const lhsNode = expressionNode.leftHandSide;
      const isIncrementedBool = path.scope.isIncremented(expressionNode, lhsNode);
      if (lhsNode.isUnknown && expressionNode.isDecremented === true) {
        throw new Error(
          "Can't nullify (that is, edit with knowledge of the state) an unknown state.",
        );
      }
    },
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
};
