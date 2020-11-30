/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../../utils/logger.mjs';
import circuitTypes from '../../../types/circuit-types.mjs';
import { traverse, traverseNodesFast, traversePathsFast } from '../../../traverse/traverse.mjs';

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
      const lhsNode = expressionNode.leftHandSide;
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
      const referencedBinding = scope.findReferencedBinding(lhsNode);
      if (referencedBinding.node.stateVariable && scope.isInScopeType('FunctionDefinition')) {
        const fnDefScope = scope.getAncestorOfScopeType('FunctionDefinition');
        const fnIndicatorObj = fnDefScope.indicators.find(obj => obj.binding === referencedBinding);

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
