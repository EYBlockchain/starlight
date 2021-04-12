/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs'
import { TODOError } from '../../../error/errors.mjs';

const markParentIncrementation = (
  path,
  state,
  isIncremented,
  isDecremented,
) => {
  const parent = path.getAncestorOfType('ExpressionStatement');
  parent.isIncremented = isIncremented;
  parent.isDecremented = isDecremented;
  state.unmarkedIncrementation = false;
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
        state.increments.push(rightHandSide);
        markParentIncrementation(path, state, true, false);
        return;
      }

      if (lhsSecret && operator === '-=') {
        state.decrements.push(rightHandSide);
        markParentIncrementation(path, state, true, true);
        return;
      }

      // a *= something, a /= something
      if (operator === '%=' || operator === '/=' || operator === '*=') {
        markParentIncrementation(path, state, false, false);
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
        state.increments.push({
          id: 11,
          isConstant: false,
          isPure: true,
          kind: 'number',
          lValueRequested: false,
          nodeType: 'Literal',
          value: '2',
        });
        markParentIncrementation(path, state, true, false);
        return;
      }
      if (lhsSecret && operator.includes('-')) {
        state.decrements.push({
          id: 11,
          isConstant: false,
          isPure: true,
          kind: 'number',
          lValueRequested: false,
          nodeType: 'Literal',
          value: '2',
        });
        markParentIncrementation(path, state, true, true);
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
      const { node } = path;
      const { operator, leftExpression, rightExpression } = node;
      const operands = [leftExpression, rightExpression];
      const precedingOperator = ['+', operator];

      // if we dont have any + or -, it can't be an incrementation
      if (!operator.includes('+') && !operator.includes('-')) {
        markParentIncrementation(path, state, false, false);
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
          );
          if (!isIncremented.decremented) {
            // TODO: the stored .increments array may include the incremented node itself
            // e.g. may include a in the rhs of a = b + a + c
            state.increments.push(node);
            return;
          }
          state.decrements.push(node);
          return;
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
      const expressionNode = node.expression;

      if (path.isIncremented === undefined) {
        path.isIncremented = false;
        path.isDecremented = false;
        state.unmarkedIncrementation = false;
      }

      expressionNode.isIncremented = path.isIncremented;
      expressionNode.isDecremented = path.isDecremented;

      // TODO which node is being incremented?
      if (lhsNode.isUnknown && expressionNode.isDecremented === true) {
        throw new Error(
          "Can't nullify (that is, edit with knowledge of the state) an unknown state.",
        );
      }

      // 2) Update the indicators of the scope:
      let referencedBinding;
      if (lhsNode.nodeType === 'Identifier') {
        referencedBinding = scope.getReferencedBinding(lhsNode);
      } else if (lhsNode.nodeType === 'IndexAccess') {
        referencedBinding = scope.getReferencedBinding(lhsNode.baseExpression); // returns the binding of the mapping TODO per index
      }
      if (
        referencedBinding.stateVariable &&
        scope.isInScopeType('FunctionDefinition')
      ) {
        const fnDefScope = scope.getAncestorOfScopeType('FunctionDefinition');
        let fnIndicatorObj = fnDefScope.indicators[referencedBinding.id];
        let parentIndicatorObj;

        // a mapping:
        // TODO: IndexAccess also describes access of an array (not just mappings)
        if (lhsNode.nodeType === 'IndexAccess') {
          const keyName = scope.getMappingKeyName(lhsNode);
          parentIndicatorObj = fnIndicatorObj;
          fnIndicatorObj = fnIndicatorObj.mappingKeys[keyName];
        }

        // if its incremented anywhere, isIncremented = true
        // @Indicator new properties
        fnIndicatorObj.isIncremented =
          fnIndicatorObj.isIncremented === true ? true : isIncrementedBool;
        fnIndicatorObj.isDecremented =
          fnIndicatorObj.isDecremented === true ? true : isDecrementedBool;
        if (isIncrementedBool === false) {
          // statement is an overwrite
          // @Indicator new properties
          fnIndicatorObj.isWhole = true;
          // @Binding new properties
          referencedBinding.isWhole = true;
          const reason = {};
          reason[0] = lhsNode.typeDescriptions.typeString !== 'address' ? `Overwritten` : `Address`;
          reason.src = expressionNode.src;
          logger.debug('reason:', reason);
          if (fnIndicatorObj.isWholeReason) {
            // @Indicator new properties
            fnIndicatorObj.isWholeReason.push(reason);
          } else {
            // @Indicator new properties
            fnIndicatorObj.isWholeReason = [reason];
          }

          if (parentIndicatorObj?.isWholeReason) {
            // @Indicator new properties
            parentIndicatorObj.isWholeReason.push(reason);
          } else if (parentIndicatorObj) {
            // @Indicator new properties
            parentIndicatorObj.isWhole = true;
            parentIndicatorObj.isWholeReason = [reason];
          }
        }
      }
    },
  },
};
