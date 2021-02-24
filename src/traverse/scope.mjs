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
    this.scopeName = node.name || ''; // whilst not all nodes have a 'name' property; all scopable nodes do.
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
        this.indicators = {
          zkSnarkVerificationRequired: false,
          oldCommitmentAccessRequired: false,
          nullifiersRequired: false,
          newCommitmentsRequired: false,
        };
        break;
      case 'FunctionDefinition':
        this.indicators = {
          // BIG COMMENT FOR INFO ONLY
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
          //   nullifyingPaths: [
          //     path_of_identifier,
          //     path_of_identifier,
          //     ...
          //   ], // a subset of modifyingPaths. // we use an array to preserve the order of references
          //   oldCommitmentAccessRequired: true,
          //   isNullified: true,
          //   initialisationRequired: true,
          //   newCommitmentRequired: true,
          // }
        };
        break;
      default:
    }
  }

  /**
   * Updates the current scope (`this`) by adding details of a new NodePath (`path`) (newly discovered during AST traversal).
   *  - Creates a binding if this is a new declaration of a contract/function/variable.
   *  - Updates the indicators for `this` scope, based on the nature of the `path`.
   */
  update(path) {
    const { node, parent } = path;
    const { name, id, nodeType } = node;

    if (this.bindings[id])
      throw new Error(
        `Whilst updating scope for nodeType '${nodeType}', expected this.bindings[${id}] to be 'undefined', but found binding: '${this.bindings[id]}' for this scope: ${this}`,
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
          isSecret: node.isSecret || false,
          isReferenced: false,
          referenceCount: 0,
          referencingPaths: [], // paths of `Identifier` nodes which reference this variable
          isModified: false,
          modificationCount: 0,
          modifyingPaths: [], // paths of `Identifier` nodes which modify this variable
          // Note: modification _is_ nullification, unless it's a partitioned state being incremented (in which case there's no nullifier).
          // So nullifyingPaths is a subset of modifyingPaths.
          // TODO: MIKE: suggestion only. populate these nullifier fields later in this function:
          isNullified: false,
          nullificationCount: 0,
          nullifyingPaths: [], // paths of `Identifier` nodes which nullify this binding
          increments: [],
          decrements: [],
          isMapping: false,
          mappingKey: null,
          isKnown: false,
          isWhole: false,
          isPartitioned: false,
          isOwned: false,
          owner: null,
        };

        if (this.scopeType === 'ContractDefinition' && node.isSecret) {
          // indicators used to construct import statements for the shield contract AST:
          this.indicators.newCommitmentsRequired = true;
          this.indicators.zkSnarkVerificationRequired = true;
        }

        if (node.typeDescriptions.typeString.includes('mapping')) {
          this.bindings[id].isMapping = true;
          this.bindings[id].mappingKey = {};
        }
        break;

      case 'Identifier': {
        // 1) Update the binding this Identifier node is referencing:
        // TODO: consider just how 'negative' these values can be. `> 2^32 / 2`, perhaps?
        if (node.referencedDeclaration > 4294967200) break;
        // TODO: understand the significance of -15, and whether other values are possible for a msg.sender referencedDeclaration id.
        // TODO: OR... replace with node.typeDescriptions.typeString == 'msg', because that's a more 'sturdy' thing.
        // node.referencedDeclaration is the `id` of the AST node which this `Identifier` `node` refers to. `-15` is a special id meaning "msg.sender" (we think).
        // So we have a mapping with key msg.sender
        // ... we stop, because this identifier just represents the key, we account for this.
        // TODO: also, `this` (the solidity keyword) also has a referencedDeclaration which is a negative number (or big number).

        // `Identifier` nodes _refer_ to already-declared variables. We grab the binding for that referenced variable:
        let referencedBinding = this.getReferencedBinding(node);

        if (!referencedBinding && this.getReferencedExportedSymbolName(node)) break; // the node is referring to some external contract name
        if (!referencedBinding)
          throw new Error(
            `Couldn't find a referencedDeclaration. I.e. couldn't find a node with id ${node.referencedDeclaration}`,
          );

        const referencedNode = referencedBinding.node;
        const referencedId = referencedBinding.id;
        const referencedName = referencedBinding.name;
        const parentBinding = referencedBinding;

        // Is this node an Identifier for a mapping?
        const isMapping = node.typeDescriptions.typeString.includes('mapping');

        if (isMapping) {
          // here - initialise binding for mapping[key]
          const keyNode = parent.indexExpression.expression || parent.indexExpression;
          // TODO: key might be a literal node (not an identifier node), in which case it won't be referring to a binding. We'll need to edit this code when we come to that. For now, here's an error to remind ourselves:
          if (keyNode.nodeType !== 'Identifier') {
            throw new Error(
              `A mapping key of nodeType '${keyNode.nodeType}' isn't supported yet. We've only written the code for keys of nodeType Identifier'`,
            );
          }
          let keyName = keyNode.name;
          const keyBinding = this.getReferencedBinding(keyNode);
          if (keyBinding && keyBinding.isModified)
            keyName = `${keyName}_${keyBinding.modificationCount}`;
          const bindingExists = !!referencedBinding.mappingKey[keyName];
          const isParam = this.getReferencedBinding(keyNode)
            ? !!this.getReferencedBinding(keyNode).path.getAncestorOfType('ParameterList')
            : false;
          const isMsg = keyNode.referencedDeclaration > 4294967200;
          if (!bindingExists)
            referencedBinding.mappingKey[keyName] = {
              referencedKey: keyNode.referenceDeclaration || keyNode.id,
              referencedKeyNodeType: isMsg
                ? keyNode.typeDescriptions.typeIdentifier
                : this.getReferencedNode(keyNode).nodeType || keyNode.nodeType,
              referencedKeyisParam: isParam, // is a function parameter - used for finding owner
              referencedKeyisMsg: isMsg, // is msg.sender - used for finding owner
              isSecret: referencedBinding.isSecret,
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

        // Currently, the only state variable 'modifications' we're aware of are:
        //   - when a state variable is referenced on the LHS of an assignment;
        //   - a unary operator
        if (
          // prettier-ignore
          (
            path.containerName !== 'indexExpression' &&
            path.getAncestorContainedWithin('leftHandSide') &&
            path.getAncestorOfType('Assignment')
          ) ||
          (
            path.getAncestorOfType('UnaryOperation') &&
            path.containerName !== 'indexExpression'
          )
        ) {
          // Update the referenced variable's binding, to say "this variable has been referred-to by this node (`path`)"
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
              isMapping,
              referencingPaths: [],
              referenceCount: 0,
              modifyingPaths: [],
              modificationCount: 0,
            };

          const parentIndicator = referencedIndicator;
          if (isMapping) {
            // here: initialise indicator for mapping[key]
            const keyNode = parent.indexExpression.expression || parent.indexExpression;
            if (!referencedIndicator.mappingKey) {
              referencedIndicator.mappingKey = {};
            }
            let keyName = keyNode.name;

            if (this.getReferencedBinding(keyNode) && this.getReferencedBinding(keyNode).isModified)
              keyName = `${keyName}_${this.getReferencedBinding(keyNode).modificationCount}`;
            const isParam = this.getReferencedBinding(keyNode)
              ? !!this.getReferencedBinding(keyNode).path.getAncestorOfType('ParameterList')
              : false;
            const isMsg = keyNode.referencedDeclaration > 4294967200;
            if (!referencedIndicator.mappingKey[keyName]) {
              referencedIndicator.mappingKey[keyName] = {
                referencedKey: keyNode.referenceDeclaration || keyNode.id,
                referencedKeyNodeType: isMsg
                  ? keyNode.typeDescriptions.typeIdentifier
                  : this.getReferencedNode(keyNode).nodeType || keyNode.nodeType,
                referencedKeyisParam: isParam, // key is a function parameter - used for finding owner
                referencedKeyisMsg: isMsg, // key is msg.sender - used for finding owner
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
            referencedIndicator.oldCommitmentAccessRequired = true;
          }
          contractDefScope.indicators.oldCommitmentAccessRequired = true;

          // Currently, the only state variable 'modification' we're aware of is when a state variable is referenced on the LHS of an assignment:
          if (
            // prettier-ignore
            (
              path.containerName !== 'indexExpression' &&
              path.getAncestorContainedWithin('leftHandSide') &&
              path.getAncestorOfType('Assignment')
            ) ||
            (
              path.getAncestorOfType('UnaryOperation') &&
              path.containerName !== 'indexExpression'
            )
          ) {
            if (!referencedIndicator.modifyingPaths.some(p => p.node.id === path.node.id)) {
              referencedIndicator.isModified = true;
              if (isMapping) parentIndicator.isModified = true;
              ++referencedIndicator.modificationCount;
              referencedIndicator.modifyingPaths.push(path);
            }
            referencedIndicator.newCommitmentRequired = true;
            referencedIndicator.isNullified = null; // we don't know yet
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

          // logger.debug(this.getReferencedBinding(node));
          // logger.debug(functionDefScope.indicators);
          // logger.debug('---------');
          // logger.debug(functionDefScope.indicators[5].mappingKey);
        }
        break;
      }
      case 'FunctionCall':
        // here: we look for require statements and add any indicators
        if (node.expression.name !== 'require') {
          // TODO add external function calls which use non-secret vars
          node.arguments.forEach(arg => {
            if (arg.nodeType === 'Identifier' && this.getReferencedBinding(arg)?.isSecret) {
              throw new TypeError(
                `External function calls not yet supported. You can't hide function calls without using recursive proofs.`,
              );
            }
          });
        } else if (
          node.arguments[0].nodeType === 'BinaryOperation' &&
          (path.isMsgSender(node.arguments[0].leftExpression) ||
            path.isMsgSender(node.arguments[0].rightExpression))
        ) {
          // here: either lhs or rhs of require statement includes msg.sender
          // TODO  check if admin = state variable
          const functionDefScope = this.getAncestorOfScopeType('FunctionDefinition');
          const { operator } = node.arguments[0];
          const ownerNode =
            node.arguments[0].leftExpression.expression.typeDescriptions.typeIdentifier ===
            't_magic_message'
              ? node.arguments[0].rightExpression
              : node.arguments[0].leftExpression;

          switch (operator) {
            // either have a 'msg.sender ==' or '!='
            case '==':
              // if ==, we store the restriction node
              functionDefScope.callerRestriction = 'match';
              functionDefScope.callerRestrictionNode = ownerNode;
              if (!this.getReferencedBinding(ownerNode)?.stateVariable)
                throw new Error(`Cannot require msg.sender to be an input param!`);
              node.requireStatementPrivate = !!this.getReferencedBinding(ownerNode)?.isSecret;
              break;
            case '!=':
              // if != we store the 'blacklistedNode'
              functionDefScope.callerRestriction = 'notMatch';
              node.requireStatementPrivate = !!this.getReferencedBinding(ownerNode)?.isSecret;
              // functionDefScope.callerRestrictionNode = node.id;
              break;
            default:
              throw new Error(`This kind of restriction on msg.sender isn't implemented yet!`);
          }
          break;
          // otherwise, we have a require statement NOT on msg.sender
        } else {
          for (const arg of node.arguments) {
            switch (arg.nodeType) {
              // if we have a restriction on a secret state, we note that this require statement is private and should be copied over to the zok file
              case 'BinaryOperation':
                [arg.leftExpression, arg.rightExpression].forEach(exp => {
                  if (exp.nodeType === 'Identifier') {
                    node.requireStatementPrivate = !!this.getReferencedBinding(exp).isSecret;
                  } else if (node.requireStatementPrivate !== true) {
                    node.requireStatementPrivate = false;
                  }
                });
                break;
              case 'Identifier':
              case 'Literal':
                // here we probably have a bool, which can't be secret anyway
                break;
              default:
                throw new Error(
                  `This kind of expression (${arg.nodeType}) in a require statement isn't implemented yet!`,
                );
            }
          }
        }
        break;
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
        console.error(`Here's the path of this mysterious nodeType:`, path.node);
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
   * Get the first @return {Scope || null} matching the given scopeType, in which the input `scope` is contained (including the input scope itself in the search).
   */
  getAncestorOfScopeType(scopeType) {
    return this.findAncestor(scope => scope.scopeType === scopeType);
  }

  /**
   * @returns {Binding || null} - the binding of the VariableDeclaration being referred-to by the input referencingNode.
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
    const indicator = this.getIndicatorById(path.getReferencedDeclarationId(referencingNode));

    if (!path.isMapping(referencingNode)) return indicator;

    return mappingKeyIndicatorOnly
      ? indicator.mappingKey[this.getMappingKeyName(referencingNode)]
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
    if (!Array.isArray(booleanKeys)) throw new Error('booleanKeys param must be an array.');
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
    const keyBinding = this.getReferencedBinding(keyIdentifierNode);
    let keyName = keyIdentifierNode.name;

    // TODO does the below work when we are traversing again and already have modified paths?
    // If the value of the mapping key is edited between mapping accesses then the below copes with that.
    if (keyBinding?.isModified) {
      let i = 0;
      // TODO: please annotate or refactor to be easier to follow.
      // Consider each time the variable (which becomes the mapping's key) is edited throughout the scope:
      for (const modifyingPath of keyBinding.modifyingPaths) {
        // Ignore all modifications to the variable which happened _after_ it was used as the mapping's key, unless i > 0 ???????
        if (indexAccessNode.id < modifyingPath.node.id && i === 0) break;

        i++;
        if (
          modifyingPath.node.id < indexAccessNode.id && // a modification to the variable _before_ it was used as the mapping's key
          indexAccessNode.id < keyBinding.modifyingPaths?.[i].node.id
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
   * Decides whether a statement is an incrementation.
   * @param {Object} expressionNode - the line's expression node, usually an Assignment.
   * @param {Object} lhsNode - the left hand side node, usually an Identifier.
   * @returns {Object {bool, bool}} - isIncremented and isDecremented
   */
  isIncremented(expressionNode, lhsNode) {
    let isIncrementedBool = false;
    let isDecrementedBool = false;

    // first, check if the LHS node is secret
    const increments = [];
    const decrements = [];

    const lhsbinding = this.getReferencedBinding(lhsNode);
    const lhsSecret = !!lhsbinding.isSecret;

    // look at the assignment
    switch (expressionNode.nodeType) {
      case 'Assignment': {
        // ARITHMETIC ASSIGNMENT OPERATORS:
        const { operator, leftHandSide, rightHandSide } = expressionNode;

        // a += something, -= something
        if (lhsSecret && operator === '+=') {
          isIncrementedBool = true;
          isDecrementedBool = false;
          increments.push(rightHandSide);
          break;
        }

        if (lhsSecret && operator === '-=') {
          isIncrementedBool = true;
          isDecrementedBool = true;
          decrements.push(rightHandSide);
          break;
        }

        // a *= something, a /= something
        if (
          operator === '%=' ||
          operator === '/=' ||
          operator === '*=' // TODO other operators like |= etc?
        ) {
          isIncrementedBool = false;
          break;
        }

        if (operator !== '=')
          throw new Error(`Operator '${operator}' not yet supported. Please open an issue.`);

        // SIMPLE ASSIGNMENT `=`:
        // `a = something`
        switch (rightHandSide.nodeType) {
          case 'BinaryOperation': {
            const binOpNode = rightHandSide;
            const operands = [binOpNode.leftExpression, binOpNode.rightExpression];
            const { operator } = rightHandSide;

            // TODO deal with binOps like a + b - c, c < a + b
            // if we dont have any + or -, it can't be an incrementation
            if (!operator.includes('+') && !operator.includes('-')) {
              isIncrementedBool = false;
              isDecrementedBool = false;
              break;
            }

            // FIXME: this isn't recursion.
            // recursively checks for binop + binop
            // fills an array of params
            for (const [index, operand] of operands.entries()) {
              if (operand.nodeType === 'BinaryOperation') {
                if (!operand.operator.includes('+')) {
                  isIncrementedBool = false;
                  break;
                }
                operands[index] = operand.leftExpression;
                operands.push(operand.rightExpression);
              }
            }

            // Goes through each operand and checks whether it's the lhsNode and whether it's +/- anything
            for (const operand of operands) {
              if (operand.referencedDeclaration || operand.baseExpression) {
                const { isSecret } = this.getReferencedBinding(operand);

                // a = a + b
                if (isSecret && operand.name === lhsNode.name && operator.includes('+')) {
                  isIncrementedBool = true;
                  isDecrementedBool = false;
                  break;
                }

                // a = a + b (mapping)
                if (
                  isSecret &&
                  operand.nodeType === 'IndexAccess' &&
                  operand.baseExpression.name === lhsNode.baseExpression.name &&
                  operand.indexExpression.name === lhsNode.indexExpression.name &&
                  operator.includes('+')
                ) {
                  isIncrementedBool = true;
                  isDecrementedBool = false;
                  break;
                }

                // TODO: what was this for? I wouldn't classify `b = a + somthing` as an "incrementation", because there's no `b` on the rhs. Commenting out for now.
                // // b = a + something
                // if (!lhsSecret && isSecret && operator.includes('+')) {
                //   isIncrementedBool = true;
                //   isDecrementedBool = false;
                //   break;
                // }

                // a = a - something
                if (
                  isSecret &&
                  operand.name === lhsNode.name &&
                  operator.includes('-') &&
                  operand === binOpNode.leftExpression
                ) {
                  isIncrementedBool = true;
                  isDecrementedBool = true;
                  break;
                }
                // if none, go to the next param
              }
            }
            if (isIncrementedBool && !isDecrementedBool) {
              increments.push(binOpNode);
            } else if (isDecrementedBool) {
              decrements.push(binOpNode);
            }
            break;
          }

          case 'Identifier': {
            // c = a + b, a = c
            // TODO consider cases where c has lots of modifiers, which might cancel out the incrementation of a
            // TODO consider doing this at the level of c, not a, maybe that works out better
            const rhsbinding = this.getReferencedBinding(rightHandSide);
            const isSecret = rhsbinding.secretVariable;
            // looking at modifiers of c...
            if (rhsbinding && rhsbinding.isModified) {
              // for each modifier, replace a with c and see if there are incrementations..
              for (const p of rhsbinding.modifyingPaths) {
                const modifyingNode = p.node;
                // ... and if a xor c are secret, then true
                if (this.isIncremented(modifyingNode, lhsNode) && (lhsSecret || isSecret)) {
                  isIncrementedBool = true;
                  break;
                }
              }
            }
            break;
          }

          case 'FunctionCall': {
            isIncrementedBool = false;
            isDecrementedBool = false;
            break;
          }

          default:
            console.log(
              `Assignment.rightHandSide is of nodeType ${rightHandSide.nodeType} which is not being properly handled by the 'isIncremented()' function`,
            );
          // throw new Error(
          //   `Assignment.rightHandSide is of nodeType ${expressionNode.rightHandSide.nodeType} which is not yet supported. Please open an issue.`,
          // );
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

    logger.debug(`statement is incremented? ${isIncrementedBool}`);
    logger.debug(`statement is decremented? ${isDecrementedBool}`);
    expressionNode.isIncremented = isIncrementedBool;
    expressionNode.isDecremented = isDecrementedBool;

    const referencedIndicator = this.getReferencedIndicator(lhsNode, true);
    referencedIndicator.increments = referencedIndicator.increments || [];
    referencedIndicator.decrements = referencedIndicator.decrements || [];

    increments.forEach(inc => {
      referencedIndicator.increments.push(inc);
      if (lhsNode.baseExpression) {
        const keyBinding = lhsbinding.mappingKey[this.getMappingKeyName(lhsNode)];
        keyBinding.increments = keyBinding.increments || [];
        keyBinding.increments.push(inc);
      }
      lhsbinding.increments.push(inc);
    });

    decrements.forEach(dec => {
      referencedIndicator.decrements.push(dec);
      if (lhsNode.baseExpression) {
        const keyBinding = lhsbinding.mappingKey[this.getMappingKeyName(lhsNode)];
        keyBinding.decrements = keyBinding.decrements || [];
        keyBinding.decrements.push(dec);
      }
      lhsbinding.decrements.push(dec);
    });

    return { isIncrementedBool, isDecrementedBool };
  }

  /**
   * Completes final checks on initial traversal:
   * - ensures all secret states are either whole or partitioned
   * - ensures no conflicting indicators
   * - looks for missing/bad syntax which couldn't be picked up before
   * @param {Indicator} secretVar - indicator object (fnDefScope) for secret state
   */
  indicatorChecks(secretVar) {
    const contractDefScope = this.getAncestorOfScopeType('ContractDefinition');
    const topBinding = contractDefScope.bindings[secretVar.id];

    // warning: state is clearly whole, don't need known decorator
    if (secretVar.isKnown && secretVar.isWhole)
      logger.warn(
        `PEDANTIC: Unnecessary 'known' decorator. Secret state '${secretVar.name}' is trivially 'known' because it is 'whole', due to: ${secretVar.isWholeReason}`,
      );

    // error: conflicting unknown/whole state
    if ((secretVar.isUnknown || secretVar.binding.isUnknown) && secretVar.isWhole)
      throw new Error(
        `Can't mark a whole state as 'unknown'. The state '${secretVar.name}' is 'whole' due to: ${secretVar.isWholeReason}`,
      );

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
        !topBinding.isPartitionedReason.includes(secretVar.isPartitionedReason[0])
      ) {
        topBinding.isPartitionedReason.push(secretVar.isPartitionedReason[0]);
      } else if (!topBinding.isPartitionedReason) {
        topBinding.isPartitionedReason = secretVar.isPartitionedReason;
      }
    }

    if (secretVar.isIncremented && secretVar.isWhole === undefined && !secretVar.isDecremented) {
      // state isIncremented, not isDecremented, and not yet marked as whole/partitioned
      if (!secretVar.isKnown && !secretVar.isUnknown) {
        // error: no known/unknown syntax at all
        throw new Error(
          `Secret value '${secretVar.name}' assigned to, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know.`,
        );
      }

      // error: this should have been picked up in previous block (isIncremented and isUnknown)
      if (secretVar.isUnknown) throw new Error(`This should be unreachable code!`);

      if (secretVar.isKnown) {
        // mark a known state as whole
        secretVar.isWhole = true;
        secretVar.isWholeReason = [`Marked as known`];
      } else if (!topBinding.isUnknown) {
        // warning: it's whole by default, may not be dev's intention
        logger.warn(
          `State '${secretVar.name}' will be treated as a whole state, because there are no 'unknown' decorators`,
        );
        secretVar.isWhole = true;
        secretVar.isWholeReason = [`No 'unknown' decorator or overwrites`];
      }
      // look for duplicates: PEDANTIC: Unnecessary duplicate 'unknown' decorator for secret state `a`.
    }

    if (secretVar.isWhole === false && secretVar.isDecremented) {
      // partitioned/decremented state needs nullifiers
      secretVar.isNullified = true;
      secretVar.binding.isNullified = true;
      contractDefScope.indicators.nullifiersRequired = true;
    }

    if (secretVar.isWhole === false && secretVar.isIncremented) {
      // partitioned/incremented state doesn't need nullifiers (in this function)
      secretVar.isNullified = false;
    } else {
      // otherwise, we have a whole state which needs nullifiers at every edit
      secretVar.isNullified = true;
      secretVar.binding.isNullified = true;
      contractDefScope.indicators.nullifiersRequired = true;
    }

    // here - mark the contract obj and check for conflicting indicators
    // errors: contract and function scopes conflict
    if (topBinding.isWhole && !secretVar.isWhole)
      throw new Error(`State ${secretVar.name} must be whole because: ${topBinding.isWholeReason}`);

    if (topBinding.isPartitioned && secretVar.isWhole)
      throw new Error(
        `State ${secretVar.name} must be whole because: ${secretVar.isWholeReason}, but is partitioned: ${topBinding.isPartitionedReason}`,
      );

    // update contract scope with whole/partitioned reasons
    topBinding.isWhole = secretVar.isWhole;
    if (secretVar.isWhole !== undefined) secretVar.binding.isWhole = secretVar.isWhole;

    if (secretVar.isPartitioned !== undefined)
      secretVar.binding.isPartitioned = secretVar.isPartitioned;

    if (topBinding.isWhole === false && !topBinding.isPartitionedReason) {
      topBinding.isPartitioned = true;
      topBinding.isPartitionedReason = secretVar.isPartitionedReason;
    } else if (topBinding.isWhole === false && topBinding.isPartitionedReason) {
      if (!secretVar.isPartitionedReason) secretVar.isPartitionedReason = [];
      secretVar.isPartitionedReason.forEach(reason => {
        if (!topBinding.isPartitionedReason.includes(reason))
          topBinding.isPartitionedReason.push(reason);
      });
    } else if (!topBinding.isWholeReason) {
      topBinding.isWholeReason = secretVar.isWholeReason;
    } else {
      if (!secretVar.isWholeReason) secretVar.isWholeReason = [];
      secretVar.isWholeReason.forEach(reason => {
        if (!topBinding.isWholeReason.includes(reason)) topBinding.isWholeReason.push(reason);
      });
    }

    // logging
    logger.debug(`Indicator: (at ${secretVar.name})`);
    logger.debug('----------');
    if (logger.level === 'debug') console.dir(this, { depth: 0 });
    logger.debug('----------');
    if (logger.level === 'debug') console.dir(this.indicators);
    logger.debug('----------');
    if (this.indicators[secretVar.id].mappingKey) {
      logger.debug(`Indicator.mappingKey[${secretVar.name}]`);
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
      referencedBinding = referencedBinding.mappingKey[keyName];
    }

    if (!referencedBinding.nullifyingPaths.some(p => p.node.id === identifierPath.node.id)) {
      // if the path hasn't been added - possibly not needed
      referencedBinding.isNullified = true;
      referencedBinding.nullifyingPaths.push(identifierPath);
    }

    if (isMapping) {
      this.getReferencedBinding(node).isNullified = true; // mark the parent mapping
    }

    // update this scope, to say "the code in this scope 'nullifies' a variable declared elsewhere"
    this.nullifiedBindings[identifierPath.node.referencedDeclaration] = this.getReferencedBinding(
      identifierPath.node,
    );
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
      if (stateVar.mappingKey) {
        for (const key of Object.keys(stateVar.mappingKey)) {
          // if the key is a parameter, then it can be any (user defined) key, so as long as isNullified = true, any key can be nullified
          if (
            stateVar.mappingKey[key].isNullified === true &&
            (stateVar.mappingKey[key].referencedKeyisParam ||
              stateVar.mappingKey[key].referencedKeyisMsg)
          )
            break; // this means any mapping[key] is nullifiable - good!
          if (
            stateVar.mappingKey[key].isNullified !== true &&
            !stateVar.mappingKey[key].referencedKeyisParam &&
            !stateVar.mappingKey[key].referencedKeyisMsg
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
