/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs';
import { TODOError, SyntaxUsageError } from '../../../error/errors.mjs';

// when we have an a++ and needs its increment to equal the node rep. 1
const literalOneNode = {
  isConstant: false,
  isPure: true,
  kind: 'number',
  lValueRequested: false,
  nodeType: 'Literal',
  value: '1',
};

// marks the parent ExpressionStatement
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
  parent.incrementedDeclaration = incrementedIdentifier.referencedDeclaration;
  state.unmarkedIncrementation = false;
  state.incrementedIdentifier =
    incrementedIdentifier.baseExpression || incrementedIdentifier;
  isDecremented
    ? state.decrements.push(increments)
    : state.increments.push(increments);
};

// gets NodePath for the thing being incremented
// if no incrementation, gets the LHS NodePath so we can mark it as whole
const getIncrementedPath = (path, state) => {
  if (
    !state.incrementedIdentifier &&
    path.isNodeType('Identifier') &&
    !path.isInType('indexExpression')
  ) {
    const lhsAncestor = path.getLhsAncestor();
    if (lhsAncestor.nodeType === 'IndexAccess') {
      // we want the incrementedPath to be the baseExpression if isMapping
      state.incrementedIdentifier ??= lhsAncestor.node?.baseExpression;
    } else if (lhsAncestor.nodeType === 'Identifier') {
      state.incrementedPath = lhsAncestor;
    }
  }
  if (state.incrementedIdentifier?.id === path.node.id)
    state.incrementedPath = path;
  state.stopTraversal = !!state.incrementedPath?.node;
};

const mixedOperatorsWarning = path => {
  backtrace.getSourceCode(path.node.src);
  logger.warn(
    `When we mix positive and negative operands in assigning to a secret variable, we may encounter underflow errors. Make sure that incrementing (a = a + ...) always increases the secret state value while decrementing (a = a - ...) decreases it. \nWhenever we see something like a = a + b - c, we assume it's a positive incrementation, so b > c. Similarly, we assume a = a - b + c is a decrementation, so c - b < a.`,
  );
};

/**
 * @desc:
 * Visitor checks each ExpressionStatement and decides whether it's an incrementation.
 * Marks the ExpressionStatement and calls methods in Binding and Indicator to mark
 * incrementation and whole/partitioned status (if known).
 */

export default {
  ExpressionStatement: {
    enter(path, state) {
      // starts here - if the path hasn't yet been marked as incremented, we find out if it is
      if (path.isIncremented === undefined) {
        state.unmarkedIncrementation = true;
        state.increments = [];
        state.decrements = [];
      }
    },

    exit(path, state) {
      // finishes here after looking through the expression
      const { node, scope } = path;
      const { incrementedIdentifier } = state;
      const expressionNode = node.expression;

      // if we haven't marked it yet, then it's not an incrementation - we mark as false
      path.isIncremented ??= false;
      path.isDecremented ??= false;
      state.unmarkedIncrementation = false;

      // we mark the expression node
      const { isIncremented, isDecremented } = path;
      expressionNode.isIncremented = isIncremented;
      expressionNode.isDecremented = isDecremented;

      // print if in debug mode
      logger.debug(`statement is incremented? ${isIncremented}`);
      if (isIncremented && !isDecremented) {
        const incs = [];
        state.increments.forEach(increment =>
          incs.push(increment.name || increment.value),
        );
        logger.debug(`increments? ${incs}`);
      }
      logger.debug(`statement is decremented? ${isDecremented}`);
      if (isDecremented) {
        const decs = [];
        state.decrements.forEach(decrement =>
          decs.push(decrement.name || decrement.value),
        );
        logger.debug(`decrements? ${decs}`);
      }

      // check for an unknown decremented state
      if (
        (incrementedIdentifier?.isUnknown ||
          incrementedIdentifier?.baseExpression?.isUnknown) &&
        isDecremented
      ) {
        throw new SyntaxUsageError(
          "Can't nullify (that is, edit with knowledge of the state) an unknown state. Since we are taking away some value of the state, we must know it. Only incrementations like a += x can be marked as unknown.",
          node,
        );
      }
      // gets the NodePath class for whatever is on the LHS
      path.traversePathsFast(getIncrementedPath, state);
      // update binding
      scope
        .getReferencedBinding(incrementedIdentifier)
        ?.updateIncrementation(path, state);

      // update indicator
      scope
        .getReferencedIndicator(incrementedIdentifier, false)
        ?.updateIncrementation(path, state);

      // reset state
      state.increments = [];
      state.decrements = [];
      state.incrementedIdentifier = {};
      state.incrementedPath = {};
      state.stopTraversal = false;
    },
  },

  Assignment: {
    enter(path, state) {
      // here: we check whether the assignment is an incrementation
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
        if (rightHandSide.operator?.includes('-')) mixedOperatorsWarning(path);
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
        if (rightHandSide.operator?.includes('-')) mixedOperatorsWarning(path);
        return;
      }

      // a *= something, a /= something
      if (operator === '%=' || operator === '/=' || operator === '*=') {
        markParentIncrementation(path, state, false, false, leftHandSide);
        return;
      }

      // after +=, -=, %=, *=, /=, we can only deal with =
      if (operator !== '=')
        throw new TODOError(
          `Operator '${operator}' not yet supported. Please open an issue.`,
          node,
        );

      // then, it depends what's on the RHS of the assignment, so we continue
      // we save the LHS node to help us later
      state.incrementedIdentifier = leftHandSide.baseExpression || leftHandSide;
    },
  },

  UnaryOperation: {
    enter(path, state) {
      // a unary operation (a++, a--) counts as an incrementation by 1
      if (!state.unmarkedIncrementation) return;
      const { node, scope } = path;
      const { subExpression, operator } = node;
      const lhsSecret = !!scope.getReferencedBinding(subExpression).isSecret;
      // a++
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
      // a--
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
      // a BinaryOperation can tell us if the RHS of an assignment is incremented
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
      // if we have mixed operators, we may have an underflow or not be able to tell whether this is increasing (incrementation) or decreasing (decrementation) the secret value
      if (
        precedingOperator.length > 2 &&
        precedingOperator.includes('+') &&
        precedingOperator.includes('-')
      )
        mixedOperatorsWarning(parentExpressionStatement);

      // if we find our lhs variable (a) on the rhs (a = a + b), then we make sure we don't find it again (a = a + b + a = b + 2a)
      let discoveredLHS = 0;
      let isIncremented = {};
      // Goes through each operand and checks whether it's the lhsNode and whether it's +/- anything
      for (const [index, operand] of operands.entries()) {
        // below: we have an identifier
        if (operand.referencedDeclaration || operand.baseExpression) {
          // a = a + something
          if (
            operand.nodeType !== 'IndexAccess' &&
            operand.name === lhsNode.name &&
            precedingOperator[index + 1]?.includes('+') && // we have ... + a + ...
            precedingOperator[index]?.includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: false };
          }

          // a = a + something (mapping)
          if (
            operand.nodeType === 'IndexAccess' &&
            operand.baseExpression.name === lhsNode.baseExpression.name &&
            operand.indexExpression.name === lhsNode.indexExpression.name &&
            precedingOperator[index + 1]?.includes('+') &&
            precedingOperator[index]?.includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: false };
          }

          // a = a - something
          if (
            operand.nodeType !== 'IndexAccess' &&
            operand.name === lhsNode.name &&
            precedingOperator[index + 1]?.includes('-') && // we have ... + a - ...
            precedingOperator[index]?.includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: true };
          }

          // a = a - something (mapping)
          if (
            operand.nodeType === 'IndexAccess' &&
            operand.baseExpression.name === lhsNode.baseExpression.name &&
            operand.indexExpression.name === lhsNode.indexExpression.name &&
            precedingOperator[index + 1]?.includes('-') &&
            precedingOperator[index]?.includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: true };
          }

          // a = something - a
          if (
            (operand.name === lhsNode.name ||
              (operand.nodeType === 'IndexAccess' &&
                operand.baseExpression.name === lhsNode.baseExpression.name &&
                operand.indexExpression.name ===
                  lhsNode.indexExpression.name)) &&
            precedingOperator[index]?.includes('-') // we have a = b - a
          ) {
            discoveredLHS -= 1;
          }
          // if none, go to the next operand
        }
        // if we have 1*a on the RHS and its incremented, mark the parent path
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
};
