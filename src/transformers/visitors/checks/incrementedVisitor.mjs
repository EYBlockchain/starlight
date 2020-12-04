/* eslint-disable no-param-reassign, no-shadow */

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

    exit(path, state) {
      // console.log('scope');
      // console.log(scope);
      // scope.referencedBindings.forEach(binding => {
      //   console.log('binding:');
      //   console.log(binding.node, binding.referencingPaths);
      // });
    },
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

    exit(path, state) {
      // Why here? Because we need the indicatorObj of the individual elts before we decide
      const { node, scope } = path;
      const expressionNode = node.expression;
      const lhsNode = expressionNode.leftHandSide || expressionNode.subExpression;
      const { isIncrementedBool, isDecrementedBool } =
        lhsNode.typeDescriptions.typeString !== 'address'
          ? scope.isIncremented(expressionNode, lhsNode)
          : { isIncrementedBool: false, isDecrementedBool: false };
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

        // a mapping:

        if (lhsNode.nodeType === 'IndexAccess') {
          const keyNode = lhsNode.indexExpression.expression || lhsNode.indexExpression;
          let keyName = keyNode.name;
          if (scope.getReferencedBinding(keyNode).isModified) {
            const keyBinding = scope.getReferencedBinding(keyNode);
            let i = 0;
            for (const modPathId of Object.keys(keyBinding.modifyingPaths)) {
              if (node.id < modPathId && i === 0) break;
              i++;
              if (modPathId < node.id && node.id < Object.keys(keyBinding.modifyingPaths)[i]) break;
            }
            if (i > 0) keyName = `${keyNode.name}_${i}`;
          }
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
          const reason =
            lhsNode.typeDescriptions.typeString !== 'address'
              ? `Overwritten at ${expressionNode.src}`
              : `Address`;
          console.log(reason);
          if (fnIndicatorObj.isWholeReason) {
            fnIndicatorObj.isWholeReason.push(reason);
          } else {
            fnIndicatorObj.isWholeReason = [reason];
          }
        }
      }
    },
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
    enter(path, state) {},

    exit(path, state) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
