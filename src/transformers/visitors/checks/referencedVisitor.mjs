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
      const { node, scope } = path;

      const referencedBinding =
        node.referencedDeclaration > 0
          ? scope.getReferencedBinding(node)
          : scope.getReferencedBinding(path.parentPath.parentPath.node.baseExpression); // msg.sender reference?

      const parentExpressionNode = path.getAncestorOfType('ExpressionStatement').node;

      if (parentExpressionNode && referencedBinding.isSecret) {
        const rightAncestor = path.getAncestorContainedWithin('rightHandSide');
        const functionDefScope = scope.getAncestorOfScopeType('FunctionDefinition');

        if (!functionDefScope) return;

        const referencedIndicator = functionDefScope.indicators[referencedBinding.id];
        const lhsNode = parentExpressionNode.expression.leftHandSide;

        if (
          rightAncestor &&
          (!parentExpressionNode.expression.isIncremented ||
            (parentExpressionNode.expression.isIncremented && lhsNode.name !== node.name))
        ) {
          console.log(`Found a 'consultation'`);
          const lhs =
            lhsNode.nodeType === 'Identifier'
              ? scope.getReferencedBinding(lhsNode)
              : scope.getReferencedBinding(lhsNode.baseExpression);

          if (!node.stateVariable) {
            // we have a secret _parameter_ on the RHS
            if (!lhs.isSecret)
              throw new Error(
                `A secret parameter (${node.name}) should not be used to assign to a non-secret variable (${lhs.name}). The secret could be deduced by observing how the non-secret variable changes.`,
              );
            if (!lhs.stateVariable)
              logger.warn(
                `Secret parameter ${node.name} is being used to assign a non-global state. Is this intended?`,
              );
            return;
          }

          // Henceforth `node` must be a stateVariable on the RHS
          if (!lhs.isSecret)
            throw new Error(
              `Secret state ${node.name} should not be used to assign to a non-secret variable (${lhs.name}). The secret could be deduced by observing how the non-secret variable changes.`,
            );

          // TODO should we add this reason each time a state is referenced, even if the expression is one that looks like an increment? (but the state is whole for another reason)
          const reason = `'Consulted' at ${node.src}`;
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
