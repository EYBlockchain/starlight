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
          //   referencingPaths: [
          //     path_of_identifier,
          //     path_of_identifier,
          //     ...
          //   ], // we use an array to preserve the order of references
          //   isModified: true,
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
        if (node.typeDescriptions.typeString.includes('mapping')) {
          this.bindings[id].mappingKey = {};
        }
        break;

      case 'Identifier': {
        // 1) Update the binding this Identifier node is referencing:

        if (node.referencedDeclaration < 0) break;
        // we have a mapping with key msg.sender
        // ... we stop, because this identifier just represents the key, we account for this

        let referencedBinding = this.getReferencedBinding(node);

        if (!referencedBinding)
          throw new Error(
            `Couldn't find a referencedDeclaration. I.e. couldn't find a node with id ${node.referencedDeclaration}`,
          );

        const referencedNode = referencedBinding.node;
        const referencedId = referencedBinding.id;
        const referencedName = referencedBinding.name;
        const parentBinding = referencedBinding;

        const isMapping = node.typeDescriptions.typeString.includes('mapping');

        if (isMapping) {
          const keyNode = parent.indexExpression.expression || parent.indexExpression;
          let keyName = keyNode.name;
          if (this.getReferencedBinding(keyNode).isModified)
            keyName = `${keyName}_${this.getReferencedBinding(keyNode).modificationCount}`;
          const bindingExists = !!referencedBinding.mappingKey[keyName];
          if (!bindingExists)
            referencedBinding.mappingKey[keyName] = {
              isReferenced: false,
              referenceCount: 0,
              referencingPaths: [], // paths which reference this binding
              isModified: false,
              modificationCount: 0,
              modifyingPaths: [], // paths which reference this binding};
            };
          referencedBinding = referencedBinding.mappingKey[keyName];
        }

        // update the referenced binding, to say "this variable has been referred-to by this node (`node`)"
        if (!referencedBinding.referencingPaths.some(p => p.node.id === path.node.id)) {
          referencedBinding.isReferenced = true;
          if (isMapping) parentBinding.isReferenced = true;
          ++referencedBinding.referenceCount;
          referencedBinding.referencingPaths.push(path);
        }
        // update this scope, to say "the code in this scope 'refers to' a variable declared elsewhere"
        this.referencedBindings[referencedId] = referencedBinding;

        // Currently, the only state variable 'modification' we're aware of is when a state variable is referenced on the LHS of an assignment:
        if (
          (path.containerName !== 'indexExpression' &&
            path.getAncestorContainedWithin('leftHandSide') &&
            path.getAncestorOfType('Assignment')) ||
          (path.getAncestorOfType('UnaryOperation') && path.containerName !== 'indexExpression')
        ) {
          // update the referenced binding, to say "this variable has been modified by this node (`node`)"
          if (!referencedBinding.modifyingPaths.some(p => p.node.id === path.node.id)) {
            referencedBinding.isModified = true;
            ++referencedBinding.modificationCount;
            referencedBinding.modifyingPaths.push(path);
          }

          if (isMapping) {
            this.getReferencedBinding(node).isModified = true;
          }

          // update this scope, to say "the code in this scope 'modifies' a variable declared elsewhere"
          this.modifiedBindings[referencedId] = this.getReferencedBinding(node);
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
              binding: this.getReferencedBinding(node),
              referencingPaths: [],
              referenceCount: 0,
              modifyingPaths: [],
              modificationCount: 0,
            };

          const parentIndicator = referencedIndicator;
          if (isMapping) {
            const keyNode = parent.indexExpression.expression || parent.indexExpression;
            if (!referencedIndicator.mappingKey) {
              referencedIndicator.mappingKey = {};
            }
            let keyName = keyNode.name;
            if (this.getReferencedBinding(keyNode).isModified)
              keyName = `${keyName}_${this.getReferencedBinding(keyNode).modificationCount}`;
            if (!referencedIndicator.mappingKey[keyName]) {
              referencedIndicator.mappingKey[keyName] = {
                isReferenced: false,
                referenceCount: 0,
                referencingPaths: [], // paths which reference this binding
                isModified: false,
                modificationCount: 0,
                modifyingPaths: [], // paths which reference this binding};
              };
            }
            referencedIndicator = referencedIndicator.mappingKey[keyName];
          }

          // All of the below indicator assignments will need more thought. There are a lot of cases to check, which aren't checked at all yet.
          if (!referencedIndicator.referencingPaths.some(p => p.node.id === path.node.id)) {
            referencedIndicator.isReferenced = true;
            ++referencedIndicator.referenceCount;
            referencedIndicator.referencingPaths.push(path); // might overwrite, but that's ok.
            referencedIndicator.oldCommitmentReferenceRequired = true;
          }
          contractDefScope.indicators.oldCommitmentReferencesRequired = true;

          // Currently, the only state variable 'modification' we're aware of is when a state variable is referenced on the LHS of an assignment:
          if (
            (path.containerName !== 'indexExpression' &&
              path.getAncestorContainedWithin('leftHandSide') &&
              path.getAncestorOfType('Assignment')) ||
            (path.getAncestorOfType('UnaryOperation') && path.containerName !== 'indexExpression')
          ) {
            if (!referencedIndicator.modifyingPaths.some(p => p.node.id === path.node.id)) {
              referencedIndicator.isModified = true;
              if (isMapping) parentIndicator.isModified = true;
              ++referencedIndicator.modificationCount;
              referencedIndicator.modifyingPaths.push(path);
            }
            referencedIndicator.newCommitmentRequired = true;
            referencedIndicator.nullifierRequired = null; // we don't know yet
            referencedIndicator.initialisationRequired = true;
            if (node.isKnown || (isMapping && parent.isKnown)) referencedIndicator.isKnown = true;
            if (node.isUnknown || (isMapping && parent.isUnknown))
              referencedIndicator.isUnknown = true;

            contractDefScope.indicators.nullifiersRequired = true;
          }

          if (referencedIndicator.isKnown && referencedIndicator.isUnknown) {
            throw new Error(
              `Secret state ${node.name} cannot be marked as both known and unknown in the same ${this.scopeType} scope`,
            );
          }

          referencedIndicator = parentIndicator;
          if (!indicatorForStateVarExists)
            functionDefScope.indicators[referencedNode.id] = referencedIndicator;

          // console.log(this.getReferencedBinding(node));
          // console.log(functionDefScope.indicators);
          // console.log('---------');
          // console.log(functionDefScope.indicators[5].mappingKey);
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
      case 'Mapping':
      case 'UnaryOperation':
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

  getMappingKeyIndicator(indexAccessNode) {
    const keyNode = indexAccessNode.indexExpression.expression || indexAccessNode.indexExpression;
    let keyName = keyNode.name;
    if (this.getReferencedBinding(keyNode).isModified) {
      const keyBinding = this.getReferencedBinding(keyNode);
      let i = 0;
      for (const modPath of keyBinding.modifyingPaths) {
        if (indexAccessNode.id < modPath.node.id && i === 0) break;
        i++;
        if (
          modPath.node.id < indexAccessNode.id &&
          keyBinding.modifyingPaths[i] &&
          indexAccessNode.id < keyBinding.modifyingPaths[i].node.id
        )
          break;
      }
      if (i > 0) keyName = `${keyNode.name}_${i}`;
    }
    return keyName;
  }

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
    } else if (lhsNode.nodeType === 'IndexAccess') {
      const lhsbinding = scope.getReferencedBinding(lhsNode.baseExpression);
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
            isDecrementedBool = false;
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
            if (param.referencedDeclaration || param.baseExpression) {
              const isSecret = param.baseExpression
                ? scope.getReferencedBinding(param.baseExpression).isSecret
                : scope.getReferencedBinding(param).isSecret;
              logger.info(`param is secret? ${isSecret}`);
              // a = a + b
              if (isSecret && param.name === lhsNode.name && op.includes('+')) {
                isIncrementedBool = true;
                isDecrementedBool = false;
                break;
              }

              if (
                isSecret &&
                param.nodeType === 'IndexAccess' &&
                param.baseExpression.name === lhsNode.baseExpression.name &&
                param.indexExpression.name === lhsNode.indexExpression.name &&
                op.includes('+')
              ) {
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

  indicatorChecks(secretVar) {
    const contractDefScope = this.getAncestorOfScopeType('ContractDefinition');
    if (secretVar.isKnown && secretVar.isWhole)
      logger.warn(
        `PEDANTIC: Unnecessary 'known' decorator. Secret state ${secretVar.name} MUST be known, due to: ${secretVar.isWholeReason}`,
      );
    if ((secretVar.isUnknown || secretVar.binding.isUnknown) && secretVar.isWhole)
      throw new Error(
        `Can't mark a whole state as unknown. The state ${secretVar.name} is whole due to: ${secretVar.isWholeReason}`,
      );
    if (secretVar.isUnknown && secretVar.isIncremented && !secretVar.isWhole) {
      secretVar.isWhole = false;
      secretVar.isWholeReason = [`Incremented and marked as unknown`];
    }
    if (secretVar.isIncremented && secretVar.isWhole === undefined) {
      if (!secretVar.isKnown && !secretVar.isUnknown)
        throw new Error(
          `Secret value assigned to, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know.`,
        );
      if (secretVar.isUnknown) throw new Error(`This should be unreachable code!`);
      if (secretVar.isKnown) {
        secretVar.isWhole = true;
        secretVar.isWholeReason = [`Marked as known`];
      } else {
        logger.warn(
          `State ${secretVar.name} will be treated as a whole state, because there are no unknown decorators`,
        );
        secretVar.isWhole = true;
        secretVar.isWholeReason = [`No unknown decorator or overwrites`];
      }
      // look for duplicates: PEDANTIC: Unnecessary duplicate 'unknown' decorator for secret state `a`.
    }
    if (secretVar.isWhole === false && secretVar.isDecremented) {
      // partitioned/decremented state
      secretVar.nullifierRequired = true;
      contractDefScope.indicators.nullifiersRequired = true;
    }
    if (secretVar.isWhole === false && secretVar.isIncremented) {
      secretVar.nullifierRequired = false;
    } else {
      secretVar.nullifierRequired = true;
      contractDefScope.indicators.nullifiersRequired = true;
    }
    // here - mark the contract obj
    const topScope = contractDefScope.bindings[secretVar.id];
    if (topScope.isWhole && !secretVar.isWhole)
      throw new Error(`State ${secretVar.name} must be whole because: ${topScope.isWholeReason}`);
    if (topScope.isPartitioned && secretVar.isWhole)
      throw new Error(
        `State ${secretVar.name} must be whole because: ${secretVar.isWholeReason}, but is partitioned: ${topScope.isPartitionedReason}`,
      );
    topScope.isWhole = secretVar.isWhole;
    if (topScope.isWhole === false && !topScope.isPartitionedReason) {
      topScope.isPartitioned = true;
      topScope.isPartitionedReason = secretVar.isWholeReason;
    } else if (topScope.isWhole === false && !topScope.isPartitionedReason) {
      secretVar.isWholeReason.forEach(reason => topScope.isPartitionedReason.push(reason));
    } else if (!topScope.isWholeReason) {
      topScope.isWholeReason = secretVar.isWholeReason;
    } else {
      secretVar.isWholeReason.forEach(reason => topScope.isWholeReason.push(reason));
    }
    console.log('Indicator:');
    console.dir(secretVar, { depth: 0 });
    // console.log(`Contract level binding for state:`);
    // console.dir(topScope, { depth: 0 });
    if (topScope.isWholeReason) {
      console.log(topScope.isWholeReason);
    } else {
      console.log(topScope.isPartitionedReason);
    }
  }
}

export default Scope;
