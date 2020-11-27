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
      // why here? Because we are looking for whether the secret state is incremented per function scope
      const { node, scope } = path;
      const fnDefScopes = [];
      const secretVarsInScope = [];
      const indicatorObjs = [];
      // we find each secret variable which has been modified in this scope
      scope.referencedBindings.forEach(binding => {
        if (binding.secretVariable && !secretVarsInScope.includes(binding))
          secretVarsInScope.push(binding);
      });
      // we find the indicators for each secret variable
      secretVarsInScope.forEach(binding => {
        indicatorObjs.push(scope.indicators.find(obj => obj.binding === binding));
      });
      // console.log(secretVarsInScope);
      // console.log(indicatorObjs);
      // some checks
      indicatorObjs.forEach(secretVar => {
        if (secretVar.isKnown && secretVar.isWhole)
          logger.warn(
            `PEDANTIC: Unnecessary 'known' decorator. Secret state ${secretVar.name} MUST be known, due to: ${secretVar.isWholeReason}`,
          );
        if (secretVar.isIncremented && secretVar.isWhole === undefined) {
          // check for known/unknown decorators, if none throw error
          // look for duplicates: PEDANTIC: Unnecessary duplicate 'unknown' decorator for secret state `a`.
        }
        if (secretVar.isWhole && secretVar.isUnknown)
          throw new Error(
            `Can't nullify (that is, edit with knowledge of the state) a whole state. The state ${secretVar.name} is whole due to: ${secretVar.isWholeReason}`,
          );
        if (secretVar.isUnknown && secretVar.isIncremented) secretVar.isWhole = false;
      });
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
    enter(path, state) {},

    exit(path, state) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
