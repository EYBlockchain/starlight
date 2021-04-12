/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs';
import { TODOError, SyntaxUsageError } from '../../../error/errors.mjs';

const literalOneNode = {
  isConstant: false,
  isPure: true,
  kind: 'number',
  lValueRequested: false,
  nodeType: 'Literal',
  value: '1',
};

const markParentIncrementation = (
  path,
  state,
  isIncremented,
  isDecremented,
  incrementedIdentifier = {},
  increments = {},
) => {
  const parent = path.getAncestorOfType('ExpressionStatement');
  parent.isIncremented = isIncremented;
  parent.isDecremented = isDecremented;
  state.unmarkedIncrementation = false;
  state.incrementedIdentifier = incrementedIdentifier;
  isDecremented
    ? state.decrements.push(increments)
    : state.increments.push(increments);
};

const mixedOperatorsWarning = path => {
  backtrace.getSourceCode(path.node.src);
  console.warn(
    `When we mix positive and negative operands in assigning to a secret variable, we may encounter underflow errors. Try to use += for incrementations and -= for decrementations where possible. \nWhenever we see something like a = a + b - c, we assume it's a positive incrementation, so b > c.`,
  );
};

/**
 * @desc:
 * Visitor will...
 */

export default {
  Assignment: {
    enter(path, state) {
      if (!state.unmarkedIncrementation) return;
      const { node, scope } = path;
      const { operator, leftHandSide, rightHandSide } = node;
      const lhsSecret = !!scope.getReferencedBinding(leftHandSide).isSecret;

      // a += something, -= something
      if (lhsSecret && operator === '+=') {
        markParentIncrementation(
          path,
          state,
          true,
          false,
          leftHandSide,
          rightHandSide,
        );
        return;
      }

      if (lhsSecret && operator === '-=') {
        markParentIncrementation(
          path,
          state,
          true,
          true,
          leftHandSide,
          rightHandSide,
        );
        return;
      }

      // a *= something, a /= something
      if (operator === '%=' || operator === '/=' || operator === '*=') {
        markParentIncrementation(path, state, false, false, leftHandSide);
        return;
      }

      if (operator !== '=')
        throw new TODOError(
          `Operator '${operator}' not yet supported. Please open an issue.`,
          node,
        );

      // then, it depends what's on the RHS
      // we may have a = a + b (binop below)
    },
  },

  UnaryOperation: {
    enter(path, state) {
      if (!state.unmarkedIncrementation) return;
      const { node, scope } = path;
      const { subExpression, operator } = node;
      const lhsSecret = !!scope.getReferencedBinding(subExpression).isSecret;
      if (lhsSecret && operator.includes('+')) {
        markParentIncrementation(
          path,
          state,
          true,
          false,
          subExpression,
          literalOneNode,
        );
        return;
      }
      if (lhsSecret && operator.includes('-')) {
        markParentIncrementation(
          path,
          state,
          true,
          true,
          subExpression,
          literalOneNode,
        );
      }
    },
  },

  BinaryOperation: {
    enter(path, state) {
      if (!state.unmarkedIncrementation) return;
      const parentExpressionStatement = path.getAncestorOfType(
        'ExpressionStatement',
      );
      const lhsNode = parentExpressionStatement?.node.expression?.leftHandSide;
      // if we don't have a parent expression or that expression can't hold an incrementation, we exit
      if (!lhsNode) return;
      const { node, scope } = path;
      const { operator, leftExpression, rightExpression } = node;
      const operands = [leftExpression, rightExpression];
      const precedingOperator = ['+', operator];
      const lhsSecret = !!scope.getReferencedBinding(lhsNode).isSecret;

      // TODO: do we need this? Do we care if its secret?
      if (!lhsSecret) return;

      // if we dont have any + or -, it can't be an incrementation
      if (!operator.includes('+') && !operator.includes('-')) {
        markParentIncrementation(path, state, false, false, lhsNode);
        return;
      }

      // fills an array of operands
      // e.g. if we have a = b - c + a + d, operands = [b, c, a, d]
      for (const [index, operand] of operands.entries()) {
        if (operand.nodeType === 'BinaryOperation') {
          operands[index] = operand.leftExpression;
          operands.push(operand.rightExpression);
          precedingOperator.push(operand.operator);
        }
      }

      if (
        precedingOperator.length > 1 &&
        precedingOperator.includes('+') &&
        precedingOperator.includes('-')
      )
        mixedOperatorsWarning(parentExpressionStatement);

      // if we find our lhs variable (a) on the rhs (a = a + b), then we make sure we don't find it again (a = a + b + a)
      let discoveredLHS = 0;
      let isIncremented = {};
      // Goes through each operand and checks whether it's the lhsNode and whether it's +/- anything
      for (const [index, operand] of operands.entries()) {
        // then we have an identifier
        if (operand.referencedDeclaration || operand.baseExpression) {
          // a = a + something
          if (
            operand.name === lhsNode.name &&
            precedingOperator[index + 1].includes('+') && // we have ... + a + ...
            precedingOperator[index].includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: false };
            return;
          }

          // a = a + something (mapping)
          if (
            operand.nodeType === 'IndexAccess' &&
            operand.baseExpression.name === lhsNode.baseExpression.name &&
            operand.indexExpression.name === lhsNode.indexExpression.name &&
            precedingOperator[index + 1].includes('+') &&
            precedingOperator[index].includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: false };
            return;
          }

          // a = a - something
          if (
            operand.name === lhsNode.name &&
            precedingOperator[index + 1].includes('-') && // we have ... + a - ...
            precedingOperator[index].includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: true };
            return;
          }

          // a = a - something (mapping)
          if (
            operand.nodeType === 'IndexAccess' &&
            operand.baseExpression.name === lhsNode.baseExpression.name &&
            operand.indexExpression.name === lhsNode.indexExpression.name &&
            precedingOperator[index + 1].includes('-') &&
            precedingOperator[index].includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: true };
            return;
          }

          // a = something - a
          if (
            (operand.name === lhsNode.name ||
              (operand.nodeType === 'IndexAccess' &&
                operand.baseExpression.name === lhsNode.baseExpression.name &&
                operand.indexExpression.name ===
                  lhsNode.indexExpression.name)) &&
            precedingOperator[index].includes('-') // we have a = b - a
          ) {
            discoveredLHS -= 1;
          }
          // if none, go to the next param
        }
        if (discoveredLHS === 1 && isIncremented.incremented) {
          markParentIncrementation(
            path,
            state,
            isIncremented.incremented,
            isIncremented.decremented,
            lhsNode,
            node,
          );
        } else {
          markParentIncrementation(path, state, false, false, lhsNode);
        }
      }
    },
  },

  ExpressionStatement: {
    enter(path, state) {
      // is incremented logic
      if (path.isIncremented === undefined) {
        state.unmarkedIncrementation = true;
        state.increments = [];
        state.decrements = [];
      }
    },

    exit(path, state) {
      // Here: indicator, binding, nodePath
      const { node, scope } = path;
      const { incrementedIdentifier } = state;
      const expressionNode = node.expression;

      path.isIncremented ??= false;
      path.isDecremented ??= false;
      state.unmarkedIncrementation = false;

      const { isIncremented, isDecremented } = path;
      expressionNode.isIncremented = isIncremented;
      expressionNode.isDecremented = isDecremented;

      logger.debug(`statement is incremented? ${isIncremented}`);
      logger.debug(`statement is decremented? ${isDecremented}`);

      if (incrementedIdentifier.isUnknown && isDecremented) {
        throw new SyntaxUsageError(
          "Can't nullify (that is, edit with knowledge of the state) an unknown state. Since we are taking away some value of the state, we must know it.",
          node,
        );
      }
      // update binding
      scope
        .getReferencedBinding(incrementedIdentifier)
        .updateIncrementation(path, state);

      // update indicator
      scope
        .getReferencedIndicator(incrementedIdentifier, false)
        .updateIncrementation(path, state);

      // reset state
      state.increments = [];
      state.decrements = [];
      state.incrementedIdentifier = {};
    },
  },
};
