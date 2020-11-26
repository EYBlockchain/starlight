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
    // TODO: We should probably check that the `.zsol` Pragma is 'supported'. The output Solidity's pragma will be limited to the latest-supported boilerplate code.
    // However, for now, we'll just inherit the Pragma of the original and hope.
    enter(path, state) {},
    exit(path, state) {},
  },

  ContractDefinition: {
    enter(path, state) {},

    exit(path, state) {},
  },

  FunctionDefinition: {
    enter(path, state) {},

    exit(path, state) {},
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

    exit(path, state) {},
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
    enter(path, state) {
      // Here, if secret:
      // 1) Chcek if in a RHS container
      // 2) Check if NOT incrementing
      const { node, parent } = path;
      const referencedBinding = path.scope.findReferencedBinding(node);
      const parentExpression = path.getAncestorOfType('ExpressionStatement');
      if (parentExpression && referencedBinding.secretVariable) {
        const rightAncestor = path.getAncestorContainedWithin('rightHandSide');
        const indicatorObj = path.scope.indicators.find(obj => obj.binding === referencedBinding);
        if (rightAncestor && !parentExpression.node.expression.isIncremented) {
          console.log('Found a reference');
          // TODO should we add this reason each time a state is referenced, even if the expression is one that looks like an increment? (but the state is whole for another reason)
          const reason = `Referenced at ${node.src}`;
          indicatorObj.isWhole = true;
          if (indicatorObj.isWholeReason) {
            indicatorObj.isWholeReason.push(reason);
          } else {
            indicatorObj.isWholeReason = [reason];
          }
        }
      }
    },

    exit(path, state) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
