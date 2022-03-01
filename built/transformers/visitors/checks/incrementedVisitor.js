/* eslint-disable no-param-reassign, no-shadow */
import config from 'config';
import logger from '../../../utils/logger.js';
import backtrace from '../../../error/backtrace.js';
import { TODOError, SyntaxUsageError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';
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
const collectIncrements = (increments, incrementedIdentifier) => {
    var _a;
    const { operands, precedingOperator } = increments;
    const newIncrements = [];
    for (const [index, operand] of operands.entries()) {
        operand.precedingOperator = precedingOperator[index];
        if (operand.name !== incrementedIdentifier.name &&
            ((_a = operand.baseExpression) === null || _a === void 0 ? void 0 : _a.name) !== incrementedIdentifier.name &&
            !newIncrements.some(inc => inc.id === operand.id))
            newIncrements.push(operand);
    }
    return newIncrements;
};
// marks the parent ExpressionStatement
const markParentIncrementation = (path, state, isIncremented, isDecremented, incrementedIdentifier, increments) => {
    incrementedIdentifier = incrementedIdentifier.baseExpression
        ? incrementedIdentifier.baseExpression
        : incrementedIdentifier;
    const parent = path.getAncestorOfType('ExpressionStatement');
    parent.isIncremented = isIncremented;
    parent.isDecremented = isDecremented;
    parent.incrementedDeclaration = incrementedIdentifier.referencedDeclaration;
    parent.node.expression.incrementedDeclaration = parent.incrementedDeclaration;
    state.unmarkedIncrementation = false;
    state.incrementedIdentifier = incrementedIdentifier;
    if (increments === null || increments === void 0 ? void 0 : increments.operands)
        increments = collectIncrements(increments, incrementedIdentifier);
    increments === null || increments === void 0 ? void 0 : increments.forEach((inc) => {
        if (inc.precedingOperator === '-' &&
            !state.decrements.some((existingInc) => existingInc.id === inc.id)) {
            state.decrements.push(inc);
        }
        else if (!state.increments.some((existingInc) => existingInc.id === inc.id)) {
            state.increments.push(inc);
        }
    });
};
// gets NodePath for the thing being incremented
// if no incrementation, gets the LHS NodePath so we can mark it as whole
const getIncrementedPath = (path, state) => {
    var _a, _b, _c, _d;
    if (!state.incrementedIdentifier &&
        path.isNodeType('Identifier') &&
        !path.isInType('indexExpression')) {
        const lhsAncestor = path.getLhsAncestor();
        if (lhsAncestor instanceof NodePath && lhsAncestor.nodeType === 'IndexAccess') {
            // we want the incrementedPath to be the baseExpression if isMapping
            (_a = state.incrementedIdentifier) !== null && _a !== void 0 ? _a : (state.incrementedIdentifier = (_b = lhsAncestor.node) === null || _b === void 0 ? void 0 : _b.baseExpression);
        }
        else if (lhsAncestor instanceof NodePath && lhsAncestor.nodeType === 'Identifier') {
            state.incrementedPath = lhsAncestor;
        }
    }
    if (((_c = state.incrementedIdentifier) === null || _c === void 0 ? void 0 : _c.id) === path.node.id)
        state.incrementedPath = path;
    state.stopTraversal = !!((_d = state.incrementedPath) === null || _d === void 0 ? void 0 : _d.node);
};
const mixedOperatorsWarning = (path) => {
    backtrace.getSourceCode(path.node.src);
    logger.warn(`When we mix positive and negative operands in assigning to a secret variable, we may encounter underflow errors. Make sure that incrementing (a = a + ...) always increases the secret state value while decrementing (a = a - ...) decreases it. \nWhenever we see something like a = a + b - c, we assume it's a positive incrementation, so b > c. Similarly, we assume a = a - b + c is a decrementation, so c - b < a.`);
};
const binOpToIncrements = (path, state) => {
    var _a, _b;
    const parentExpressionStatement = path.getAncestorOfType('ExpressionStatement');
    const lhsNode = (_a = parentExpressionStatement === null || parentExpressionStatement === void 0 ? void 0 : parentExpressionStatement.node.expression) === null || _a === void 0 ? void 0 : _a.leftHandSide;
    const assignmentOp = (_b = parentExpressionStatement === null || parentExpressionStatement === void 0 ? void 0 : parentExpressionStatement.node.expression) === null || _b === void 0 ? void 0 : _b.operator;
    const { operator, leftExpression, rightExpression } = path.node;
    const operands = [leftExpression, rightExpression];
    const precedingOperator = ['+', operator];
    // if we dont have any + or -, it can't be an incrementation
    if (!operator.includes('+') &&
        !operator.includes('-') &&
        !assignmentOp.includes('+') &&
        !assignmentOp.includes('-')) {
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
    if (precedingOperator.length > 2 &&
        precedingOperator.includes('+') &&
        precedingOperator.includes('-'))
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
        enter(path, state) {
            // starts here - if the path hasn't yet been marked as incremented, we find out if it is
            if (path.isIncremented === undefined) {
                state.unmarkedIncrementation = true;
                state.increments = [];
                state.decrements = [];
            }
        },
        exit(path, state) {
            var _a, _b, _c, _d, _e, _f;
            // finishes here after looking through the expression
            const { node, scope } = path;
            const { incrementedIdentifier } = state;
            const expressionNode = node.expression;
            // if we haven't marked it yet, then it's not an incrementation - we mark as false
            (_a = path.isIncremented) !== null && _a !== void 0 ? _a : (path.isIncremented = false);
            (_b = path.isDecremented) !== null && _b !== void 0 ? _b : (path.isDecremented = false);
            state.unmarkedIncrementation = false;
            // we mark the expression node
            const { isIncremented, isDecremented } = path;
            expressionNode.isIncremented = isIncremented;
            expressionNode.isDecremented = isDecremented;
            // print if in debug mode
            if (config.get('log_level') === 'debug')
                backtrace.getSourceCode(node.src);
            logger.debug(`statement is incremented? ${isIncremented}`);
            if (isIncremented && !isDecremented) {
                const incs = [];
                state.increments.forEach((increment) => incs.push(increment.name || increment.value || increment.nodeType));
                logger.debug(`increments? ${incs}`);
            }
            logger.debug(`statement is decremented? ${isDecremented}`);
            if (isDecremented) {
                const decs = [];
                state.decrements.forEach((decrement) => decs.push(decrement.name || decrement.value || decrement.nodeType));
                logger.debug(`decrements? ${decs}`);
            }
            // check for an unknown decremented state
            if (((incrementedIdentifier === null || incrementedIdentifier === void 0 ? void 0 : incrementedIdentifier.isUnknown) ||
                ((_c = incrementedIdentifier === null || incrementedIdentifier === void 0 ? void 0 : incrementedIdentifier.baseExpression) === null || _c === void 0 ? void 0 : _c.isUnknown)) &&
                isDecremented &&
                // if we have a = a + b - c, a can be unknown as long as b > c
                // if we have a = a - <anything> this error should throw:
                ((_d = state.increments[0]) === null || _d === void 0 ? void 0 : _d.precedingOperator) === '-') {
                throw new SyntaxUsageError("Can't nullify (that is, edit with knowledge of the state) an unknown state. Since we are taking away some value of the state, we must know it. Only incrementations like a += x can be marked as unknown.", node);
            }
            // gets the NodePath class for whatever is on the LHS
            path.traversePathsFast(getIncrementedPath, state);
            // update binding
            (_e = scope
                .getReferencedBinding(incrementedIdentifier)) === null || _e === void 0 ? void 0 : _e.updateIncrementation(path, state);
            // update indicator
            (_f = scope
                .getReferencedIndicator(incrementedIdentifier, false)) === null || _f === void 0 ? void 0 : _f.updateIncrementation(path, state);
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
            var _a, _b;
            // here: we check whether the assignment is an incrementation
            if (!state.unmarkedIncrementation)
                return;
            const { node, scope } = path;
            const { operator, leftHandSide, rightHandSide } = node;
            const lhsSecret = !!scope.getReferencedBinding(leftHandSide).isSecret;
            // a += something, -= something
            if (lhsSecret &&
                operator === '+=' &&
                rightHandSide.nodeType !== 'BinaryOperation') {
                rightHandSide.precedingOperator = '+';
                markParentIncrementation(path, state, true, false, leftHandSide, [
                    rightHandSide,
                ]);
                if ((_a = rightHandSide.operator) === null || _a === void 0 ? void 0 : _a.includes('-'))
                    mixedOperatorsWarning(path);
                return;
            }
            if (lhsSecret &&
                operator === '-=' &&
                rightHandSide.nodeType !== 'BinaryOperation') {
                rightHandSide.precedingOperator = '-';
                markParentIncrementation(path, state, true, true, leftHandSide, [
                    rightHandSide,
                ]);
                if ((_b = rightHandSide.operator) === null || _b === void 0 ? void 0 : _b.includes('+'))
                    mixedOperatorsWarning(path);
                return;
            }
            // a *= something, a /= something
            // OR lhs non-secret - we don't care about those
            if (operator === '%=' ||
                operator === '/=' ||
                operator === '*=' ||
                !lhsSecret) {
                markParentIncrementation(path, state, false, false, leftHandSide);
                return;
            }
            // after +=, -=, %=, *=, /=, we can only deal with =
            if (operator !== '=' && operator !== '+=' && operator !== '-=')
                throw new TODOError(`Operator '${operator}' not yet supported. Please open an issue.`, node);
            // then, it depends what's on the RHS of the assignment, so we continue
            // we save the LHS node to help us later
            state.incrementedIdentifier = leftHandSide.baseExpression || leftHandSide;
        },
    },
    UnaryOperation: {
        enter(path, state) {
            // a unary operation (a++, a--) counts as an incrementation by 1
            if (!state.unmarkedIncrementation)
                return;
            const { node, scope } = path;
            const { subExpression, operator } = node;
            const lhsSecret = !!scope.getReferencedBinding(subExpression).isSecret;
            // a++
            if (lhsSecret && operator.includes('+')) {
                literalOneNode.precedingOperator = '+';
                markParentIncrementation(path, state, true, false, subExpression.baseExpression || subExpression, literalOneNode);
                return;
            }
            // a--
            if (lhsSecret && operator.includes('-')) {
                literalOneNode.precedingOperator = '-';
                markParentIncrementation(path, state, true, true, subExpression.baseExpression || subExpression, literalOneNode);
            }
        },
    },
    BinaryOperation: {
        enter(path, state) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            var _r;
            // a BinaryOperation can tell us if the RHS of an assignment is incremented
            if (!state.unmarkedIncrementation)
                return;
            const parentExpressionStatement = path.getAncestorOfType('ExpressionStatement');
            const lhsNode = (_a = parentExpressionStatement === null || parentExpressionStatement === void 0 ? void 0 : parentExpressionStatement.node.expression) === null || _a === void 0 ? void 0 : _a.leftHandSide;
            const assignmentOp = (_b = parentExpressionStatement === null || parentExpressionStatement === void 0 ? void 0 : parentExpressionStatement.node.expression) === null || _b === void 0 ? void 0 : _b.operator;
            // if we don't have a parent expression or that expression can't hold an incrementation, we exit
            if (!lhsNode)
                return;
            const { operands, precedingOperator } = binOpToIncrements(path, state);
            // if we find our lhs variable (a) on the rhs (a = a + b), then we make sure we don't find it again (a = a + b + a = b + 2a)
            let discoveredLHS = 0;
            let isIncremented = { incremented: null, decremented: null };
            if (assignmentOp === '+=' || assignmentOp === '-=')
                isIncremented.incremented = true;
            // Goes through each operand and checks whether it's the lhsNode and whether it's +/- anything
            for (const [index, operand] of operands.entries()) {
                // below: we have an identifier
                if (operand.referencedDeclaration || operand.baseExpression) {
                    // a = a + something
                    if (operand.nodeType !== 'IndexAccess' &&
                        operand.name === lhsNode.name &&
                        ((_c = precedingOperator[index + 1]) === null || _c === void 0 ? void 0 : _c.includes('+')) && // we have ... + a + ...
                        ((_d = precedingOperator[index]) === null || _d === void 0 ? void 0 : _d.includes('+')) // otherwise we have a = b - a
                    ) {
                        discoveredLHS += 1;
                        isIncremented = { incremented: true, decremented: false };
                    }
                    // a = a + something (mapping)
                    if (operand.nodeType === 'IndexAccess' &&
                        operand.baseExpression.name === lhsNode.baseExpression.name &&
                        operand.indexExpression.name === lhsNode.indexExpression.name &&
                        ((_e = precedingOperator[index + 1]) === null || _e === void 0 ? void 0 : _e.includes('+')) &&
                        ((_f = precedingOperator[index]) === null || _f === void 0 ? void 0 : _f.includes('+')) // otherwise we have a = b - a
                    ) {
                        discoveredLHS += 1;
                        isIncremented = { incremented: true, decremented: false };
                    }
                    // a = a - something
                    if (operand.nodeType !== 'IndexAccess' &&
                        operand.name === lhsNode.name &&
                        ((_g = precedingOperator[index + 1]) === null || _g === void 0 ? void 0 : _g.includes('-')) && // we have ... + a - ...
                        ((_h = precedingOperator[index]) === null || _h === void 0 ? void 0 : _h.includes('+')) // otherwise we have a = b - a
                    ) {
                        discoveredLHS += 1;
                        isIncremented = { incremented: true, decremented: true };
                    }
                    // a = a - something (mapping)
                    if (operand.nodeType === 'IndexAccess' &&
                        operand.baseExpression.name === lhsNode.baseExpression.name &&
                        operand.indexExpression.name === lhsNode.indexExpression.name &&
                        ((_j = precedingOperator[index + 1]) === null || _j === void 0 ? void 0 : _j.includes('-')) &&
                        ((_k = precedingOperator[index]) === null || _k === void 0 ? void 0 : _k.includes('+')) // otherwise we have a = b - a
                    ) {
                        discoveredLHS += 1;
                        isIncremented = { incremented: true, decremented: true };
                    }
                    // a = something - a
                    if ((operand.name === lhsNode.name ||
                        (operand.nodeType === 'IndexAccess' &&
                            operand.baseExpression.name === lhsNode.baseExpression.name &&
                            operand.indexExpression.name ===
                                lhsNode.indexExpression.name)) &&
                        ((_l = precedingOperator[index]) === null || _l === void 0 ? void 0 : _l.includes('-')) // we have a = b - a
                    ) {
                        discoveredLHS -= 1;
                    }
                    // if none, go to the next operand
                    if (((_o = (_m = operand.indexExpression) === null || _m === void 0 ? void 0 : _m.expression) === null || _o === void 0 ? void 0 : _o.name) === 'msg')
                        (_p = (_r = operand.indexExpression).name) !== null && _p !== void 0 ? _p : (_r.name = `msg.sender`);
                    (_q = operand.name) !== null && _q !== void 0 ? _q : (operand.name = `${operand.baseExpression.name}[${operand.indexExpression.name}]`);
                }
                // if we have 1*a on the RHS and its incremented, mark the parent path
                if (discoveredLHS === 1 &&
                    isIncremented.incremented &&
                    assignmentOp === '=') {
                    // a = a + b - c - d counts as an incrementation since the 1st operator is a plus
                    // the mixed operators warning will have been given
                    if (precedingOperator.includes('+') &&
                        precedingOperator.includes('-') &&
                        precedingOperator[0] === '+')
                        isIncremented.decremented = false;
                    markParentIncrementation(path, state, isIncremented.incremented, isIncremented.decremented, lhsNode.baseExpression || lhsNode, { operands, precedingOperator });
                }
                else if (discoveredLHS === 0 &&
                    isIncremented.incremented &&
                    (assignmentOp === '+=' || assignmentOp === '-=')) {
                    if (assignmentOp === '+=')
                        markParentIncrementation(path, state, isIncremented.incremented, false, // we assume a += is always an overall increase in value
                        lhsNode.baseExpression || lhsNode, { operands, precedingOperator });
                    if (assignmentOp === '-=')
                        markParentIncrementation(path, state, isIncremented.incremented, true, // we assume a -= is always an overall decrease in value
                        lhsNode.baseExpression || lhsNode, { operands, precedingOperator });
                }
                else {
                    markParentIncrementation(path, state, false, false, lhsNode);
                }
            }
        },
    },
};
