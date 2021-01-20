/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */
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
        node.referencedDeclaration < 4294967200
          ? scope.getReferencedBinding(node)
          : scope.getReferencedBinding(path.parentPath.parentPath.node.baseExpression);
      const parentExpression = path.getAncestorOfType('ExpressionStatement');

      if (parentExpression && referencedBinding.isSecret) {
        // here: we are in a line which modifies a secret state
        const rightAncestor = path.getAncestorContainedWithin('rightHandSide');
        const functionDefScope = scope.getAncestorOfScopeType('FunctionDefinition');

        if (!functionDefScope) return;
        if (parentExpression.node.expression.nodeType === 'UnaryOperation') return;

        let referencedIndicator = functionDefScope.indicators[referencedBinding.id];
        const lhsNode = parentExpression.node.expression.leftHandSide;
        const lhsName = lhsNode.name || lhsNode.baseExpression.name;
        const nodeName = path.getAncestorContainedWithin('baseExpression')
          ? path.getAncestorContainedWithin('baseExpression').node.name
          : node.name;

        // below: check if the identifier is on the RHS and is NOT an incrementation OR is an incrementation which requires the RHS value to be accessed
        if (
          rightAncestor &&
          (!parentExpression.node.expression.isIncremented ||
            (parentExpression.node.expression.isIncremented &&
              lhsName !== nodeName &&
              nodeName !== 'msg'))
        ) {
          console.log('Found an accessed secret state');
          const lhs =
            lhsNode.nodeType === 'Identifier'
              ? scope.getReferencedBinding(lhsNode)
              : scope.getReferencedBinding(lhsNode.baseExpression);
          if (!node.stateVariable && !referencedBinding.stateVariable) {
            // we have a secret parameter on the RHS
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
          const reason = `Accessed at ${node.src}`;
          if (lhsNode.nodeType === 'IndexAccess') {
            const keyName = scope.getMappingKeyIndicator(lhsNode);
            referencedIndicator = referencedIndicator.mappingKey[keyName];
          }
          referencedIndicator.isWhole = true;
          referencedIndicator.isAccessed = true;
          referencedBinding.isAccessed = true;
          if (referencedIndicator.isWholeReason) {
            referencedIndicator.isWholeReason.push(reason);
          } else {
            referencedIndicator.isWholeReason = [reason];
          }
        }
      } else if (parentExpression) {
        // In an expression, not secret
        // Find non-secret params used for assigning secret states
        const rightAncestor = path.getAncestorContainedWithin('rightHandSide');
        const indexExpression = path.getAncestorContainedWithin('indexExpression');
        const functionDefScope = scope.getAncestorOfScopeType('FunctionDefinition');
        if (!functionDefScope) return;
        if (indexExpression) return; // TODO do we allow non secret params to be used as mapping keys?
        const lhsNode = parentExpression.node.expression.leftHandSide;
        const lhsName = lhsNode.name || lhsNode.baseExpression.name;
        const lhs =
          lhsNode.nodeType === 'Identifier'
            ? scope.getReferencedBinding(lhsNode)
            : scope.getReferencedBinding(lhsNode.baseExpression);
        if (lhs.isSecret && rightAncestor && !referencedBinding.stateVariable)
          throw new Error(
            `Non-secret parameter ${node.name} cannot be used to assign secret variable ${lhsName}`,
          );
      }
    },

    exit(path, state) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
