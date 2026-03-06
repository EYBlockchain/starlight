/* eslint-disable no-param-reassign, no-unused-vars */

import logger from '../../../utils/logger.js';
import backtrace from '../../../error/backtrace.js';
import { SyntaxUsageError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';

/**
 * @desc:
 * Visitor validates function parameters with `per` keyword.
 * 
 * Checks:
 * 1. Function parameters with `per` keyword are properly declared
 * 2. Per parameters appear before regular parameters
 * 3. Per parameters are not marked as secret
 * 4. Per parameter types are valid
 */

export default {
  FunctionDefinition: {
    enter(path: NodePath) {
      const { node } = path;

      // Skip if no parameters
      if (!node.parameters || !node.parameters.parameters) {
        return;
      }

      const params = node.parameters.parameters;
      let lastPerParamIndex = -1;
      const perParameters: any[] = [];
      const regularParameters: any[] = [];

      // First pass: identify per parameters and validate ordering
      for (let i = 0; i < params.length; i++) {
        const param = params[i];

        // Check if parameter has per keyword (stored during parsing)
        if (param.isPer) {
          lastPerParamIndex = i;
          perParameters.push(param);

          // Validate per parameter is not secret
          if (param.isSecret) {
            throw new SyntaxUsageError(
              `Domain parameter '${param.name}' cannot be marked as 'secret'. ` +
              `Domain parameters are part of the public API and must be public.`,
              param,
            );
          }
        } else {
          regularParameters.push(param);

          // Validate that regular parameters don't come before per parameters
          if (lastPerParamIndex !== -1 && i > lastPerParamIndex) {
            // This is fine - regular params can come after per params
          }
        }
      }

      // Validate per parameters come first
      for (let i = 0; i < params.length; i++) {
        const param = params[i];
        if (!param.isPer && i < lastPerParamIndex) {
          throw new SyntaxUsageError(
            `Regular parameter '${param.name}' appears before domain parameter. ` +
            `All domain parameters (with 'per' keyword) must appear before regular parameters.`,
            param,
          );
        }
      }

      // Store per parameters in function scope for later validation
      if (perParameters.length > 0) {
        node.perParameters = perParameters;
      }
    },
  },

  ParameterList: {
    enter(path: NodePath) {
      const { node, parent } = path;

      // Only process function parameters
      if (parent.nodeType !== 'FunctionDefinition') {
        return;
      }

      if (!node.parameters) {
        return;
      }

      // Validate each parameter
      for (const param of node.parameters) {
        // Check for per keyword in parameter name or metadata
        if (param.isPer) {
          // Validate parameter type is valid
          const typeName = param.typeName?.name || param.typeDescriptions?.typeString;
          if (!typeName) {
            throw new SyntaxUsageError(
              `Domain parameter '${param.name}' has no type. ` +
              `Domain parameters must have a valid Solidity type.`,
              param,
            );
          }

          // Validate parameter is not an array or mapping
          if (param.typeName?.nodeType === 'ArrayTypeName') {
            throw new SyntaxUsageError(
              `Domain parameter '${param.name}' cannot be an array type. ` +
              `Domain parameters must be scalar types (uint256, address, bytes32, etc.).`,
              param,
            );
          }

          if (param.typeName?.nodeType === 'Mapping') {
            throw new SyntaxUsageError(
              `Domain parameter '${param.name}' cannot be a mapping type. ` +
              `Domain parameters must be scalar types.`,
              param,
            );
          }
        }
      }
    },
  },

  FunctionCall: {
    enter(path: NodePath) {
      const { node, scope } = path;

      // This will be used in Phase 3 to validate function calls with per parameters
      // For now, we just mark that we've seen a function call
    },
  },
};

