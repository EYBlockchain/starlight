/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../../utils/logger.mjs';
import { traverse, traversePathsFast } from '../../../traverse/traverse.mjs';

export default {
  ContractDefinition: {
    enter(path, state) {},

    exit(path, state) {
      const { scope } = path;
      scope.isNullifiable();
    },
  },

  ExpressionStatement: {
    enter(path, state) {},

    exit(path, state) {
      const { node, scope } = path;
      // Here we look at each statement and decide whether it's a nullification
      if (node.expression.nodeType === 'FunctionCall') return;
      let referencedBinding;
      let referencedIndicator;
      // a small visitor to get the correct identifier to add to nullifyingPaths (differs for mapping vs uint)
      const getIdentifierPath = (thisPath, newState) => {
        if (thisPath.node.nodeType === 'Identifier' && thisPath.node.id === newState.id) {
          newState.stopTraversal = true;
          newState.path = thisPath;
        }
      };
      const newState = {};
      traversePathsFast(path, getIdentifierPath, newState);
      // we get the relevant bindings of the lhs and initialise binding.nullifyingPaths (if doesnt exist)
      switch (node.expression.leftHandSide.nodeType) {
        case 'Identifier':
          newState.id = node.expression.leftHandSide.id;
          traversePathsFast(path, getIdentifierPath, newState);
          referencedBinding = scope.getReferencedBinding(node.expression.leftHandSide);
          referencedIndicator =
            scope.indicators[node.expression.leftHandSide.referencedDeclaration];
          if (!referencedIndicator) return;
          if (!referencedBinding.nullifyingPaths) {
            // @Binding new properties
            referencedBinding.nullifyingPaths = [];
            referencedBinding.nullificationCount = 0;
            // @Indicator new properties
            referencedIndicator.nullifyingPaths = [];
            referencedIndicator.nullificationCount = 0;
          } else if (!referencedIndicator.nullifyingPaths) {
            // we have a separate statement for init just the indicator obj, since indicators are per function, while bindings are per contract
            // @Indicator new properties
            referencedIndicator.nullifyingPaths = [];
            referencedIndicator.nullificationCount = 0;
          }
          break;
        case 'IndexAccess': {
          newState.id = node.expression.leftHandSide.baseExpression.id;
          traversePathsFast(path, getIdentifierPath, newState);
          const mappingKey = scope.getMappingKeyName(
            node.expression.leftHandSide,
          );
          referencedBinding = scope.getReferencedBinding(
            node.expression.leftHandSide.baseExpression,
          ).mappingKeys[mappingKey];
          referencedIndicator =
            scope.indicators[
              node.expression.leftHandSide.baseExpression.referencedDeclaration
            ].mappingKeys[mappingKey];
          if (!referencedBinding.nullifyingPaths) {
            // @Binding new properties
            referencedBinding.nullifyingPaths = [];
            referencedBinding.nullificationCount = 0;
            // @Indicator new properties
            referencedIndicator.nullifyingPaths = [];
            referencedIndicator.nullificationCount = 0;
          } else if (!referencedIndicator.nullifyingPaths) {
            // we have a separate statement for init just the indicator obj, since indicators are per function, while bindings are per contract
            // @Indicator new properties
            referencedIndicator.nullifyingPaths = [];
            referencedIndicator.nullificationCount = 0;
          }
          break;
        }
        default:
          referencedBinding = {};
          referencedIndicator = {};
          break;
      }
      // then look at the node.expression to see if its incremented and/or the lhs to see if the state is whole
      // whole or decrement: we have a nullification
      switch (node.expression.isIncremented) {
        case true:
          if (node.expression.isDecremented) {
            // @Node new properties
            node.expression.isNullification = true;
            // @Binding new properties
            referencedBinding.isNullified = true;
            referencedBinding.nullifyingPaths.push(newState.path);
            referencedBinding.nullificationCount++;
            // @Indicator new properties
            referencedIndicator.isNullified = true;
            referencedIndicator.nullifyingPaths.push(newState.path);
            referencedIndicator.nullificationCount++;
            scope.addNullifyingPath(newState.path);
            break;
          } else if (node.expression.leftHandSide.isKnown || node.expression.leftHandSide.isWhole) {
            // @Node new properties
            node.expression.isNullification = true;
            // @Binding new properties
            referencedBinding.isNullified = true;
            referencedBinding.nullifyingPaths.push(newState.path);
            referencedBinding.nullificationCount++;
            // @Indicator new properties
            referencedIndicator.isNullified = true;
            referencedIndicator.nullifyingPaths.push(newState.path);
            referencedIndicator.nullificationCount++;
            scope.addNullifyingPath(newState.path);
            break;
          } else {
            node.expression.isNullification = false;
            break;
          }
        case false:
          // @Node new properties
          node.expression.isNullification = true;
          // @Binding new properties
          referencedBinding.isNullified = true;
          referencedBinding.nullifyingPaths.push(newState.path);
          referencedBinding.nullificationCount++;
          // @Indicator new properties
          referencedIndicator.isNullified = true;
          referencedIndicator.nullifyingPaths.push(newState.path);
          referencedIndicator.nullificationCount++;
          scope.addNullifyingPath(newState.path);
          break;
        default:
          // everything should be marked as isIncremented: true/false
          throw new Error(`Expression id ${node.expression.id} not marked as incremented.`);
      }
    },
  },
};
