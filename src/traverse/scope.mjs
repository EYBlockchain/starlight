/* eslint-disable no-shadow, no-param-reassign, no-use-before-define, no-continue */

import logger from '../utils/logger.mjs';
import NodePath from './NodePath.mjs';
import Binding from './Binding.mjs';
import {
  ContractDefinitionIndicator,
  FunctionDefinitionIndicator,
  StateVariableIndicator,
} from './Indicator.mjs';
import { scopeCache } from './cache.mjs';
import backtrace from '../error/backtrace.mjs';

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
    if (cachedScope?.path) return cachedScope;

    this.scopeId = node.id;
    this.scopeName = node.name || ''; // whilst not all nodes have a 'name' property; all scopable nodes do. TODO: for loops, while loops, if statements, and other { braced scopes } won't have names.
    this.scopeType = node.nodeType;
    this.path = path;
    this.bindings = {}; // keys are AST node `id`s
    this.referencedBindings = {}; // keys are AST node `id`s
    this.modifiedBindings = {}; // keys are AST node `id`s
    this.nullifiedBindings = {};
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
        // @Indicator_ConDec new properties
        this.indicators = new ContractDefinitionIndicator();
        break;
      case 'FunctionDefinition':
        // @Indicator_FnDef new properties
        this.indicators = new FunctionDefinitionIndicator();
        break;
      default:
    }
  }

  /**
   * Updates the current scope (`this`) by adding details of a new NodePath (`path`) (newly discovered during AST traversal).
   *  - Creates a binding if this is a new declaration of a contract/function/variable.
   *  - Updates the indicators for `this` scope, based on the nature of the `path`.
   */
   // NOTE: suggestion for this function: only have properties of a @Scope be updated in the body of this function. @Node updates could (I suggest) be done before we reach this function. And @Binding / @Indicator updates (whilst they're triggered within here) should be done within the classes.
  update(path) {
    const { node, parent } = path;
    const { name, id, nodeType } = node;

    if (this.bindings[id])
      throw new Error(
        `Whilst updating scope for nodeType '${nodeType}', expected this.bindings[${id}] to be 'undefined', but found binding: '${this.bindings[id]}' for this scope: ${this}`,
      );

    const newBinding = Binding.create(path);
    if (newBinding) this.bindings[id] = newBinding;

    switch (nodeType) {
      case 'VariableDeclaration':
        if (this.scopeType === 'ContractDefinition')
          this.indicators.update(path);
        break;

      // An Identifier node is a special case, because it refers to an alread-defined variable whose bindings and indicators have already been initialised. So rather than initialise indicators/bindings, we must update them with the information of this new Identifier node.
      //
      case 'Identifier': {
        // 1) Update the binding this Identifier node is referencing:

        // ignore special Identifiers; there are no bindings/indicators for these.
        if (path.isMsg() || path.isRequireStatement() || path.isThis()) break;

        // `Identifier` nodes _refer_ to already-declared variables. We grab the binding for that referenced variable:
        const referencedBinding = this.getReferencedBinding(node);

        if (!referencedBinding && this.getReferencedExportedSymbolName(node))
          break; // the node is referring to some external contract name
        if (!referencedBinding)
          throw new Error(
            `Couldn't find a referencedDeclaration node for the current Identifier node.  I.e. couldn't find a node with id ${node.referencedDeclaration}`,
          );

        // if (
        //   referencedBinding.isSecret &&
        //   this.scopeType === 'FunctionDefinition'
        // ) {
        //   // @scope_FnDef new property
        //   this.interactsWithSecret = true; // NOTE: unused. TODO: more functionality around 'tainting' secrets with public stuff and vice versa.
        // }

        // Update the binding of the stateVariable being referenced by this Identifier node, to reflect the information contained in this Identifier node:
        // @Binding update properties
        referencedBinding.update(path);

        // Update @Scope
        const referencedId = referencedBinding.id;
        // update this scope, to say "the code in this scope 'refers to'/'modifies' a variable declared elsewhere"
        // @Scope new referencedBinding
        this.referencedBindings[referencedId] = referencedBinding;
        if (path.isModification()) {
          // @Scope new modifiedBinding
          this.modifiedBindings[referencedId] = referencedBinding;
        }

        // 2) Update the indicators of this scope:
        const referencedNode = referencedBinding.node;
        if (
          referencedNode.stateVariable &&
          this.isInScopeType('FunctionDefinition')
        ) {
          const functionDefScope = this.getAncestorOfScopeType(
            'FunctionDefinition',
          );
          const contractDefScope = this.getAncestorOfScopeType(
            'ContractDefinition',
          );

          functionDefScope.indicators[referencedId] =
            functionDefScope.indicators[referencedId] ??
            new StateVariableIndicator(path);

          const referencedIndicator = functionDefScope.indicators[referencedId];

          // Update the indicator of the stateVariable being referenced by this Identifier node, to reflect the information contained in this Identifier node:
          // @Indicator update properties
          referencedIndicator.update(path);

          if (path.isModification()) {
            // @Indicator update properties
            contractDefScope.indicators.nullifiersRequired = true; // FIXME: I thought we didn't know yet? (because a modification (incrementation) to a partitioned state doesn't need a nullifier)
          }

          // FIXME: move to some other place? Inside the Indicator class?
          if (referencedIndicator.isKnown && referencedIndicator.isUnknown) {
            throw new Error(
              `Secret state ${node.name} cannot be marked as both known and unknown in the same ${this.scopeType} scope`,
            );
          }
        }
        break;
      }
      case 'FunctionCall': {
        // here: we look for require statements and add any indicators
        if (!path.isRequireStatement()) {
          // TODO at the moment this prevents _any_ function call (internal or external). Update to only restrict external calls?
          // Disallow the passing of secret variables to an external function:
          node.arguments.forEach(arg => {
            if (
              arg.nodeType === 'Identifier' &&
              this.getReferencedBinding(arg)?.isSecret
            ) {
              throw new TypeError(
                `Passing secrets (${arg.name}) to external function calls is not yet supported, because the external contract being called might not be designed to hide anything. In fact, currently, this transpiler doesn't even support the passing of secrets to _any_ other function - we'll work on supporting internal function calls.`,
              );
            }
          });
        } else {
          // NOTE: all of this require statement stuff feels like it could be put in a separate function... possibly even called from somewhere else?
          // Require statement:
          const requirement = node.arguments[0]; // only the 0th arg of a `require` statement contains logic; the other arg is a message.
          if (
            requirement.nodeType === 'BinaryOperation' &&
            (path.isMsgSender(requirement.leftExpression) ||
              path.isMsgSender(requirement.rightExpression))
          ) {
            // Here: either the lhs or rhs of require statement is msg.sender
            // TODO  check if admin = state variable
            const functionDefScope = this.getAncestorOfScopeType(
              'FunctionDefinition',
            );
            const { operator } = requirement;

            const ownerNode = path.isMsgSender(requirement.leftExpression)
              ? requirement.rightExpression
              : requirement.leftExpression;
            const ownerBinding = this.getReferencedBinding(ownerNode);
            if (!ownerBinding)
              throw new Error(
                `require(msg.sender...) doesn't refer to a variable.`,
              );

            switch (operator) {
              // We consider 'require(msg.sender == ...)' and 'require(msg.sender != ...)'
              // (TODO: there could feasibly be a '>' or something, but we don't support that yet.)
              case '==':
                // if ==, we store the restriction node
                // We'll infer from `require(msg.sender == ownerNode)` that the caller of this function is restricted to one "owner".
                // @Scope new properties
                functionDefScope.callerRestriction = 'match';
                functionDefScope.callerRestrictionNode = ownerNode;

                // @Node new property
                node.requireStatementPrivate = !!ownerBinding?.isSecret;
                break;
              case '!=':
                // We'll infer from `require(msg.sender != blacklistedAddress)` that the caller of this function is not allowed to be a particular blacklisted "blacklistedAddress".
                // if != we store the 'blacklisted' address
                // QUESTION: we don't seem to be storing any blacklisted node?
                // @Scope new properties
                functionDefScope.callerRestriction = 'notMatch';

                // @Node new property
                node.requireStatementPrivate = !!ownerBinding?.isSecret;
                // functionDefScope.callerRestrictionNode = node.id;
                break;
              default:
                throw new Error(
                  `This kind of restriction on msg.sender isn't implemented yet!`,
                );
            }
            break;
            // otherwise, we have a require statement NOT on msg.sender
          } else {
            switch (requirement.nodeType) {
              // if we have a restriction on a secret state, we note that this require statement is private and should be copied over to the zok file
              case 'BinaryOperation':
                [
                  requirement.leftExpression,
                  requirement.rightExpression,
                ].forEach(exp => {
                  if (exp.nodeType === 'Identifier') {
                    // @Node new property
                    node.requireStatementPrivate = !!this.getReferencedBinding(
                      exp,
                    ).isSecret;
                  } else if (node.requireStatementPrivate !== true) {
                    // QUESTION: when would this be triggered? How would node.requireStatementPrivate have been set to true before this point?
                    node.requireStatementPrivate = false;
                  }
                });
                break;
              case 'IndexAccess':
                if (requirement.baseExpression.nodeType === 'Identifier') {
                  // @Node new property
                  node.requireStatementPrivate = !!this.getReferencedBinding(
                    requirement.baseExpression,
                  ).isSecret;
                }
                if (
                  requirement.indexExpression.nodeType === 'Identifier' &&
                  !node.requireStatementPrivate
                ) {
                  // @Node new property
                  node.requireStatementPrivate = !!this.getReferencedBinding(
                    requirement.indexExpression,
                  ).isSecret;
                }
                if (node.requireStatementPrivate !== true)
                  node.requireStatementPrivate = false; // @Node new property
                break;
              case 'Identifier':
                // @Node new property
                node.requireStatementPrivate = !!this.getReferencedBinding(
                  requirement,
                ).isSecret;
                break;
              case 'Literal':
                // here we probably have a bool, which can't be secret anyway QUESTION: why not? A bool can feasibly be secret.
                break;
              default:
                throw new Error(
                  `This kind of expression (${requirement.nodeType}) in a require statement isn't implemented yet!`,
                );
            }
          }
        }
        break;
      }
      case 'ContractDefinition':
      case 'FunctionDefinition':
      case 'ArrayTypeName':
      case 'Assignment':
      case 'Block':
      case 'BinaryOperation':
      case 'ElementaryTypeName':
      case 'ElementaryTypeNameExpression':
      case 'ExpressionStatement':
      case 'ImportDirective':
      case 'IndexAccess':
      case 'Literal':
      case 'Mapping':
      case 'MemberAccess':
      case 'ParameterList':
      case 'PragmaDirective':
      case 'Return':
      case 'TupleExpression':
      case 'UnaryOperation':
      case 'UserDefinedTypeName':
      case 'VariableDeclarationStatement':
        break;
      // And again, if we haven't recognized the nodeType then we'll throw an
      // error.
      default:
        logger.error(`Hitherto unknown nodeType ${node.nodeType}`);
        console.error(
          `Here's the path of this mysterious nodeType:`,
          path.node,
        );
        throw new TypeError(node.nodeType);
    }
  }

  /**
   * Starting at current `scope` and going up the nested scope object, return the first
   * `scope` that causes the provided `callback` to return a truthy value,
   * or `null` if the `callback` never returns a truthy value.
   * @returns {Scope || null}
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
      callback(scope) ||
      (scope.parentScope ? scope.parentScope.queryAncestors(callback) : null)
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
   * Get the first @return {Scope || null} matching the given scopeType, in which the input `scope` is contained (including the input scope itself in the search).
   */
  getAncestorOfScopeType(scopeType) {
    return this.findAncestor(scope => scope.scopeType === scopeType);
  }

  /**
   * @returns {Binding || null} - the binding of the VariableDeclaration being referred-to by the input referencingNode. The returned binding might be in a higher-level (ancestor) scope.
   */
  getReferencedBinding(referencingNode) {
    const node = referencingNode;
    const id = this.path.getReferencedDeclarationId(node);
    if (!id) return null; // if the node doesn't refer to another variable
    return this.queryAncestors(s => {
      return s.bindings[id];
    });
  }

  /**
   * @returns {String || null} the name of an exported symbol, if one exists for the given `id`
   */
  getReferencedExportedSymbolName(node) {
    const id = node.referencedDeclaration;
    if (!id) return null;
    const { path } = this;
    const exportedSymbols = path.getSourceUnit()?.node.exportedSymbols;
    if (!exportedSymbols) return null;
    for (const [name, ids] of Object.entries(exportedSymbols)) {
      if (ids.some(_id => _id === id)) return name;
    }
    return null;
  }

  /**
   * Get the Indicator object for the variable being referred-to by a referencingNode (i.e. a node which refers to another (often an 'Identifier' node)).
   * @param {Node} referencingNode - the node referring to a previously-declared variable.
   * @param {Boolean} mappingKeyIndicatorOnly - OPTIONAL - A mapping has two types of indicator associated with it, one nested within the other. The outer indicator gives general info about the mapping. There is a nested indicator object for each mappingKey name.
   *   true - only the inner mappingKey indicator will be returned.
   *   false - the entire (outer) mapping's indicator will be returned.
   * @returns {Indicator || null} - the indicator of the variable being referred-to by the input referencingNode.
   */
  getReferencedIndicator(referencingNode, mappingKeyIndicatorOnly = false) {
    const { path } = this;
    const indicator = this.getIndicatorById(
      path.getReferencedDeclarationId(referencingNode),
    );

    if (!path.isMapping(referencingNode)) return indicator;

    return mappingKeyIndicatorOnly
      ? indicator.mappingKeys[this.getMappingKeyName(referencingNode)]
      : indicator;
  }

  /**
   * @returns {Node || null} - the node (VariableDeclaration) being referred-to by the input referencingNode.
   */
  getReferencedNode(referencingNode) {
    const binding = this.getReferencedBinding(referencingNode);
    return binding?.node || null;
  }

  /**
   * @returns {Node || null} - the node (VariableDeclaration) being referred-to by the input referencingNode.
   */
  getReferencedPath(referencingNode) {
    const binding = this.getReferencedBinding(referencingNode);
    return binding?.path || null;
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
    if (!Array.isArray(booleanKeys))
      throw new Error('booleanKeys param must be an array.');
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
        throw new Error(
          `Invalid indicatorString ${str}. Must be one of ${validBooleanKeys}`,
        );
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
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.some prototype)
   * @returns {Boolean} - true if one of the values of the object is evaluated as 'true' by the callback
   */
  someBinding(callback) {
    const result = someObject(this.bindings, callback);
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
   * @param {Array<string>} booleanKeys - an array of strings of the boolean keys of a FunctionDefinition scope's indicator object.
   * @returns {Object} - a FunctionDefinition scope's indicators, filtered according to the booleanKeys
   */
  filterIndicatorsByBooleans(booleanKeys) {
    let result = {};
    if (!Array.isArray(booleanKeys))
      throw new Error('booleanKeys param must be an array.');
    let validBooleanKeys;
    switch (this.scopeType) {
      case 'FunctionDefinition':
        validBooleanKeys = [
          'isReferenced',
          'isModified',
          'oldCommitmentAccessRequired',
          'isNullified',
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
          'oldCommitmentAccessRequired',
          'nullifiersRequired',
          'newCommitmentsRequired',
        ];
        break;
      default:
        throw new Error(
          `filterIndicators is only supported for scopeTypes 'FunctionDefinition and ContractDefinition`,
        );
    }

    booleanKeys.forEach(str => {
      if (!validBooleanKeys.includes(str))
        throw new Error(
          `Invalid indicatorString ${str}. Must be one of ${validBooleanKeys}`,
        );
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
   * @returns {Object} - a FunctionDefinition scope's indicators, filtered according to the callback
   */
  filterIndicators(callback) {
    const result = filterObject(this.indicators, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes an indicator object as input and returns a boolean (same as the Array.some prototype)
   * @returns {Boolean} - true if one of the values of the object is evaluated as 'true' by the callback
   */
  someIndicator(callback) {
    const result = someObject(this.indicators, callback);
    return result;
  }

  /**
   * Gets a Function Definition scope's indicator object for a particular state variable's id.
   * @param {Number} id - an AST node's id.
   * @returns {Indicator Object || null}
   */
  getIndicatorById(id) {
    return this.indicators[id] || null;
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

  /**
   * A mapping's key will contain an Identifier node pointing to a previously-declared variable.
   * @param {Object} - the mapping's index access node.
   * @returns {Node} - an Identifier node
   */
  getMappingKeyIdentifier(indexAccessNode) {
    if (indexAccessNode.nodeType !== 'IndexAccess') return null;

    const { path } = this;
    const { indexExpression } = indexAccessNode;
    const keyNode = path.isMsgSender(indexExpression)
      ? indexExpression?.expression
      : indexExpression; // the former to pick up the 'msg' identifier of a 'msg.sender' ast representation
    return keyNode;
  }

  /**
   * Gets a mapping's indicator object for a particular key.
   * @param {Object} - the mapping's index access node.
   * @returns {String} - the name under which the mapping[key]'s indicator is stored
   */
  getMappingKeyName(indexAccessNode) {
    if (indexAccessNode.nodeType !== 'IndexAccess') return null;

    const keyIdentifierNode = this.getMappingKeyIdentifier(indexAccessNode);
    if (keyIdentifierNode === null)
      return (
        indexAccessNode.indexExpression.name ||
        indexAccessNode.indexExpression.value
      );
    const keyBinding = this.getReferencedBinding(keyIdentifierNode);
    let keyName = keyIdentifierNode.name;

    // If the value of the mapping key is edited between mapping accesses then the below copes with that.
    if (keyBinding?.isModified) {
      let i = 0;
      // TODO: please annotate or refactor to be easier to follow.
      // Consider each time the variable (which becomes the mapping's key) is edited throughout the scope:
      for (const modifyingPath of keyBinding.modifyingPaths) {
        // we have found the 'current' state (relative to the input node), so we don't need to move any further
        if (indexAccessNode.id < modifyingPath.node.id && i === 0) break;

        i++;
        if (
          modifyingPath.node.id < indexAccessNode.id && // a modification to the variable _before_ it was used as the mapping's key
          indexAccessNode.id < keyBinding.modifyingPaths[i]?.node.id
        )
          break;
      }
      if (i > 0) keyName = `${keyIdentifierNode.name}_${i}`;
    }
    return keyName;
  }

  /**
   * @returns {Boolean} - if some stateVariable is modified within the scope (of a FunctionDefinition scope).
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
   * @returns {Boolean} - if some stateVariable is nullified within the scope (of a FunctionDefinition scope).
   */
  nullifiesSecretState() {
    if (this.scopeType !== 'FunctionDefinition') return false;
    const { indicators } = this;
    for (const stateVarId of Object.keys(indicators)) {
      const indicator = indicators[stateVarId];
      if (indicator.isNullified && indicator.binding.isSecret) return true;
    }
    return false;
  }

  /**
   * Completes final checks on initial traversal:
   * - ensures all secret states are either whole or partitioned
   * - ensures no conflicting indicators
   * - looks for missing/bad syntax which couldn't be picked up before
   * @param {Indicator} secretVar - indicator object (fnDefScope) for secret state
   */
  // FIXME: the name suggests this function is checks only - but some data is also added to Indicators - suggest moving that functionality to a separate function.
  indicatorChecks(secretVar) {
    const contractDefScope = this.getAncestorOfScopeType('ContractDefinition');
    const topBinding = contractDefScope.bindings[secretVar.id];

    // warning: state is clearly whole, don't need known decorator
    if (secretVar.isKnown && secretVar.isWhole)
      logger.warn(
        `PEDANTIC: Unnecessary 'known' decorator. Secret state '${secretVar.name}' is trivially 'known' because it is 'whole', due to: ${secretVar.isWholeReason}`,
      );

    // error: conflicting unknown/whole state
    if ((secretVar.isUnknown || secretVar.binding.isUnknown) && secretVar.isWhole) {
      const wholeReason = [];
      secretVar.isWholeReason.forEach(reason => {
        backtrace.getSourceCode(reason.src);
        wholeReason.push(reason[0]);
      });

      throw new Error(
        `Can't mark a whole state as 'unknown'. The state '${secretVar.name}' is 'whole' due to: ${wholeReason}`,
      );
    }

    // mark a state as partitioned (isIncremented and isUnknown)
    if (
      (topBinding.isUnknown || secretVar.isUnknown) &&
      secretVar.isIncremented &&
      !secretVar.isWhole
    ) {
      secretVar.isWhole = false;
      secretVar.isPartitioned = true;
      secretVar.isPartitionedReason = [`Incremented and marked as unknown`];

      if (
        topBinding.isPartitionedReason &&
        !topBinding.isPartitionedReason.includes(
          secretVar.isPartitionedReason[0],
        )
      ) {
        // @Binding updated property
        topBinding.isPartitionedReason.push(secretVar.isPartitionedReason[0]);
      } else if (!topBinding.isPartitionedReason) {
        // @Binding new property
        topBinding.isPartitionedReason = secretVar.isPartitionedReason;
      }
    }

    if (
      secretVar.isIncremented &&
      secretVar.isWhole === undefined &&
      !secretVar.isDecremented
    ) {
      // state isIncremented, not isDecremented, and not yet marked as whole/partitioned
      if (!secretVar.isKnown && !secretVar.isUnknown) {
        // error: no known/unknown syntax at all
        throw new Error(
          `Secret value '${secretVar.name}' assigned to, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know.`,
        );
      }

      // error: this should have been picked up in previous block (isIncremented and isUnknown)
      if (secretVar.isUnknown)
        throw new Error(`This should be unreachable code!`);

      if (secretVar.isKnown) {
        // @Indicator new property
        // mark a known state as whole
        secretVar.isWhole = true;
        secretVar.isWholeReason = [`Marked as known`];
      } else if (!topBinding.isUnknown) {
        // warning: it's whole by default, may not be dev's intention
        logger.warn(
          `State '${secretVar.name}' will be treated as a whole state, because there are no 'unknown' decorators`,
        );
        // @Indicator new property
        secretVar.isWhole = true;
        secretVar.isWholeReason = [`No 'unknown' decorator or overwrites`];
      }
      // look for duplicates: PEDANTIC: Unnecessary duplicate 'unknown' decorator for secret state `a`.
    }

    if (secretVar.isWhole === false && secretVar.isDecremented) {
      // partitioned/decremented state needs nullifiers
      // @Indicator updated property
      secretVar.isNullified = true;
      secretVar.binding.isNullified = true;
      contractDefScope.indicators.nullifiersRequired = true;
      secretVar.oldCommitmentAccessRequired = true;
      contractDefScope.indicators.oldCommitmentAccessRequired = true;
    }

    if (
      secretVar.isWhole === false &&
      secretVar.isIncremented &&
      !secretVar.isDecremented
    ) {
      // partitioned/incremented state doesn't need nullifiers (in this function)
      secretVar.isNullified = false;
      secretVar.oldCommitmentAccessRequired = false;
    } else {
      // otherwise, we have a whole state which needs nullifiers at every edit
      // @Indicator updated property
      secretVar.isNullified = true;
      secretVar.binding.isNullified = true;
      contractDefScope.indicators.nullifiersRequired = true;
      secretVar.oldCommitmentAccessRequired = true;
      contractDefScope.indicators.oldCommitmentAccessRequired = true;
    }

    // here - mark the contract obj and check for conflicting indicators
    // errors: contract and function scopes conflict
    if (topBinding.isWhole && !secretVar.isWhole)
      throw new Error(
        `State ${secretVar.name} must be whole because: ${topBinding.isWholeReason}`,
      );

    if (topBinding.isPartitioned && secretVar.isWhole)
      throw new Error(
        `State ${secretVar.name} must be whole because: ${secretVar.isWholeReason}, but is partitioned: ${topBinding.isPartitionedReason}`,
      );

    // update contract scope with whole/partitioned reasons
    // @Binding new property
    topBinding.isWhole = secretVar.isWhole;
    // @Binding new property
    if (secretVar.isWhole !== undefined)
      secretVar.binding.isWhole = secretVar.isWhole;

    // @Binding new property
    if (secretVar.isPartitioned !== undefined)
      secretVar.binding.isPartitioned = secretVar.isPartitioned;

    if (topBinding.isWhole === false && !topBinding.isPartitionedReason) {
      // @Binding new property
      topBinding.isPartitioned = true;
      topBinding.isPartitionedReason = secretVar.isPartitionedReason;
    } else if (topBinding.isWhole === false && topBinding.isPartitionedReason) {
      if (!secretVar.isPartitionedReason) secretVar.isPartitionedReason = [];
      secretVar.isPartitionedReason.forEach(reason => {
        if (!topBinding.isPartitionedReason.includes(reason))
          // @Binding updated property
          topBinding.isPartitionedReason.push(reason);
      });
    } else if (!topBinding.isWholeReason) {
      // @Binding new property
      topBinding.isWholeReason = secretVar.isWholeReason;
    } else {
      if (!secretVar.isWholeReason) secretVar.isWholeReason = [];
      secretVar.isWholeReason.forEach(reason => {
        if (!topBinding.isWholeReason.includes(reason))
          // @Binding new property
          topBinding.isWholeReason.push(reason);
      });
    }
    // logging
    logger.debug(`Indicator: (at ${secretVar.name})`);
    logger.debug('----------');
    if (logger.level === 'debug') console.dir(this, { depth: 0 });
    logger.debug('----------');
    if (logger.level === 'debug') console.dir(this.indicators);
    logger.debug('----------');
    if (this.indicators[secretVar.id].mappingKeys) {
      logger.debug(`Indicator.mappingKeys[${secretVar.name}]`);
      if (logger.level === 'debug') console.dir(secretVar, { depth: 1 });
      logger.debug('----------');
    }
    logger.debug(
      `NB: Nullification traversals haven't been completed - so isNullified and nullifyingPaths will not be correct yet.`,
    );
    // logger.debug(`Contract level binding for state:`);
    // if (logger.level === 'debug') console.dir(topScope, { depth: 0 });
    // if (topScope.isWholeReason) {
    //   logger.debug(topScope.isWholeReason);
    // } else {
    //   logger.debug(topScope.isPartitionedReason);
    // }
  }

  /**
   * Adds nullifyingPaths to the scope's nullifiedBindings (a subset of modifiedBindings)
   * @param {Object} - the NodePath of the left hand side identifier node
   */
  addNullifyingPath(identifierPath) {
    const { node, parent } = identifierPath;
    const isMapping = node.typeDescriptions.typeString.includes('mapping');
    let referencedBinding = this.getReferencedBinding(node);

    if (isMapping) {
      // we instead use the mapping[key] binding for most cases
      const keyName = this.getMappingKeyName(parent);
      referencedBinding = referencedBinding.mappingKeys[keyName];
    }

    if (
      !referencedBinding.nullifyingPaths.some(
        p => p.node.id === identifierPath.node.id,
      )
    ) {
      // if the path hasn't been added - possibly not needed
      // @Binding new property
      referencedBinding.isNullified = true;
      referencedBinding.nullifyingPaths.push(identifierPath);
    }

    if (isMapping) {
      // @Binding new property
      this.getReferencedBinding(node).isNullified = true; // mark the parent mapping
    }

    // update this scope, to say "the code in this scope 'nullifies' a variable declared elsewhere"
    // @Scope @Binding updated property
    this.nullifiedBindings[
      identifierPath.node.referencedDeclaration
    ] = this.getReferencedBinding(identifierPath.node);
  }

  /**
   * Decides whether each state in this scope is nullifiable
   * This function exists solely to catch errors.
   * If no errors are found, the calling code will simply carry on.
   */
  isNullifiable() {
    // for each state variable in the function def scope
    for (const stateVarId of Object.keys(this.bindings)) {
      // only modified states live in the indicators object, so we don't have to worry about filtering out secret params here (they're allowed to be non-nullified)
      const stateVar = this.bindings[stateVarId];
      if (!stateVar.isSecret) continue;
      if (!stateVar.isWhole) continue;
      if (stateVar.node.isConstant || stateVar.node.constant) continue;
      // go through each mapping key, if mapping
      if (stateVar.mappingKeys) {
        for (const key of Object.keys(stateVar.mappingKeys)) {
          // if the key is a parameter, then it can be any (user defined) key, so as long as isNullified = true, any key can be nullified
          if (
            stateVar.mappingKeys[key].isNullified === true &&
            (stateVar.mappingKeys[key].referencedKeyIsParam ||
              stateVar.mappingKeys[key].isMsgSender)
          )
            break; // this means any mapping[key] is nullifiable - good!
          if (
            stateVar.mappingKeys[key].isNullified !== true &&
            !stateVar.mappingKeys[key].referencedKeyIsParam &&
            !stateVar.mappingKeys[key].isMsgSender
          )
            throw new Error(
              `All whole states must be nullifiable, otherwise they are useless after initialisation! Consider making ${stateVar.name}[${key}] editable or constant.`,
            );
        }
      } else if (stateVar.isNullified !== true) {
        throw new Error(
          `All whole states must be nullifiable, otherwise they are useless after initialisation! Consider making ${stateVar.name} editable or constant.`,
        );
      }
    }
  }
}

export default Scope;
