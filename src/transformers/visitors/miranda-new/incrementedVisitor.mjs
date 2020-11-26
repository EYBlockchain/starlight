/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../../utils/logger.mjs';
import {
  collectAllStateVariableBindings,
  queryScopeAncestors,
  findReferencedBinding,
  getScopeAncestorOfType,
  isIncremented,
} from '../../../traverse/scope.mjs';
import circuitTypes from '../../../types/circuit-types.mjs';
import { traverse, traverseNodesFast, traversePathsFast } from '../../../traverse/traverse.mjs';

export default {
  SourceUnit: {
    enter(path, state, scope) {},

    exit(path, state, scope) {},
  },

  PragmaDirective: {
    // TODO: We should probably check that the `.zsol` Pragma is 'supported'. The output Solidity's pragma will be limited to the latest-supported boilerplate code.
    // However, for now, we'll just inherit the Pragma of the original and hope.
    enter(path, state, scope) {},
    exit(path, state, scope) {},
  },

  ContractDefinition: {
    enter(path, state, scope) {},

    exit(path, state, scope) {},
  },

  FunctionDefinition: {
    enter(path, state, scope) {},

    exit(path, state, scope) {
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
    enter(path, state, scope) {},

    exit(path, state, scope) {},
  },

  ExpressionStatement: {
    enter(path, state, scope) {},

    exit(path, state, scope) {
      // Why here? Because we need the indicatorObj of the individual elts before we decide
      const { node } = path;
      const expressionNode = node.expression;
      const lhsNode = expressionNode.leftHandSide;
      const isIncrementedBool = isIncremented(expressionNode, lhsNode, scope);
      if (lhsNode.isUnknown && expressionNode.isDecremented === true) {
        throw new Error(
          "Can't nullify (that is, edit with knowledge of the state) an unknown state.",
        );
      }
      // TODO remove this - this is testing stuff for not using scope

      const referencedId = lhsNode.nodeType === 'Identifier' ? lhsNode.referencedDeclaration : null;
      let varDec;
      const varDecFinder = (thisPath, state) => {
        if (thisPath.node.id === referencedId) {
          varDec = thisPath.node;
        }
      };
      const inputPath = path.getAncestorOfType('ContractDefinition');
      traversePathsFast(inputPath, varDecFinder, {});
      if (isIncrementedBool === false) {
        // statement is an overwrite
        varDec.isWhole = true;
        const reason = `Overwritten at ${expressionNode.src}`;
        console.log(reason);
        if (varDec.isWholeReason) {
          varDec.isWholeReason.push(reason);
        } else {
          varDec.isWholeReason = [reason];
        }
      }
    },
  },

  VariableDeclaration: {
    enter(path, state, scope) {},

    exit(path) {},
  },

  ElementaryTypeName: {
    enter(path) {},

    exit(path) {},
  },

  Identifier: {
    enter(path, state, scope) {},

    exit(path, state, scope) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
