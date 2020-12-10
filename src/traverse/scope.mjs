/* eslint-disable no-shadow, no-param-reassign, no-use-before-define, no-continue */

import logger from '../utils/logger.mjs';
import { scopeCache } from './cache.mjs';

/**
 * Analogue of Array.filter, but for objects.
 * The callback will take as input each 'value' of the input obj.
 */
const filterObject = (obj, callback) => {
  const filteredObject = Object.keys(obj).reduce((acc, key) => {
    if (!callback(obj[key])) delete acc[key];
    return acc;
  }, obj);
  return filteredObject;
};

/**
 * Analogue of Array.some, but for objects.
 * The callback will take as input each 'value' of the input obj.
 */
const someObject = (obj, callback) => {
  for (const value of Object.values(obj)) {
    if (callback(value)) return true;
  }
  return false;
};

/**
 * Analogue of Array.every, but for objects.
 * The callback will take as input each 'value' of the input obj.
 */
const everyObject = (obj, callback) => {
  let result = true;
  for (const value of Object.values(obj)) {
    result = !!callback(value);
    if (result === false) return result;
  }
  return result;
};

/**
 * Analogue of Array.includes, but for objects.
 * The callback will take as input each 'value' of the input obj.
 */
const includesObject = (obj, valueToFind) => {
  for (const value of Object.values(obj)) {
    if (value === valueToFind) return true;
  }
  return false;
};

export class Scope {
  /**
   * @param {NodePath} path - the nodePath of the node around which we're
   * getting / creating 'scope'
   */
  constructor(path) {
    const { node } = path;
    const cachedScope = scopeCache.get(node);
    if (cachedScope && cachedScope.path) return cachedScope;

    this.scopeId = node.id;
    this.scopeType = node.nodeType;
    this.path = path;
    this.bindings = {}; // keys are AST node `id`s
    this.referencedBindings = {}; // keys are AST node `id`s
    this.modifiedBindings = {}; // keys are AST node `id`s
    this.indicators = {}; // keys are stateVariable names

    scopeCache.set(node, this); // mapping from a node to its scope.

    this.initialiseIndicators();
  }

  get parentScope() {
    const parentPath = this.path.findAncestorFromParent(p => p.isScopable());
    return parentPath ? parentPath.scope : undefined;
  }

  // we might be able to get away with not initialising indicators.
  initialiseIndicators() {
    switch (this.scopeType) {
      case 'ContractDefinition':
        this.indicators = {
          zkSnarkVerificationRequired: false,
          oldCommitmentReferencesRequired: false,
          nullifiersRequired: false,
          commitmentsRequired: false,
        };
        break;
      case 'FunctionDefinition':
        this.indicators = {
          // id: { // Although state variables have unique names, id is more consistent with other objects
          //   id: state_var_node_id
          //   name: state_var_name,
          //   binding: { binding_of_var_decl },
          //   isReferenced: true,
          //   referenceCount: 3,
          //   referencingPaths: [
          //     path_of_identifier,
          //     path_of_identifier,
          //     ...
          //   ], // we use an array to preserve the order of references
          //   isModified: true,
          //   modificationCount: 1,
          //   modifyingPaths: [
          //     path_of_identifier,
          //     path_of_identifier,
          //     ...
          //   ], // a subset of referencingPaths. // we use an array to preserve the order of references
          //   oldCommitmentReferenceRequired: true,
          //   nullifierRequired: true,
          //   initialisationRequired: true,
          //   newCommitmentRequired: true,
          // }
        };
        break;
      default:
    }
  }

  update(path) {
    const { node, parent } = path;
    const { name, id, nodeType } = node;

    if (this.bindings[id])
      throw new Error(
        `Whilst updating scope for nodeType ${nodeType}, expected this.bindings[${id}] to be undefined, but found binding: ${this.bindings[id]} for this scope: ${this}`,
      );

    switch (nodeType) {
      case 'ContractDefinition':
      case 'FunctionDefinition':
        // a 'ContractDefinition' is a declaration (binding) within a SourceUnit scope.
        // a 'FunctionDefinition' is a declaration (binding) within a ContractDefinition scope.
        this.bindings[id] = this.bindings[id] || {
          kind: nodeType,
          id,
          name,
          node,
          path,
          scope: this,
        };
        break;

      case 'VariableDeclaration':
        this.bindings[id] = this.bindings[id] || {
          kind: nodeType, // TODO: make 'kind' more specific, e.g. 'param'?
          id,
          name,
          node,
          path,
          scope: this,
          stateVariable: node.stateVariable,
          isSecret: node.isSecret,
          // incrementingOrAccumulating: 'accumulating', // replaced by isIncremented indicator
          isReferenced: false,
          referenceCount: 0,
          referencingPaths: [], // paths which reference this binding
          isModified: false,
          modificationCount: 0,
          modifyingPaths: [], // paths which reference this binding
        };

        if (this.scopeType === 'ContractDefinition' && node.isSecret) {
          this.indicators.commitmentsRequired = true;
          this.indicators.zkSnarkVerificationRequired = true;
        }
        break;

      case 'Identifier': {
        // 1) Update the binding this Identifier node is referencing:

        if (node.referencedDeclaration < 0) break;
        // we have a mapping with key msg.sender
        // ... we stop, because this identifier just represents the key, we account for this

        const referencedBinding = this.getReferencedBinding(node);

        if (!referencedBinding)
          throw new Error(
            `Couldn't find a referencedDeclaration. I.e. couldn't find a node with id ${node.referencedDeclaration}`,
          );

        const referencedNode = referencedBinding.node;
        const referencedId = referencedBinding.id;
        const referencedName = referencedBinding.name;

        // Update the referenced variable's binding, to say "this variable has been referred-to by this node (`path`)"
        if (!referencedBinding.referencingPaths.some(p => p.node.id === path.node.id)) {
          referencedBinding.isReferenced = true;
          ++referencedBinding.referenceCount;
          referencedBinding.referencingPaths.push(path);
        }

        // update this scope, to say "the code in this scope 'refers to' a variable (i.e. a binding) declared elsewhere"
        this.referencedBindings[referencedId] = referencedBinding;

        // Currently, the only state variable 'modification' we're aware of is when a state variable is referenced on the LHS of an assignment:
        if (
          path.getAncestorContainedWithin('leftHandSide') &&
          path.getAncestorOfType('Assignment')
        ) {
          // Update the referenced variable's binding, to say "this variable has been referred-to by this node (`path`)"
          if (!referencedBinding.modifyingPaths.some(p => p.node.id === path.node.id)) {
            referencedBinding.isModified = true;
            ++referencedBinding.modificationCount;
            referencedBinding.modifyingPaths.push(path);
          }

          // update this scope, to say "the code in this scope 'modifies' a variable declared elsewhere"
          this.modifiedBindings[referencedId] = referencedBinding;
        }

        // 2) Update the indicators of this scope:
        if (referencedNode.stateVariable && this.isInScopeType('FunctionDefinition')) {
          const functionDefScope = this.getAncestorOfScopeType('FunctionDefinition');
          const contractDefScope = this.getAncestorOfScopeType('ContractDefinition');

          let referencedIndicator = functionDefScope.indicators[referencedId];
          const indicatorForStateVarExists = !!referencedIndicator;
          if (!indicatorForStateVarExists)
            referencedIndicator = {
              id: referencedId,
              name: referencedName,
              binding: referencedBinding,
              referencingPaths: [],
              modifyingPaths: [],
            };

          // All of the below indicator assignments will need more thought. There are a lot of cases to check, which aren't checked at all yet.
          if (!referencedIndicator.referencingPaths.some(p => p.node.id === path.node.id)) {
            referencedIndicator.isReferenced = true;
            ++referencedIndicator.referenceCount;
            referencedIndicator.referencingPaths.push(path);
            referencedIndicator.oldCommitmentReferenceRequired = true;
          }

          // TODO: is this in a sensible place?
          contractDefScope.indicators.oldCommitmentReferencesRequired = true;

          // Currently, the only state variable 'modification' we're aware of is when a state variable is referenced on the LHS of an assignment:
          if (
            path.getAncestorContainedWithin('leftHandSide') &&
            path.getAncestorOfType('Assignment')
          ) {
            if (!referencedIndicator.modifyingPaths.some(p => p.node.id === path.node.id)) {
              referencedIndicator.isModified = true;
              ++referencedIndicator.modificationCount;
              referencedIndicator.modifyingPaths.push(path);
            }
            referencedIndicator.newCommitmentRequired = true;
            referencedIndicator.nullifierRequired = null; // we don't know yet
            referencedIndicator.initialisationRequired = true;
            if (node.isKnown) referencedIndicator.isKnown = true;
            if (node.isUnknown) referencedIndicator.isUnknown = true;

            contractDefScope.indicators.nullifiersRequired = true;
          }

          if (referencedIndicator.isKnown && referencedIndicator.isUnknown) {
            throw new Error(
              `Secret state ${node.name} cannot be marked as both known and unknown in the same ${this.scopeType} scope`,
            );
          }

          if (!indicatorForStateVarExists)
            functionDefScope.indicators[referencedNode.id] = referencedIndicator;
        }
        break;
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
      case 'IndexAccess':
      case 'MemberAccess':
      case 'Mapping': // TODO
        break;
      // And again, if we haven't recognized the nodeType then we'll throw an
      // error.
      default:
        throw new TypeError(node.nodeType);
    }
  }

  /**
   * Starting at current `scope` and going up the nested scope object, return the first
   * `scope` that causes the provided `callback` to return a truthy value,
   * or `null` if the `callback` never returns a truthy value.
   */
  findAncestor(callback) {
    let scope = this;
    do {
      if (callback(scope)) return scope;
    } while ((scope = scope.parentScope));
    return null;
  }

  /*
   * Execute a callback on the scope, recursively up the scope's ancestors.
   * The callback must return something falsey if it can't find what it's looking
   * for. Otherwise, (if it finds what it's looking for) it can return whatever
   * it wants.
   */
  queryAncestors(callback) {
    const scope = this;
    if (!scope) return null; // No more scope to look at. So not found anywhere.
    return (
      callback(scope) || (scope.parentScope ? scope.parentScope.queryAncestors(callback) : null)
    );
  }

  /**
   * A helper to find if a given scope is a descendant of a particular @param {string} scopeType
   * @returns {Boolean}
   */
  isInScopeType(scopeType) {
    let scope = this;
    while (scope) {
      if (scope.scopeType === scopeType) return true;
      scope = scope.parentScope;
    }

    return false;
  }

  /**
   * @param {string} nodeType - a valid scopeType.
   * Get the first @return {scope || null} matching the given scopeType, in which the input `scope` is contained (including the input scope itself in the search).
   */
  getAncestorOfScopeType(scopeType) {
    return this.findAncestor(scope => scope.scopeType === scopeType);
  }

  /**
   * @returns {Binding} - the binding of the node being referred-to by the input referencingNode.
   */
  getReferencedBinding(referencingNode) {
    const node = referencingNode;
    const id = node.referencedDeclaration;
    if (!id) return null; // if the node doesn't refer to another variable
    return this.queryAncestors(s => {
      return s.bindings[id];
    });
  }

  /**
   * @returns {Binding} - the node being referred-to by the input referencingNode.
   */
  getReferencedNode(referencingNode) {
    const binding = this.getReferencedBinding(referencingNode);
    return binding ? binding.node : binding;
  }

  /**
   * @returns {Object} - all bindings from all ancestor scopes.
   */
  getAncestorBindings() {
    let scope = this;
    let result = {};
    do {
      const { bindings } = scope;
      if (!bindings) continue;
      result = Object.assign(bindings, result);
    } while ((scope = scope.parentScope));
    return result;
  }

  /**
   * @param {Array<string>} booleanKeys - an array of strings of the boolean keys of a binding object. NOTE: only filters `this` scope. Use filterAncestorBindings to filter all bindings from `this` and higher scopes.
   * @returns {Object} - a set of bindings, filtered according to the booleanKeys
   */
  filterBindingsByBooleans(booleanKeys) {
    let result = {};
    if (!Array.isArray(booleanKeys)) throw new Error('booleanKeys param must be an array.');
    const validBooleanKeys = [
      'stateVariable',
      'isSecret',
      'isRefenced',
      'isModified',
      'isWhole',
      'isPartitioned',
      'isIncremented',
    ];
    booleanKeys.forEach(str => {
      if (!validBooleanKeys.includes(str))
        throw new Error(`Invalid indicatorString ${str}. Must be one of ${validBooleanKeys}`);
    });
    const { bindings } = this;
    result = Object.keys(bindings).reduce((acc, id) => {
      booleanKeys.forEach(str => {
        if (!bindings[id][str]) delete acc[id];
      });
      return acc;
    }, bindings);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.filter prototype)
   * @returns {Object} - a set of bindings from this scope, filtered according to the callback
   */
  filterBindings(callback) {
    const { bindings } = this;
    const result = filterObject(bindings, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.filter prototype)
   * @returns {Object} - a set of bindings from this scope, filtered according to the callback
   */
  filterAncestorBindings(callback) {
    const ancestorBindings = this.getAncestorBindings();
    const result = filterObject(ancestorBindings, callback);
    return result;
  }

  /**
   * @returns {Boolean} - if a stateVariable is modified within the scope (of a FunctionDefinition scope).
   */
  modifiesSecretState() {
    if (this.scopeType !== 'FunctionDefinition') return false;
    const { indicators } = this;
    for (const stateVarId of Object.keys(indicators)) {
      const indicator = indicators[stateVarId];
      if (indicator.isModified && indicator.binding.isSecret) return true;
    }
    return false;
  }

  /**
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.filter prototype)
   * @returns {Object} - a set of modifiedBindings from this scope, filtered according to the callback
   */
  filterModifiedBindings(callback) {
    const { modifiedBindings } = this;
    const result = filterObject(modifiedBindings, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.filter prototype)
   * @returns {Object} - a set of modifiedBindings from this scope, filtered according to the callback
   */
  filterReferencedBindings(callback) {
    const { referencedBindings } = this;
    const result = filterObject(referencedBindings, callback);
    return result;
  }

  /**
   * @param {Array<string>} booleanKeys - an array of strings of the boolean keys of a FunctionDefition scope's indicator object.
   * @returns {Object} - a FunctionDefition scope's indicators, filtered according to the booleanKeys
   */
  filterIndicatorsByBooleans(booleanKeys) {
    let result = {};
    if (!Array.isArray(booleanKeys)) throw new Error('booleanKeys param must be an array.');
    let validBooleanKeys;
    switch (this.scopeType) {
      case 'FunctionDefinition':
        validBooleanKeys = [
          'isReferenced',
          'isModified',
          'oldCommitmentRequired',
          'nullifierRequired',
          'initialisationRequired',
          'newCommitmentRequired',
          'isIncremented',
          'isDecremented',
          'isWhole',
          // TODO: include all boolean keys from a binding in this indicator as well! But be careful; a boolean being true in a binding doesn't mean it's true in a FunctionDefniition scope's indicators.
        ];
        break;
      case 'ContractDefinition':
        validBooleanKeys = [
          'zkSnarkVerificationRequired',
          'oldCommitmentReferencesRequired',
          'nullifiersRequired',
          'commitmentsRequired',
        ];
        break;
      default:
        throw new Error(
          `filterIndicators is only supported for scopeTypes 'FunctionDefinition and ContractDefinition`,
        );
    }

    booleanKeys.forEach(str => {
      if (!validBooleanKeys.includes(str))
        throw new Error(`Invalid indicatorString ${str}. Must be one of ${validBooleanKeys}`);
    });
    const { indicators } = this;
    result = Object.keys(indicators).reduce((acc, id) => {
      booleanKeys.forEach(str => {
        if (!indicators[id][str]) delete acc[id];
      });
      return acc;
    }, indicators);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes an indicator object as input and returns a boolean (same as the Array.filter prototype)
   * @returns {Object} - a FunctionDefition scope's indicators, filtered according to the callback
   */
  filterIndicators(callback) {
    const result = filterObject(this.indicators, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes an indicator object as input and returns a boolean (same as the Array.some prototype)
   * @returns {Boolean} - true if all values of the object are evaluated as 'true' by the callback
   */
  someIndicators(callback) {
    const result = someObject(this.indicators, callback);
    return result;
  }

  /**
   * Gets a Function Definition scope's indicator object for a particular state variable.
   * @param {Number} id - an AST node's id.
   * @returns {Indicator Object || null}
   */
  getIndicatorById(id) {
    return this.indicators[id] || {};
  }

  /**
   * Gets a Function Definition scope's indicator object for a particular state variable.
   * @param {Number} id - an AST node's id.
   * @returns {Indicator Object || null}
   */
  getIndicatorByName(name) {
    for (const indicator of Object.values(this.indicators)) {
      if (indicator.name === name) return indicator;
    }
    return null;
  }

  // TODO: one for 'uses' secret state?

  isIncremented(expressionNode, lhsNode) {
    const scope = this;
    // here: flag rewrites and incrementations
    let isIncrementedBool;
    let isDecrementedBool;
    // first, check if the LHS node is secret
    let lhsSecret;
    if (lhsNode.nodeType === 'Identifier') {
      const lhsbinding = scope.getReferencedBinding(lhsNode);
      lhsSecret = !!lhsbinding.isSecret;
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
              const isSecret = scope.getReferencedBinding(param).secretVariable;
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
          const rhsbinding = scope.getReferencedBinding(expressionNode.rightHandSide);
          const isSecret = rhsbinding.secretVariable;
          // looking at modifiers of c...
          if (rhsbinding && rhsbinding.isModified) {
            // for each modifier, replace a with c and see if there are incrementations..
            for (const path of rhsbinding.modifyingPaths) {
              const modifyingNode = path.node;
              // ... and if a xor c are secret, then true
              if (scope.isIncremented(modifyingNode, lhsNode) && (lhsSecret || isSecret)) {
                isIncrementedBool = true;
                break;
              }
            }
          }
        }
        if (!isIncrementedBool) {
          isIncrementedBool = false;
          isDecrementedBool = false;
        }
        break;
      }
      // TODO are there incrementations which aren't assignments?
      // Yes - unary operators
      default:
        isIncrementedBool = false;
        isDecrementedBool = false;
        break;
    }
    console.log(`statement is incremented? ${isIncrementedBool}`);
    console.log(`statement is decremented? ${isDecrementedBool}`);
    expressionNode.isIncremented = isIncrementedBool;
    expressionNode.isDecremented = isDecrementedBool;

    return { isIncrementedBool, isDecrementedBool };
  }
}

export default Scope;
