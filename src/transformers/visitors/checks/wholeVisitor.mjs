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
      const contractDefScope = scope.getAncestorOfScopeType('ContractDefinition');
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
      // some checks (marking the variable's scope obj)
      indicatorObjs.forEach(secretVar => {
        if (secretVar.isKnown && secretVar.isWhole)
          logger.warn(
            `PEDANTIC: Unnecessary 'known' decorator. Secret state ${secretVar.name} MUST be known, due to: ${secretVar.isWholeReason}`,
          );
        if ((secretVar.isUnknown || secretVar.binding.isUnknown) && secretVar.isWhole)
          throw new Error(
            `Can't mark a whole state as unknown. The state ${secretVar.name} is whole due to: ${secretVar.isWholeReason}`,
          );
        if (secretVar.isUnknown && secretVar.isIncremented && !secretVar.isWhole) {
          secretVar.isWhole = false;
          secretVar.isWholeReason = [`Incremented and marked as unknown`];
        }
        if (secretVar.isIncremented && secretVar.isWhole === undefined) {
          if (!secretVar.isKnown && !secretVar.isUnknown)
            throw new Error(
              `Secret value assigned to, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know.`,
            );
          if (secretVar.isUnknown) throw new Error(`This should be unreachable code!`);
          if (secretVar.isKnown) {
            secretVar.isWhole = true;
            secretVar.isWholeReason = [`Marked as known`];
          } else {
            logger.warn(
              `State ${secretVar.name} will be treated as a whole state, because there are no unknown decorators`,
            );
            secretVar.isWhole = true;
            secretVar.isWholeReason = [`No unknown decorator or overwrites`];
          }
          // look for duplicates: PEDANTIC: Unnecessary duplicate 'unknown' decorator for secret state `a`.
        }
        if (secretVar.isWhole === false && secretVar.isDecremented) {
          // partitioned/decremented state
          secretVar.nullifierRequired = true;
          contractDefScope.indicators.nullifiersRequired = true;
        }
        if (secretVar.isWhole === false && secretVar.isIncremented) {
          secretVar.nullifierRequired = false;
        } else {
          secretVar.nullifierRequired = true;
          contractDefScope.indicators.nullifiersRequired = true;
        }
        // here - mark the contract obj
        const topScope = contractDefScope.bindings.find(obj => obj.id === secretVar.id);
        if (topScope.isWhole && !secretVar.isWhole)
          throw new Error(
            `State ${secretVar.name} must be whole because: ${topScope.isWholeReason}`,
          );
        if (topScope.isPartitioned && secretVar.isWhole)
          throw new Error(
            `State ${secretVar.name} must be whole because: ${secretVar.isWholeReason}, but is partitioned: ${topScope.isPartitionedReason}`,
          );
        topScope.isWhole = secretVar.isWhole;
        if (topScope.isWhole === false) {
          topScope.isPartitioned = true;
          topScope.isPartitionedReason = secretVar.isWholeReason;
        } else {
          topScope.isWholeReason = secretVar.isWholeReason;
        }
        console.log(`Contract level binding for state:`);
        console.dir(topScope, { depth: 0 });
        if (topScope.isWholeReason) {
          console.log(topScope.isWholeReason);
        } else {
          console.log(topScope.isPartitionedReason);
        }
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
