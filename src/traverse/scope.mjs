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
        secretVariable: node.isSecret === true,
        // incrementingOrAccumulating: 'accumulating', // replaced by isIncremented indicator
        referenced: false,
        referenceCount: 0,
        referencingPaths: [], // paths which reference this binding
        modified: false,
        modificationCount: 0,
        modifyingPaths: [], // paths which reference this binding
      });

      if (scope.scopeType === 'ContractDefinition' && node.isSecret) {
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
          indicatorObj.nullifierRequired = null; // we don't know yet
          contractDefScope.indicators.nullifiersRequired = true;
          indicatorObj.initialisationRequired = true;
          if (node.isKnown) indicatorObj.isKnown = true;
          if (node.isUnknown) indicatorObj.isUnknown = true;
        }

        if (indicatorObj.isKnown && indicatorObj.isUnknown) {
          throw new Error(
            `Secret state ${node.name} cannot be marked as known and unknown in the same scope`,
          );
        }

        if (!indicatorForStateVarExists) fnDefScope.indicators.push(indicatorObj);
      }

      return scope;
    }
    case 'ExpressionStatement':
    case 'VariableDeclarationStatement':
    case 'PragmaDirective':
    case 'ParameterList':
    case 'Block':
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

export const isIncremented = (expressionNode, lhsNode, scope) => {
  // here: flag rewrites and incrementations
  let isIncrementedBool;
  let isDecrementedBool;
  // first, check if the LHS node is secret
  let lhsSecret;
  if (lhsNode.nodeType === 'Identifier') {
    const lhsbinding = findReferencedBinding(scope, lhsNode);
    lhsSecret = !!lhsbinding.secretVariable;
  }
  switch (expressionNode.nodeType) {
    case 'Assignment': {
      // a += something, -= something
      if (lhsSecret && expressionNode.operator === '+=') {
        isIncrementedBool = true;
        isDecrementedBool = false;
        break;
      } else if (lhsSecret && expressionNode.operator === '-=') {
        isIncrementedBool = true;
        isDecrementedBool = true;
        break;
      }
      // b *= something, b /= something
      if (
        expressionNode.operator === '%=' ||
        expressionNode.operator === '/=' ||
        expressionNode.operator === '*='
      ) {
        isIncrementedBool = false;
        break;
      }
      const rhsType = expressionNode.rightHandSide.nodeType;
      if (rhsType === 'BinaryOperation') {
        const binopNode = expressionNode.rightHandSide;
        const params = [binopNode.leftExpression, binopNode.rightExpression];
        const op = expressionNode.rightHandSide.operator;
        // TODO deal with binops like a + b - c, c < a + b
        if (!op.includes('+') && !op.includes('-')) {
          isIncrementedBool = false;
          break;
        }
        for (const [index, param] of params.entries()) {
          // recursively checks for binop + binop
          if (param.nodeType === 'BinaryOperation') {
            if (!param.operator.includes('+')) {
              isIncrementedBool = false;
              break;
            }
            params[index] = param.leftExpression;
            params.push(param.rightExpression);
          }
        }
        for (const param of params) {
          logger.info(`at param ${param.name}`);
          if (param.referencedDeclaration) {
            const isSecret = findReferencedBinding(scope, param).secretVariable;
            logger.info(`param is secret? ${isSecret}`);
            // a = a + b
            if (isSecret && param.name === lhsNode.name && op.includes('+')) {
              isIncrementedBool = true;
              isDecrementedBool = false;
              break;
            }
            // b = a + something
            if (!lhsSecret && isSecret && op.includes('+')) {
              isIncrementedBool = true;
              isDecrementedBool = false;
              break;
            }
            // a = a - something
            if (
              isSecret &&
              param.name === lhsNode.name &&
              op.includes('-') &&
              param === binopNode.leftExpression
            ) {
              isIncrementedBool = true;
              isDecrementedBool = true;
              break;
            }
            // if none, go to the next param
          }
        }
      } else if (rhsType === 'Identifier') {
        // c = a + b, a = c
        // TODO consider cases where c has lots of modifiers, which might cancel out the incrementation of a
        // TODO consider doing this at the level of c, not a, maybe that works out better
        const rhsbinding = findReferencedBinding(scope, expressionNode.rightHandSide);
        const isSecret = rhsbinding.secretVariable;
        // looking at modifiers of c...
        if (rhsbinding && rhsbinding.modified) {
          // for each modifier, replace a with c and see if there are incrementations..
          for (const path of rhsbinding.modifyingPaths) {
            const modifyingNode = path.node;
            // ... and if a xor c are secret, then true
            if (isIncremented(modifyingNode, lhsNode, scope) && (lhsSecret || isSecret)) {
              isIncrementedBool = true;
              break;
            }
          }
        }
      }
      if (!isIncrementedBool) isIncrementedBool = false;
      break;
    }
    // TODO are there incrementations which aren't assignments?
    default:
      isIncrementedBool = false;
      break;
  }
  console.log(`statement is incremented? ${isIncrementedBool}`);
  console.log(`statement is decremented? ${isDecrementedBool}`);
  expressionNode.isIncremented = isIncrementedBool;
  expressionNode.isDecremented = isDecrementedBool;
  // 2) Update the indicators of the scope:
  const referencedBinding = findReferencedBinding(scope, lhsNode);
  if (referencedBinding.node.stateVariable && isInScopeType(scope, 'FunctionDefinition')) {
    const fnDefScope = getScopeAncestorOfType(scope, 'FunctionDefinition');
    // console.log(fnDefScope);
    const fnIndicatorObj = fnDefScope.indicators.find(obj => obj.binding === referencedBinding);
    console.log(`state has ONLY incrementations in this scope (so far)?`);
    console.log(fnIndicatorObj.isIncremented);
    let stateIsIncremented = isIncrementedBool;
    if (fnIndicatorObj.isIncremented === false) {
      // TODO move this further up, this part says: if there's an overwriting statement in the same scope, then this is also a rewriting, regardless of how its written
      stateIsIncremented = false;
    }

    // TODO is the below needed for an ExpressionStatement?
    // indicatorObj.referencingPaths.push(path);
    fnIndicatorObj.isIncremented = stateIsIncremented;
    if (isIncrementedBool === false) {
      // statement is an overwrite
      fnIndicatorObj.isWhole = true;
      const reason = `Overwritten at ${expressionNode.src}`;
      console.log(reason);
      if (fnIndicatorObj.isWholeReason) {
        fnIndicatorObj.isWholeReason.push(reason);
      } else {
        fnIndicatorObj.isWholeReason = [reason];
      }
    }
  }

  return isIncrementedBool;
};
