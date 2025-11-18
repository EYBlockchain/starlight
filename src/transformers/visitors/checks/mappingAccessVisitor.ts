/* eslint-disable no-param-reassign, no-unused-vars */

import logger from '../../../utils/logger.js';
import backtrace from '../../../error/backtrace.js';
import { SyntaxUsageError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';
import { VariableBinding } from '../../../traverse/Binding.js';

/**
 * @desc:
 * Visitor validates that mappings are accessed with correct domain parameters.
 * 
 * Checks:
 * 1. Mapping access includes all required domain parameters
 * 2. Domain parameters are available in the current scope
 * 3. Domain parameter values match expected types
 */

export default {
  IndexAccess: {
    enter(path: NodePath) {
      const { node, scope } = path;

      // Get the base expression (the mapping being accessed)
      const baseExpression = node.baseExpression;
      if (!baseExpression || baseExpression.nodeType !== 'Identifier') {
        return;
      }

      // Get the binding for the mapping
      const binding = scope.getReferencedBinding(baseExpression);
      if (!binding || !binding.stateVariable || !binding.isMapping) {
        return;
      }

      // Check if this mapping has domain parameters
      if (!binding.perParameters || binding.perParameters.length === 0) {
        return;
      }

      // Get the function definition context
      const functionDef = path.getFunctionDefinition();
      if (!functionDef) {
        throw new SyntaxUsageError(
          `Mapping '${binding.name}' with domain parameters can only be accessed within a function. ` +
          `Cannot access domain-parameterized mapping at contract level.`,
          node,
        );
      }

      // Get function parameters
      const functionParams = functionDef.node.parameters?.parameters || [];
      const perParamsInFunction = functionParams.filter((p: any) => p.isPer);

      // Validate that function has required per parameters
      if (perParamsInFunction.length < binding.perParameters.length) {
        const missingCount = binding.perParameters.length - perParamsInFunction.length;
        const missingParams = binding.perParameters
          .slice(perParamsInFunction.length)
          .map((p: any) => `${p.type} ${p.name}`)
          .join(', ');

        throw new SyntaxUsageError(
          `Mapping '${binding.name}' requires ${binding.perParameters.length} domain parameter(s), ` +
          `but function '${functionDef.node.name}' only has ${perParamsInFunction.length}. ` +
          `Missing: ${missingParams}. ` +
          `Add these to the function signature: function ${functionDef.node.name}(per ${missingParams}, ...) ...`,
          node,
        );
      }

      // Validate per parameter types match
      for (let i = 0; i < binding.perParameters.length; i++) {
        const mappingPerParam = binding.perParameters[i];
        const functionPerParam = perParamsInFunction[i];

        if (mappingPerParam.type !== functionPerParam.typeName?.name &&
            mappingPerParam.type !== functionPerParam.typeDescriptions?.typeString) {
          throw new SyntaxUsageError(
            `Domain parameter '${mappingPerParam.name}' at position ${i + 1} ` +
            `has type '${mappingPerParam.type}' in mapping declaration, ` +
            `but function parameter has type '${functionPerParam.typeName?.name || functionPerParam.typeDescriptions?.typeString}'. ` +
            `Domain parameter types must match exactly.`,
            node,
          );
        }

        if (mappingPerParam.name !== functionPerParam.name) {
          logger.warn(
            `Domain parameter at position ${i + 1} is named '${mappingPerParam.name}' in mapping ` +
            `but '${functionPerParam.name}' in function. ` +
            `Consider using consistent names for clarity.`,
          );
        }
      }

      // Mark that this mapping is being accessed with domain parameters
      binding.isReferenced = true;
    },
  },

  Identifier: {
    exit(path: NodePath) {
      const { node, scope } = path;

      // Skip special identifiers
      if (path.isMsg() || path.isThis() || path.isExportedSymbol()) {
        return;
      }

      // Check if this identifier is a domain parameter being used
      const binding = scope.getReferencedBinding(node);
      if (!binding || binding.stateVariable) {
        return;
      }

      // Check if this is a per parameter in a function
      const functionDef = path.getFunctionDefinition();
      if (!functionDef) {
        return;
      }

      const functionParams = functionDef.node.parameters?.parameters || [];
      const isPerParam = functionParams.some((p: any) => p.name === node.name && p.isPer);

      if (isPerParam) {
        // This is a valid per parameter usage
        binding.isReferenced = true;
      }
    },
  },
};

