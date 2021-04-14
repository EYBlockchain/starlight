/* eslint-disable no-param-reassign, no-shadow */
// no-unused-vars <-- to reinstate eventually

import logger from '../../../utils/logger.mjs';

// TODO move most of this to indicator

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
        if (secretVar.mappingKeys) {
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
          Object.keys(secretVar.mappingKeys).forEach(key => {
            // @Indicator
            secretVar.mappingKeys[key].binding = secretVar.binding.mappingKeys[key];
            secretVar.mappingKeys[key].id = secretVar.id;
            secretVar.mappingKeys[key].isWhole = isWhole;
            secretVar.mappingKeys[key].isPartitioned = isPartitioned;
            secretVar.mappingKeys[key].name = `${secretVar.name}[${key}]`;
            secretVar.mappingKeys[key].binding.name = `${secretVar.name}[${key}]`;
            scope.indicatorChecks(secretVar.mappingKeys[key]);

            secretVar.isPartitioned = secretVar.mappingKeys[key].isPartitioned;
            secretVar.binding.isPartitioned = secretVar.mappingKeys[key].isPartitioned;
            secretVar.isWhole = secretVar.mappingKeys[key].isWhole;
            secretVar.binding.isWhole = secretVar.mappingKeys[key].isWhole;
          });
        } else {
          scope.indicatorChecks(secretVar);
        }
      });
    },
  },
};
