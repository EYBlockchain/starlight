/* eslint-disable no-param-reassign, no-shadow */
// no-unused-vars <-- to reinstate eventually

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

    exit(path, state) {},
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
    enter(path, state) {
      // Here, if secret:
      // 1) Chcek if in a RHS container
      // 2) Check if NOT incrementing
      const { node } = path;
      const referencedBinding = path.scope.getReferencedBinding(node);
      const parentExpression = path.getAncestorOfType('ExpressionStatement');
      if (parentExpression && referencedBinding.isSecret) {
        const rightAncestor = path.getAncestorContainedWithin('rightHandSide');
        // We first need to ensure we're within a FunctionDefinition scope, to ensure it's not a ContractDefinition indicator being erroneously updated.
        const functionDefScope = path.scope.getAncestorOfScopeType('FunctionDefinition');
        if (!functionDefScope) return;
        const referencedIndicator = functionDefScope.indicators[referencedBinding.id];
        if (rightAncestor && !parentExpression.node.expression.isIncremented) {
          console.log('Found a reference');
          const reason = `Referenced at ${node.src}`;
          referencedIndicator.isWhole = true;
          if (referencedIndicator.isWholeReason) {
            referencedIndicator.isWholeReason.push(reason);
          } else {
            referencedIndicator.isWholeReason = [reason];
          }
        }
      }
    },

    exit(path, state) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
