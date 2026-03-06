/* eslint-disable no-param-reassign, no-unused-vars */

import logger from '../../../utils/logger.js';
import backtrace from '../../../error/backtrace.js';
import { SyntaxUsageError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';
import { VariableBinding } from '../../../traverse/Binding.js';

/**
 * Visitor validates that domain parameters are used consistently throughout the code.
 * 
 * Checks:
 * 1. All accesses to a per-mapped variable use the same domain parameters
 * 2. Domain parameter types match declaration
 * 3. Domain parameter names are consistent across the contract
 */

// Track domain parameter declarations globally within a contract
const domainParameterRegistry: Map<string, any> = new Map();

export default {
  ContractDefinition: {
    enter(path: NodePath) {
      // Clear registry for each contract
      domainParameterRegistry.clear();
    },

    exit(path: NodePath) {
      // Clear registry after contract processing
      domainParameterRegistry.clear();
    },
  },

  VariableDeclaration: {
    enter(path: NodePath) {
      const { node, scope } = path;

      // Only check secret mappings with per parameters
      if (!node.isSecret || !node.perParameters || node.perParameters.length === 0) {
        return;
      }

      if (!path.isMappingDeclaration()) {
        return;
      }

      const mappingName = node.name;
      const registryKey = `mapping:${mappingName}`;

      // Check if this mapping has been declared before with different per parameters
      if (domainParameterRegistry.has(registryKey)) {
        const previousDeclaration = domainParameterRegistry.get(registryKey);

        // Validate per parameter count matches
        if (previousDeclaration.perParameters.length !== node.perParameters.length) {
          throw new SyntaxUsageError(
            `Mapping '${mappingName}' declared with ${node.perParameters.length} domain parameter(s), ` +
            `but previously declared with ${previousDeclaration.perParameters.length} domain parameter(s). ` +
            `Domain parameters must be consistent across all declarations.`,
            node,
          );
        }

        // Validate each per parameter matches
        for (let i = 0; i < node.perParameters.length; i++) {
          const current = node.perParameters[i];
          const previous = previousDeclaration.perParameters[i];

          if (current.type !== previous.type) {
            throw new SyntaxUsageError(
              `Domain parameter '${current.name}' at position ${i + 1} has type '${current.type}', ` +
              `but previously declared as '${previous.type}'. ` +
              `Domain parameter types must match across all declarations.`,
              node,
            );
          }

          if (current.name !== previous.name) {
            throw new SyntaxUsageError(
              `Domain parameter at position ${i + 1} is named '${current.name}', ` +
              `but previously named '${previous.name}'. ` +
              `Domain parameter names must be consistent across all declarations.`,
              node,
            );
          }
        }
      } else {
        // Register this mapping's domain parameters
        domainParameterRegistry.set(registryKey, {
          mappingName,
          perParameters: node.perParameters,
          node,
        });
      }

      // Store per parameters in binding for later validation
      const binding = scope.getReferencedBinding(node);
      if (binding instanceof VariableBinding) {
        binding.perParameters = node.perParameters;
      }
    },
  },

  Identifier: {
    exit(path: NodePath) {
      const { node, scope } = path;

      // Skip special identifiers
      if (path.isMsg() || path.isThis() || path.isExportedSymbol()) {
        return;
      }

      // Get the binding for this identifier
      const binding = scope.getReferencedBinding(node);
      if (!binding || !binding.stateVariable) {
        return;
      }

      // Check if this is a mapping with domain parameters
      if (!binding.isMapping || !binding.perParameters || binding.perParameters.length === 0) {
        return;
      }

      // Verify the identifier is being used in a context where domain parameters are available
      // This will be validated more thoroughly in the mapping access visitor
      const indexAccessAncestor = path.getAncestorOfType('IndexAccess');
      if (!indexAccessAncestor) {
        return;
      }

      // Mark that this mapping is being accessed
      binding.isReferenced = true;
    },
  },
};

