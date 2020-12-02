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
      const referencedBinding =
        node.referencedDeclaration > 0
          ? path.scope.getReferencedBinding(node)
          : path.scope.getReferencedBinding(path.parentPath.parentPath.node.baseExpression);
      const parentExpression = path.getAncestorOfType('ExpressionStatement');
      if (parentExpression && referencedBinding.isSecret) {
        const rightAncestor = path.getAncestorContainedWithin('rightHandSide');
        const functionDefScope = path.scope.getAncestorOfScopeType('FunctionDefinition');
        if (!functionDefScope) return;
        const referencedIndicator = functionDefScope.indicators[referencedBinding.id];
        const lhsNode = parentExpression.node.expression.leftHandSide;
        if (
          rightAncestor &&
          (!parentExpression.node.expression.isIncremented ||
            (parentExpression.node.expression.isIncremented && lhsNode.name !== node.name))
        ) {
          console.log('Found a reference');
          const lhs =
            lhsNode.nodeType === 'Identifier'
              ? path.scope.getReferencedBinding(lhsNode)
              : path.scope.getReferencedBinding(lhsNode.baseExpression);
          if (!node.stateVariable) {
            // we have a secret parameter on the RHS
            if (!lhs.isSecret)
              throw new Error(
                `Secret parameter ${node.name} cannot be used to assign non secret variable ${lhs.name}`,
              );
            if (!lhs.stateVariable)
              logger.warn(
                `Secret parameter ${node.name} is being used to assign a non-global state. Is this intended?`,
              );
            return;
          }
          if (!lhs.isSecret)
            throw new Error(
              `Secret state ${node.name} cannot be used to assign non secret variable ${lhs.name}`,
            );
          // TODO should we add this reason each time a state is referenced, even if the expression is one that looks like an increment? (but the state is whole for another reason)
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
