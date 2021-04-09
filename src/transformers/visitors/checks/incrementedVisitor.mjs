/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.mjs';

/**
 * @desc:
 * Visitor will...
*/

export default {
  ExpressionStatement: {
    enter(path, state) {},

    exit(path, state) {
      // Why here? Because we need the indicatorObj of the individual elts before we decide.
      const { node, scope } = path;
      const expressionNode = node.expression;

      // functionCalls can't be increments
      if (expressionNode.nodeType === 'FunctionCall') return;

      const lhsNode = expressionNode.leftHandSide || expressionNode.subExpression;

      const { isIncrementedBool, isDecrementedBool } =
        lhsNode.typeDescriptions.typeString !== 'address'
          ? scope.isIncremented(expressionNode, lhsNode)
          : { isIncrementedBool: false, isDecrementedBool: false };

      expressionNode.isIncremented = isIncrementedBool;
      expressionNode.isDecremented = isDecrementedBool;

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
      if (referencedBinding.stateVariable && scope.isInScopeType('FunctionDefinition')) {
        const fnDefScope = scope.getAncestorOfScopeType('FunctionDefinition');
        let fnIndicatorObj = fnDefScope.indicators[referencedBinding.id];
        let parentIndicatorObj;

        // a mapping:
        // TODO: IndexAccess also describes access of an array (not just mappings)
        if (lhsNode.nodeType === 'IndexAccess') {
          const keyName = scope.getMappingKeyName(lhsNode);
          parentIndicatorObj = fnIndicatorObj;
          fnIndicatorObj = fnIndicatorObj.mappingKey[keyName];
        }

        // if its incremented anywhere, isIncremented = true

        fnIndicatorObj.isIncremented =
          fnIndicatorObj.isIncremented === true ? true : isIncrementedBool;
        fnIndicatorObj.isDecremented =
          fnIndicatorObj.isDecremented === true ? true : isDecrementedBool;
        if (isIncrementedBool === false) {
          // statement is an overwrite
          fnIndicatorObj.isWhole = true;
          referencedBinding.isWhole = true;
          const reason = {};
          reason[0] = lhsNode.typeDescriptions.typeString !== 'address' ? `Overwritten` : `Address`;
          reason.src = expressionNode.src;
          logger.debug('reason:', reason);
          if (fnIndicatorObj.isWholeReason) {
            fnIndicatorObj.isWholeReason.push(reason);
          } else {
            fnIndicatorObj.isWholeReason = [reason];
          }

          if (parentIndicatorObj?.isWholeReason) {
            parentIndicatorObj.isWholeReason.push(reason);
          } else if (parentIndicatorObj) {
            parentIndicatorObj.isWhole = true;
            parentIndicatorObj.isWholeReason = [reason];
          }
        }
      }
    },
  },
};
