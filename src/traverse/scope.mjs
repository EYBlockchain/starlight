/* eslint-disable no-shadow, no-param-reassign, no-use-before-define */

import logger from '../utils/logger.mjs';

// TODO: better scope handling
export const updateScope = (path, scope) => {
  const { node, parent } = path;
  if (Object.keys(scope).length === 0 && node.nodeType !== 'SourceUnit') return {}; // for lazy traversal which doesn't make use of scope

  switch (node.nodeType) {
    case 'SourceUnit':
      return {
        scopeId: 0,
        scopeType: 'SourceUnit',
        parentScope: {},
        bindings: [],
        referencedBindings: [],
        modifiedBindings: [],
      };

    case 'ContractDefinition':
      // a 'ContractDefinition' is a declaration (binding) within a SourceUnit scope.
      scope.bindings.push({
        id: node.id,
        name: node.name,
        node,
        path,
      });
      // enter a new scope:
      return {
        scopeId: parent.id,
        scopeType: 'ContractDefinition',
        parentScope: scope,
        bindings: [],
        referencedBindings: [],
        modifiedBindings: [],
        indicators: {
          // bespoke to a 'ContractDefinition' scope.
          zkSnarkVerificationRequired: false,
          oldCommitmentReferencesRequired: false,
          nullifiersRequired: false,
          commitmentsRequired: false,
        },
      };

    case 'FunctionDefinition':
      // a 'FunctionDefinition' is a declaration (binding) within a Contract scope.
      scope.bindings.push({
        id: node.id,
        name: node.name,
        node,
        path,
      });
      // enter a new scope:
      return {
        scopeId: parent.id,
        scopeType: 'FunctionDefinition',
        parentScope: scope,
        bindings: [],
        referencedBindings: [],
        modifiedBindings: [],
        indicators: [
          // {
          //   id: state_var_node_id
          //   name: state_var_name,
          //   binding: { binding_of_var_decl },
          //   referenced: true,
          //   referencingPaths: [
          //     {path_of_identifier}, {path_of_identifier},...
          //   ],
          //   modified: true,
          //   modifyingPaths: [
          //     {path_of_identifier}, {path_of_identifier},...
          //   ], // a subset of referencingPaths
          //   oldCommitmentReferenceRequired: true,
          //   nullifierRequired: true,
          //   initialisationRequired: true,
          //   newCommitmentRequired: true,
          // }
        ],
      };

    case 'VariableDeclaration':
      scope.bindings.push({
        id: node.id,
        name: node.name,
        node,
        path,
        stateVariable: node.stateVariable,
        secretVariable: node.sprinkle === 'secret',
        incrementingOrAccumulating: 'accumulating',
        referenced: false,
        referenceCount: 0,
        referencingPaths: [], // paths which reference this binding
        modified: false,
        modificationCount: 0,
        modifyingPaths: [], // paths which reference this binding
      });

      if (scope.scopeType === 'ContractDefinition' && node.sprinkle === 'secret') {
        scope.indicators.commitmentsRequired = true;
        scope.indicators.zkSnarkVerificationRequired = true;
      }

      return scope;

    case 'Identifier': {
      // 1) Update the binding this Identifier node is referencing:
      const referencedBinding = findReferencedBinding(scope, node);
      if (!referencedBinding)
        throw new Error(
          `Couldn't find a referencedDeclaration. I.e. couldn't find a node with id ${node.referencedDeclaration}`,
        );

      referencedBinding.referenced = true;
      ++referencedBinding.referenceCount;
      referencedBinding.referencingPaths.push(path);
      scope.referencedBindings.push(referencedBinding);

      // Currently, the only state variable 'modification' we're aware of is when a state variable is referenced on the LHS of an assignment:
      if (parent.nodeType === 'Assignment' && path.containerName === 'leftHandSide') {
        referencedBinding.modified = true;
        ++referencedBinding.modificationCount;
        referencedBinding.modifyingPaths.push(path);
        scope.modifiedBindings.push(referencedBinding);
      }

      // 2) Update the indicators of the scope:
      const referencedNode = referencedBinding.node;
      if (referencedNode.stateVariable && isInScopeType(scope, 'FunctionDefinition')) {
        const fnDefScope = getScopeAncestorOfType(scope, 'FunctionDefinition');
        const contractDefScope = getScopeAncestorOfType(scope, 'ContractDefinition');
        let indicatorObj = fnDefScope.indicators.find(obj => obj.binding === referencedBinding);
        const indicatorForStateVarExists = !!indicatorObj;
        if (!indicatorForStateVarExists)
          indicatorObj = {
            id: referencedNode.id,
            name: referencedNode.name,
            binding: referencedBinding,
            referencingPaths: [],
            modifyingPaths: [],
          };

        // All of the below indicator assignments will need more thought. There are a lot of cases to check, which aren't checked at all yet.
        indicatorObj.referenced = true;
        indicatorObj.referencingPaths.push(path);
        indicatorObj.oldCommitmentReferenceRequired = true;
        contractDefScope.indicators.oldCommitmentReferencesRequired = true;

        // Currently, the only state variable 'modification' we're aware of is when a state variable is referenced on the LHS of an assignment:
        if (parent.nodeType === 'Assignment' && path.containerName === 'leftHandSide') {
          indicatorObj.modified = true;
          indicatorObj.modifyingPaths.push(path);
          indicatorObj.newCommitmentRequired = true;
          indicatorObj.nullifierRequired = true;
          contractDefScope.indicators.nullifiersRequired = true;
          indicatorObj.initialisationRequired = true;
        }

        if (!indicatorForStateVarExists) fnDefScope.indicators.push(indicatorObj);
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

// TODO: THIS SCOPE STUFF SHOULD REALLY BE IN A CLASS, AND THE BELOW SHOULD BE METHODS OF THAT CLASS... It's just difficult to figure out how to initialise such a scope class, mainly because the top-level node of an AST has no parent.

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
export const queryScopeAncestors = (scope, callback) => {
  if (!scope) return null; // No more scope to look at. So not found anywhere.
  return callback(scope) || queryScopeAncestors(scope.parentScope, callback);
};

/**
 * A helper to find if a given scope is a descendant of a particular @param {string} scopeType
 * @returns {Boolean}
 */
export const isInScopeType = (scope, scopeType) => {
  while (scope) {
    if (scope.scopeType === scopeType) return true;
    scope = scope.parentScope;
  }

  return false;
};

/**
 * @param {string} nodeType - a valid scopeType.
 * Get the first @return {scope || null} matching the given scopeType, in which the input `scope` is contained (including the input scope itself in the search).
 */
export const getScopeAncestorOfType = (scope, scopeType) => {
  return findScopeAncestor(scope, scope => scope.scopeType === scopeType);
};

export const findReferencedBinding = (scope, referencingNode) => {
  const node = referencingNode;
  if (!node.referencedDeclaration) return null;
  return queryScopeAncestors(scope, s => {
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
