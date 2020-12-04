/* eslint-disable no-param-reassign, no-shadow */
// no-unused-vars <-- to reinstate eventually

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
      // why here? Because we are looking for whether the secret state is incremented per function scope
      const { node, scope } = path;
      const secretModifiedIndicators = scope.filterIndicators(
        ind => ind.binding.isSecret && ind.isModified,
      );
      // some checks (marking the variable's scope obj)
      Object.keys(secretModifiedIndicators).forEach(stateVarId => {
        const secretVar = secretModifiedIndicators[stateVarId];
        if (secretVar.mappingKey) {
          console.log(secretVar);
          Object.keys(secretVar.mappingKey).forEach(key => {
            secretVar.mappingKey[key].binding = secretVar.binding.mappingKey[key];
            secretVar.mappingKey[key].id = secretVar.id;
            secretVar.mappingKey[key].name = `${secretVar.name}[${key}]`;
            scope.indicatorChecks(secretVar.mappingKey[key]);
          });
        } else {
          scope.indicatorChecks(secretVar);
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
