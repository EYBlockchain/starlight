/* eslint-disable no-param-reassign, no-shadow */
import config from 'config';
import logger from '../../../utils/logger.js';
import backtrace from '../../../error/backtrace.js';
import { TODOError, SyntaxUsageError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';

interface IncrementationRecord {
  incremented: boolean | null;
  decremented: boolean | null;
}

// when we have an a++ and needs its increment to equal the node rep. 1
const literalOneNode = {
  isConstant: false,
  isPure: true,
  kind: 'number',
  lValueRequested: false,
  nodeType: 'Literal',
  value: '1',
  precedingOperator: '',
};

const collectIncrements = (increments: any, incrementedIdentifier: any) => {
  const { operands, precedingOperator } = increments;
  const newIncrements: any[] = [];
  for (const [index, operand] of operands.entries()) {
    operand.precedingOperator = precedingOperator[index];
    if (
      operand.name !== incrementedIdentifier.name &&
      operand.baseExpression?.name !== incrementedIdentifier.name &&
      !newIncrements.some(inc => inc.id === operand.id)
    )
      newIncrements.push(operand);
  }
  return newIncrements;
};

// marks the parent ExpressionStatement
const markParentIncrementation = (
  path: NodePath,
  state: any,
  isIncremented: boolean,
  isDecremented: boolean,
  incrementedIdentifier?: any,
  increments?: any,
) => {
  incrementedIdentifier = incrementedIdentifier.baseExpression
    ? incrementedIdentifier.baseExpression
    : incrementedIdentifier;
  const parent = path.getAncestorOfType('ExpressionStatement');
  if (!parent) throw new Error(`No parent of node ${path.node.name} found`);
  parent.isIncremented = isIncremented;
  parent.isDecremented = isDecremented;
  parent.incrementedDeclaration = incrementedIdentifier.referencedDeclaration;
  parent.node.expression.incrementedDeclaration = parent.incrementedDeclaration;
  state.unmarkedIncrementation = false;
  state.incrementedIdentifier = incrementedIdentifier;
  if (increments?.operands)
    increments = collectIncrements(increments, incrementedIdentifier);
  increments?.forEach((inc: any) => {
    if (
      inc.precedingOperator === '-' &&
      !state.decrements.some((existingInc: any) => existingInc.id === inc.id)
    ) {
      state.decrements.push(inc);
    } else if (
      !state.increments.some((existingInc: any) => existingInc.id === inc.id)
    ) {
      state.increments.push(inc);
    }
  });
};

// gets NodePath for the thing being incremented
// if no incrementation, gets the LHS NodePath so we can mark it as whole
const getIncrementedPath = (path: NodePath, state: any) => {
  if (
    !state.incrementedIdentifier &&
    path.isNodeType('Identifier') &&
    !path.isInType('indexExpression')
  ) {
    const lhsAncestor = path.getLhsAncestor();
    if (lhsAncestor instanceof NodePath && lhsAncestor.nodeType === 'IndexAccess') {
      // we want the incrementedPath to be the baseExpression if isMapping
      state.incrementedIdentifier ??= lhsAncestor.node?.baseExpression;
    } else if (lhsAncestor instanceof NodePath && lhsAncestor.nodeType === 'Identifier') {
      state.incrementedPath = lhsAncestor;
    }
  }
  if (state.incrementedIdentifier?.id === path.node.id)
    state.incrementedPath = path;
  state.stopTraversal = !!state.incrementedPath?.node;
};

const mixedOperatorsWarning = (path: NodePath) => {
  backtrace.getSourceCode(path.node.src);
  logger.warn(
    `When we mix positive and negative operands in assigning to a secret variable, we may encounter underflow errors. Make sure that incrementing (a = a + ...) always increases the secret state value while decrementing (a = a - ...) decreases it. \nWhenever we see something like a = a + b - c, we assume it's a positive incrementation, so b > c. Similarly, we assume a = a - b + c is a decrementation, so c - b < a.`,
  );
};

const binOpToIncrements = (path: NodePath, state: any) => {
  const parentExpressionStatement = path.getAncestorOfType(
    'ExpressionStatement',
  );
  const lhsNode = parentExpressionStatement?.node.expression?.leftHandSide;
  const assignmentOp = parentExpressionStatement?.node.expression?.operator;
  const { operator, leftExpression, rightExpression } = path.node;
  const operands = [leftExpression, rightExpression];
  const precedingOperator = ['+', operator];

  // if we dont have any + or -, it can't be an incrementation
  if (
    !operator.includes('+') &&
    !operator.includes('-') &&
    !assignmentOp.includes('+') &&
    !assignmentOp.includes('-')
  ) {
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
    precedingOperator.includes('-') &&
    parentExpressionStatement
  )
    mixedOperatorsWarning(parentExpressionStatement);

  return { operands, precedingOperator };
};

/**
 * @desc:
 * Visitor checks each ExpressionStatement and decides whether it's an incrementation.
 * Marks the ExpressionStatement and calls methods in Binding and Indicator to mark
 * incrementation and whole/partitioned status (if known).
 */

export default {
  ExpressionStatement: {
    enter(path: NodePath, state: any) {
      // starts here - if the path hasn't yet been marked as incremented, we find out if it is
      if (path.isIncremented === undefined) {
        state.unmarkedIncrementation = true;
        state.increments = [];
        state.decrements = [];
      }
    },

    exit(path: NodePath, state: any) {
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
      if (logger.level === 'debug') backtrace.getSourceCode(node.src);
      logger.debug(`statement is incremented? ${isIncremented}`);
      if (isIncremented && !isDecremented) {
        const incs: string[] = [];
        state.increments.forEach((increment: any) =>
          incs.push(increment.name || increment.value || increment.nodeType),
        );
        logger.debug(`increments? ${incs}`);
      }
      logger.debug(`statement is decremented? ${isDecremented}`);
      if (isDecremented) {
        const decs: string[] = [];
        state.decrements.forEach((decrement: any) =>
          decs.push(decrement.name || decrement.value || decrement.nodeType),
        );
        logger.debug(`decrements? ${decs}`);
      }

      // check for an unknown decremented state
      if (
        (incrementedIdentifier?.isUnknown ||
          incrementedIdentifier?.baseExpression?.isUnknown) &&
        isDecremented &&
        // if we have a = a + b - c, a can be unknown as long as b > c
        // if we have a = a - <anything> this error should throw:
        state.increments[0]?.precedingOperator === '-'
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
    enter(path: NodePath, state: any) {
      // here: we check whether the assignment is an incrementation
      if (!state.unmarkedIncrementation) return;
      const { node, scope } = path;
      const { operator, leftHandSide, rightHandSide } = node;
      const lhsSecret = !!scope.getReferencedBinding(leftHandSide)?.isSecret;


      if (['bool', 'address'].includes(leftHandSide.typeDescriptions.typeString)) {
        markParentIncrementation(path, state, false, false, leftHandSide);
        const lhsBinding = scope.getReferencedBinding(leftHandSide)
        if (lhsBinding) lhsBinding.isWhole = true;
        return;
      }
      // a += something, -= something
      if (
        lhsSecret &&
        operator === '+=' &&
        rightHandSide.nodeType !== 'BinaryOperation'
      ) {
        rightHandSide.precedingOperator = '+';
        markParentIncrementation(path, state, true, false, leftHandSide, [
          rightHandSide,
        ]);
        if (rightHandSide.operator?.includes('-')) mixedOperatorsWarning(path);
        return;
      }

      if (
        lhsSecret &&
        operator === '-=' &&
        rightHandSide.nodeType !== 'BinaryOperation'
      ) {
        rightHandSide.precedingOperator = '-';
        markParentIncrementation(path, state, true, true, leftHandSide, [
          rightHandSide,
        ]);
        if (rightHandSide.operator?.includes('+')) mixedOperatorsWarning(path);
        return;
      }

      // a *= something, a /= something
      if (
        operator === '%=' ||
        operator === '/=' ||
        operator === '*=' 
      ) {
        markParentIncrementation(path, state, false, false, leftHandSide);
        return;
      }

      // after +=, -=, %=, *=, /=, we can only deal with =
      if ((operator !== '=' && operator !== '+=' && operator !== '-=')  && lhsSecret)
        throw new TODOError(
          `Operator '${operator}' not yet supported. Please open an issue.`,
          node,
        );

      // then, it depends what's on the RHS of the assignment, so we continue
      // we save the LHS node to help us later
      if (lhsSecret) state.incrementedIdentifier = leftHandSide.baseExpression || leftHandSide;
    },
  },

  UnaryOperation: {
    enter(path: NodePath, state: any) {
      // a unary operation (a++, a--) counts as an incrementation by 1
      if (!state.unmarkedIncrementation) return;
      const { node, scope } = path;
      const { subExpression, operator } = node;
      const lhsSecret = !!scope.getReferencedBinding(subExpression)?.isSecret;
      // a++
      if (lhsSecret && operator.includes('+')) {
        literalOneNode.precedingOperator = '+';
        markParentIncrementation(
          path,
          state,
          true,
          false,
          subExpression.baseExpression || subExpression,
          [ literalOneNode ],
        );
        return;
      }
      // a--
      if (lhsSecret && operator.includes('-')) {
        literalOneNode.precedingOperator = '-';
        markParentIncrementation(
          path,
          state,
          true,
          true,
          subExpression.baseExpression || subExpression,
          [ literalOneNode ],
        );
      }
    },
  },

  BinaryOperation: {
    enter(path: NodePath, state: any) {
      // a BinaryOperation can tell us if the RHS of an assignment is incremented
      if (!state.unmarkedIncrementation) return;
      const parentExpressionStatement = path.getAncestorOfType(
        'ExpressionStatement',
      );
      const lhsNode = parentExpressionStatement?.node.expression?.leftHandSide;
      const assignmentOp = parentExpressionStatement?.node.expression?.operator;
      // if we don't have a parent expression or that expression can't hold an incrementation, we exit
      if (!lhsNode) return;
      if (!binOpToIncrements(path, state)?.operands) return;
      if (['bool', 'address'].includes(lhsNode.typeDescriptions?.typeString)) {
        markParentIncrementation(path, state, false, false, lhsNode);
        const lhsBinding = path.scope.getReferencedBinding(lhsNode);
        if (lhsBinding) lhsBinding.isWhole = true;
        return;
      }

      const { operands, precedingOperator } = binOpToIncrements(path, state) || {};

      if (!operands || !precedingOperator) return;

      // if we find our lhs variable (a) on the rhs (a = a + b), then we make sure we don't find it again (a = a + b + a = b + 2a)
      let discoveredLHS = 0;
      let isIncremented: IncrementationRecord = {incremented: null, decremented: null};
      if (assignmentOp === '+=' || assignmentOp === '-=')
        isIncremented.incremented = true;
      // Goes through each operand and checks whether it's the lhsNode and whether it's +/- anything
      for (const [index, operand] of operands.entries()) {
        // below: we have an identifier
        if (operand.referencedDeclaration || operand.baseExpression) {
          let nameMatch = false;
          switch (operand.nodeType) {
            case 'IndexAccess':
              nameMatch = operand.baseExpression.name === lhsNode.baseExpression?.name && operand.indexExpression.name === lhsNode.indexExpression?.name;
              break;
            case 'MemberAccess':
              nameMatch = operand.expression.name === lhsNode.expression?.name && operand.memberName === lhsNode.memberName;
              break;
            case 'Identifier':
            default:
              nameMatch = operand.name === lhsNode.name;
              break;
          }
          // a = a + something
          if (
            nameMatch &&
            precedingOperator[index + 1]?.includes('+') && // we have ... + a + ...
            precedingOperator[index]?.includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: false };
          }

          // a = a - something
          if (
            nameMatch &&
            precedingOperator[index + 1]?.includes('-') && // we have ... + a - ...
            precedingOperator[index]?.includes('+') // otherwise we have a = b - a
          ) {
            discoveredLHS += 1;
            isIncremented = { incremented: true, decremented: true };
          }

          // a = something - a
          if (
            nameMatch &&
            precedingOperator[index]?.includes('-') // we have a = b - a
          ) {
            discoveredLHS -= 1;
          }
          // if none, go to the next operand
          if (operand.indexExpression?.expression?.name === 'msg')
            operand.indexExpression.name ??= `msg.sender`;
          if (operand.memberName && !operand.name) operand.name = `${operand.expression.name}.${operand.memberName}`;
          operand.name ??= `${operand.baseExpression.name}[${operand.indexExpression.name}]`;
        }
        // if we have 1*a on the RHS and its incremented, mark the parent path
        if (
          discoveredLHS === 1 &&
          isIncremented.incremented &&
          assignmentOp === '='
        ) {
          // a = a + b - c - d counts as an incrementation since the 1st operator is a plus
          // the mixed operators warning will have been given
          if (
            precedingOperator.includes('+') &&
            precedingOperator.includes('-') &&
            precedingOperator[0] === '+'
          )
            isIncremented.decremented = false;
            markParentIncrementation(
              path,
              state,
              isIncremented.incremented,
              false,
              lhsNode.baseExpression || lhsNode,
              { operands, precedingOperator },
            );
        } else if (
          discoveredLHS === 0 &&
          isIncremented.incremented &&
          (assignmentOp === '+=' || assignmentOp === '-=')
        ) {
          if (assignmentOp === '+=')
            markParentIncrementation(
              path,
              state,
              isIncremented.incremented,
              false, // we assume a += is always an overall increase in value
              lhsNode.baseExpression || lhsNode,
              { operands, precedingOperator },
            );
          if (assignmentOp === '-=')
            markParentIncrementation(
              path,
              state,
              isIncremented.incremented,
              true, // we assume a -= is always an overall decrease in value
              lhsNode.baseExpression || lhsNode,
              { operands, precedingOperator },
            );
        } else {
          markParentIncrementation(path, state, false, false, lhsNode);
        }
      }
    },
  },

  VariableDeclaration: {
    enter(path: NodePath) {
      const { node, scope } = path;
      if (!path.isStruct() || path.getAncestorOfType('StructDefinition')) return;
      const declaration = path.getStructDeclaration();
      declaration?.members.forEach((member: any) => {
        if (['bool', 'address'].includes(member.typeDescriptions.typeString)) {
          // TODO remove this when adding mixed whole/partitioned structs
          const binding = scope.getReferencedBinding(node);
          if (binding) binding.isWhole = true;
          return;
        }
      });
    }
  }
};
