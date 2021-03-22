/* eslint-disable no-param-reassign, no-shadow */
// no-unused-vars <-- to reinstate eventually

import logger from '../../../utils/logger.mjs';

export default {
  FunctionDefinition: {
    enter(path, state) {},

    exit(path, state) {
      // why here? Because we are looking for whether the secret state is whole per function scope
      const { node, scope } = path;
      // console.dir(path, { depth: 0 });
      const secretModifiedIndicators = scope.filterIndicators(
        ind => ind.binding.isSecret && ind.isModified,
      );
      // some checks (marking the variable's scope obj)
      Object.keys(secretModifiedIndicators).forEach(stateVarId => {
        const secretVar = secretModifiedIndicators[stateVarId];
        if (secretVar.mappingKey) {
          let isWhole;
          let isPartitioned;
          if (secretVar.binding.isWhole) {
            isWhole = true;
            isPartitioned = false;
          }
          if (secretVar.binding.isPartitioned) {
            isPartitioned = true;
            isWhole = false;
          }
          Object.keys(secretVar.mappingKey).forEach(key => {
            secretVar.mappingKey[key].binding = secretVar.binding.mappingKey[key];
            secretVar.mappingKey[key].id = secretVar.id;
            secretVar.mappingKey[key].isWhole = isWhole;
            secretVar.mappingKey[key].isPartitioned = isPartitioned;
            secretVar.mappingKey[key].name = `${secretVar.name}[${key}]`;
            secretVar.mappingKey[key].binding.name = `${secretVar.name}[${key}]`;
            scope.indicatorChecks(secretVar.mappingKey[key]);

            secretVar.isPartitioned = secretVar.mappingKey[key].isPartitioned;
            secretVar.binding.isPartitioned = secretVar.mappingKey[key].isPartitioned;
            secretVar.isWhole = secretVar.mappingKey[key].isWhole;
            secretVar.binding.isWhole = secretVar.mappingKey[key].isWhole;
          });
        } else {
          scope.indicatorChecks(secretVar);
        }
      });
    },
  },
};
