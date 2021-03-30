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

      // @Node new properties
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
          const reason =
            lhsNode.typeDescriptions.typeString !== 'address'
              ? `Overwritten at ${expressionNode.src}`
              : `Address`;
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
