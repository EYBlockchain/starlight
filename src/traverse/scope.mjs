/* eslint-disable no-shadow, no-param-reassign, no-use-before-define */

import { getNodeLocation } from '../types/solidity-types.mjs';
import logger from '../utils/logger.mjs';

// TODO: better scope handling
export const updateScope = (path, scope) => {
  const { node, parent } = path;
  if (Object.keys(scope).length === 0 && node.nodeType !== 'SourceUnit') return {}; // for lazy traversal which doesn't make use of scope
  switch (node.nodeType) {
    case 'SourceUnit':
      return {
        scopeId: null,
        parentScope: {},
        bindings: [],
        modifiedBindings: [],
        referencedBindings: [],
      };
    case 'ContractDefinition':
    case 'FunctionDefinition':
      // a 'ContractDefinition' is a declaration (binding) within a SourceUnit scope.
      // a 'FunctionDefinition' is a declaration (binding) within a Contract scope.
      scope.bindings.push({ node });
      // enter a new scope:
      return {
        scopeId: parent.id,
        parentScope: scope,
        bindings: [],
        modifiedBindings: [],
        referencedBindings: [],
      };
    case 'VariableDeclaration':
      scope.bindings.push({
        node,
        path,
        stateVariable: node.stateVariable,
        secretVariable: node.sprinkle === 'secret',
        referenced: false,
        referenceCount: 0,
        referencingPaths: [],
        modified: false,
        modificationCount: 0,
        modifyingPaths: [],
      });
      return scope;
    case 'Identifier': {
      const referencedBinding = findReferencedBinding(scope, node);
      if (!referencedBinding)
        throw new Error(
          `Couldn't find a referencedDeclaration. I.e. couldn't find a node with id ${node.referencedDeclaration}`,
        );

      referencedBinding.referenced = true;
      ++referencedBinding.referenceCount;
      referencedBinding.referencingPaths.push(path);
      scope.referencedBindings.push(referencedBinding);

      if (parent.nodeType === 'Assignment' && path.containerName === 'leftHandSide') {
        referencedBinding.modified = true;
        ++referencedBinding.modificationCount;
        referencedBinding.modifyingPaths.push(path);
        scope.modifiedBindings.push(referencedBinding);
      }
      return scope;
    }
    case 'PragmaDirective':
    case 'ParameterList':
    case 'Block':
    case 'VariableDeclarationStatement':
    case 'ExpressionStatement':
    case 'Assignment':
    case 'BinaryOperation':
    case 'ElementaryTypeName':
    case 'Literal':
      return scope;
    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(node.nodeType);
  }
};

/**
 * Starting at current `scope` and going up the nested scope object, return the first
 * `scope` that causes the provided `callback` to return a truthy value,
 * or `null` if the `callback` never returns a truthy value.
 */
export const findScopeAncestor = (scope, callback) => {
  do {
    if (callback(scope)) return scope;
  } while ((scope = scope.parentScope));
  return null;
};

/*
 * Execute a callback on the scope, recursively up the scope's ancestors.
 * The callback must return something falsey if it can't find what it's looking
 * for. Otherwise, (if it finds what it's looking for) it can return whatever
 * it wants.
 */
export const findInScopeAncestors = (scope, callback) => {
  if (!scope) return null; // No more scope to look at. So not found anywhere.
  return callback(scope) || findInScopeAncestors(scope.parentScope, callback);
};

export const findReferencedBinding = (scope, referencingNode) => {
  const node = referencingNode;
  if (!node.referencedDeclaration) return null;
  return findInScopeAncestors(scope, s => {
    return s.bindings.find(binding => binding.node.id === node.referencedDeclaration);
  });
};

export const collectAllAncestorBindings = scope => {
  let bindings = [];
  do {
    if (!scope.bindings) continue;
    bindings = bindings.concat(scope.bindings);
  } while ((scope = scope.parentScope));
  return bindings;
};

export const collectAllStateVariableBindings = scope => {
  return collectAllAncestorBindings(scope).filter(binding => binding.stateVariable);
};
