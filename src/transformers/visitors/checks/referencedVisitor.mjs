/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */
// no-unused-vars <-- to reinstate eventually
import cloneDeep from 'lodash.cloneDeep';

import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs';

/**
 * @desc:
 * Visitor will...
*/

export default {
  Identifier: {
    enter(path, state) {
      // Here, if secret:
      // 1) Chcek if in a RHS container
      // 2) Check if NOT incrementing
      const { node, scope } = path;
      if (path.isMsg()) return; // the node represents the special 'msg' type in solidity
      if (path.isThis()) return; // the node represents the special 'this' type in solidity
      if (path.isExportedSymbol()) return; // the node represents an external contract name
      if (path.isRequireStatement()) return;

      const referencedBinding =
        path.parentPath.node.nodeType !== 'MemberAccess'
          ? scope.getReferencedBinding(node)
          : scope.getReferencedBinding(path.parentPath.parentPath.node.baseExpression);

      // QUESTION: what's happening here? (The clone deep and then the manual assignment of properties to the newly cloned object)
      let parentExpression = cloneDeep(path.getAncestorOfType('ExpressionStatement'));
      const parentStatement = path.getAncestorOfType('VariableDeclarationStatement');
      if (!parentExpression && parentStatement) {
        parentExpression = cloneDeep(parentStatement);
        parentExpression.node.expression = {};
        parentExpression.node.expression.leftHandSide = parentStatement.node.declarations[0];
        parentExpression.node.expression.rightHandSide = parentStatement.node.initialValue;
        parentExpression.node.nodeType = 'Assignment';
      }

      if (parentExpression && referencedBinding?.isSecret) {
        // here: we are in a line which modifies a secret state
        const rightAncestor =
          path.getAncestorContainedWithin('rightHandSide') ||
          path.getAncestorContainedWithin('initialValue');
        const leftAncestor = path.getAncestorContainedWithin('leftHandSide');
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
          logger.debug(`Found an accessed secret state ${node.name}`);
          const lhs =
            lhsNode.nodeType === 'Identifier'
              ? scope.getReferencedBinding(lhsNode)
              : lhsNode.nodeType === 'VariableDeclaration'
              ? scope.getReferencedBinding({
                  nodeType: 'Identifier',
                  referencedDeclaration: lhsNode.id,
                })
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
            const keyName = scope.getMappingKeyName(lhsNode);
            referencedIndicator = referencedIndicator.mappingKeys[keyName];
          }
          // @Indicator updated properties
          // @Binding updated properties
          referencedIndicator.isWhole = true;
          referencedIndicator.isAccessed = true;
          referencedBinding.isAccessed = true;
          if (referencedIndicator.isWholeReason) {
            referencedIndicator.isWholeReason.push(reason);
          } else {
            referencedIndicator.isWholeReason = [reason];
          }
          if (referencedBinding.accessedNodes) {
            referencedBinding.accessedNodes.push(node);
          } else {
            referencedBinding.accessedNodes = [node];
          }
          // @Node new property
          node.accessedSecretState = true;
        }
        const { operator } = parentExpression.node.expression;
        // below: check if the identifier is on the LHS and is NOT an incrementation AND requires the LHS value e.g. a *= b
        if (
          leftAncestor &&
          !parentExpression.node.expression.isIncremented &&
          !referencedBinding.isPartitioned &&
          operator &&
          ['*=', '+=', '-='].includes(operator)
        ) {
          logger.debug(
            `Found an accessed secret state ${node.name} (accessed in ${operator} operation)`,
          );
          // TODO how many of the errors from above need to be copied here?
          const reason = `Accessed at ${node.src}`;
          if (lhsNode.nodeType === 'IndexAccess') {
            const keyName = scope.getMappingKeyName(lhsNode);
            referencedIndicator = referencedIndicator.mappingKeys[keyName];
          }
          // @Node new property
          // @Indicator updated properties
          // @Binding updated properties
          node.accessedSecretState = true;
          referencedIndicator.isWhole = true;
          referencedIndicator.isAccessed = true;
          referencedBinding.isAccessed = true;
          if (referencedIndicator.isWholeReason) {
            referencedIndicator.isWholeReason.push(reason);
          } else {
            referencedIndicator.isWholeReason = [reason];
          }
          if (referencedBinding.accessedNodes) {
            referencedBinding.accessedNodes.push(node);
          } else {
            referencedBinding.accessedNodes = [node];
          }
        }
      } else if (parentExpression) {
        // In an expression, not secret
        // Find non-secret params used for assigning secret states
        // FIXME: too many rigid assumptions about the nodeTypes contained within the parentExpression. It might not be an assignment (e.g. if it's a require statement containing a binary operation)
        const rightAncestor = path.getAncestorContainedWithin('rightHandSide');
        if (!rightAncestor) return; // HACK - pending the above FIXME, so that we don't get errors below, from too many assumptions about the node structure.
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
        if (lhs.isSecret && rightAncestor && !referencedBinding.stateVariable) {
          logger.warn(
            `Non-secret parameter '${node.name}' used when assigning to a secret variable '${lhsName}'. Blockchain observers might be able to infer the value of '${lhsName}' from this. I.e. although you've labelled '${lhsName}' as 'secret', it might not be secret.`,
          );
          backtrace.getSourceCode(node.src);
        }
      }
    },

    exit(path, state) {},
  },
};
