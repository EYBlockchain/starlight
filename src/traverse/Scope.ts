/* eslint-disable no-shadow, no-param-reassign, no-use-before-define, no-continue */

/**
This file contains portions of code from Babel (https://github.com/babel/babel). All such code has been modified for use in this repository. See below for Babel's MIT license and copyright notice:

MIT License

Copyright (c) 2014-present Sebastian McKenzie and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import logger from '../utils/logger.js';
import NodePath from './NodePath.js';
import MappingKey from './MappingKey.js';
import { Binding, VariableBinding } from './Binding.js';
import {
  ContractDefinitionIndicator,
  FunctionDefinitionIndicator,
  StateVariableIndicator,
  LocalVariableIndicator
} from './Indicator.js';
import { scopeCache } from './cache.js';
import { TODOError } from '../error/errors.js';

/**
 * Analogue of Array.filter, but for objects.
 * The callback will take as input each 'value' of the input obj.
 */
const filterObject = (obj: any, callback: CallableFunction) => {
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
const someObject = (obj: any, callback: CallableFunction) => {
  for (const value of Object.values(obj)) {
    if (callback(value)) return true;
  }
  return false;
};

// /**
//  * Analogue of Array.every, but for objects.
//  * The callback will take as input each 'value' of the input obj.
//  */
// const everyObject = (obj: any, callback: CallableFunction) => {
//   let result = true;
//   for (const value of Object.values(obj)) {
//     result = !!callback(value);
//     if (result === false) return result;
//   }
//   return result;
// };
//
// /**
//  * Analogue of Array.includes, but for objects.
//  * The callback will take as input each 'value' of the input obj.
//  */
// const includesObject = (obj: any, valueToFind: any) => {
//   for (const value of Object.values(obj)) {
//     if (value === valueToFind) return true;
//   }
//   return false;
// };

export class Scope {

  scopeId: number;
  scopeName: string;
  scopeType: string;
  path: NodePath;
  bindings: {[key: string]: Binding};
  referencedBindings: any; // keys are AST node `id`s
  modifiedBindings: any; // keys are AST node `id`s
  nullifiedBindings: any;
  indicators: any; // keys are stateVariable names
  containsSecret?: boolean;
  containsPublic?: boolean;

  callerRestriction?: string;
  callerRestrictionNode?: any;
  /**
   * @param {NodePath} path - the nodePath of the node around which we're
   * getting / creating 'scope'
   */
  constructor(path: NodePath) {
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
    const parentPath = this.path.findAncestorFromParent((p: NodePath) => p.isScopable());
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
        this.indicators = new FunctionDefinitionIndicator(this);
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
  update(path: NodePath) {
    const { node } = path;
    const { id, nodeType } = node;

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
        if (this.scopeType === 'FunctionDefinition')
          this.indicators[id] =
            this.indicators[id] ?? new LocalVariableIndicator(path);
        break;

      // An Identifier node is a special case, because it refers to an alread-defined variable whose bindings and indicators have already been initialised. So rather than initialise indicators/bindings, we must update them with the information of this new Identifier node.
      //
      case 'Identifier': {
        // 1) Update the binding this Identifier node is referencing:

        // ignore special Identifiers; there are no bindings/indicators for these.
        if (path.isMsg() || path.isRequireStatement() || path.isRevertStatement() || path.isThis()) break;

        // `Identifier` nodes _refer_ to already-declared variables. We grab the binding for that referenced variable:
        const referencedBinding = this.getReferencedBinding(node);

        if (!referencedBinding)
          break;

        const functionDefScope = this.getAncestorOfScopeType(
          'FunctionDefinition',
        );
        // const contractDefScope = this.getAncestorOfScopeType(
        //   'ContractDefinition',
        // );

        if (this.scopeType === 'FunctionDefinition')
          this.indicators.update(path);

        if (
          referencedBinding instanceof VariableBinding &&
          referencedBinding.isSecret &&
          this.scopeType === 'FunctionDefinition'
        ) {
          this.containsSecret = true;
        }

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
          functionDefScope.indicators[referencedId] =
            functionDefScope.indicators[referencedId] ??
            new StateVariableIndicator(path);

          const referencedIndicator = functionDefScope.indicators[referencedId];

          // Update the indicator of the stateVariable being referenced by this Identifier node, to reflect the information contained in this Identifier node:
          // @Indicator update properties
          referencedIndicator.update(path);
        }


        if (!referencedNode.stateVariable && referencedNode.nodeType !== 'FunctionDefinition') {
          functionDefScope.indicators[referencedId].update(path);
        }

        // msg.sender might not be a 'top level' argument of the require statement - perhaps it's nested within some more complex expression. We look for it in order to throw an 'unsupported' error. TODO: figure out how to infer restrictions in this case.
        const findMsgSenderVisitor = (path: NodePath, state: any) => {
          state.found ||= (path.isMsgSender() || path.isMsgValue());
        };
        let subState = {found: false};
        path.traversePathsFast(findMsgSenderVisitor, subState);
        if (subState.found)
          throw new Error(
            `msg.sender or msg.value is nested deep within a require statement. That's currently unsupported, as it's tricky to infer ownership from this.`,
          );

        break;
      }
      case 'FunctionCall':
      case 'ContractDefinition':
      case 'FunctionDefinition':
      case 'EventDefinition':
      case 'EmitStatement':
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
      case 'IfStatement':
      case 'StructDefinition':
      case 'ModifierDefinition':
      case 'ForStatement':
      case 'Break':
      case 'Continue':
      case 'Conditional':
      case 'WhileStatement':
      case 'DoWhileStatement':
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
  findAncestor(callback: CallableFunction): Scope | null {
    let scope: Scope = this;
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
  queryAncestors(callback: CallableFunction): any {
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
  isInScopeType(scopeType: string): boolean {
    let scope: Scope = this;
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
  getAncestorOfScopeType(scopeType: string): Scope {
    return this.findAncestor((scope: Scope) => scope.scopeType === scopeType) || this;
  }

  /**
   * @returns {Binding || null} - the binding of the VariableDeclaration being referred-to by the input referencingNode. The returned binding might be in a higher-level (ancestor) scope.
   */
  getReferencedBinding(referencingNode: any, mappingKeyIndicatorOnly = false): VariableBinding | null {
    const node = referencingNode;
    const id = this.path.getReferencedDeclarationId(node);
    if (!id) return null; // if the node doesn't refer to another variable
    return this.queryAncestors((s: Scope) => {

      const binding = s.bindings[id]
      if (!mappingKeyIndicatorOnly) return binding;
      if (binding instanceof VariableBinding) return binding.mappingKeys[this.getMappingKeyName(referencingNode)];
    });
  }

  /**
   * @returns {String || null} the name of an exported symbol, if one exists for the given `id`
   */
  getReferencedExportedSymbolName(node: any): string | null {
    const id: number = node.referencedDeclaration;
    if (!id) return null;
    const { path } = this;
    const exportedSymbols: { string: number[] } = path.getSourceUnit()?.node.exportedSymbols;
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
  getReferencedIndicator(referencingNode: any, mappingKeyIndicatorOnly: boolean = false): StateVariableIndicator | MappingKey | null {
    const { path } = this;
    if (!referencingNode) return null;
    const indicator = this.getIndicatorById(
      path.getReferencedDeclarationId(referencingNode) || referencingNode.id
    );

    if (!path.isMapping(referencingNode) && !path.isArray(referencingNode) && !path.isStruct(referencingNode)) return indicator;

    if (path.isStruct(referencingNode) && NodePath.getPath(referencingNode).getAncestorOfType('MemberAccess') && path.isMapping(referencingNode)) {
      const memberAccessNode = referencingNode.nodeType === 'MemberAccess'
        ? referencingNode
        : NodePath.getPath(referencingNode).getAncestorOfType('MemberAccess')
            .node;

      const indexAccessNode =
        memberAccessNode.expression.nodeType === 'IndexAccess'
          ? memberAccessNode.expression
          : NodePath.getPath(memberAccessNode).getAncestorOfType('IndexAccess')
              .node;

      return mappingKeyIndicatorOnly
        ? indicator.mappingKeys[this.getMappingKeyName(indexAccessNode)]
        : indicator;
    }

    if (path.isStruct(referencingNode) && NodePath.getPath(referencingNode).getAncestorOfType('MemberAccess')) {
      const memberAccessNode = referencingNode.nodeType === 'MemberAccess'
        ? referencingNode
        : NodePath.getPath(referencingNode).getAncestorOfType('MemberAccess')
            .node;
      return mappingKeyIndicatorOnly
        ? indicator.structProperties[memberAccessNode.memberName]
        : indicator;
    }

    if ((path.isConstantArray(referencingNode) || referencingNode.memberName === 'length') && !NodePath.getPath(referencingNode).getAncestorOfType('IndexAccess')) return indicator;

    // getMappingKeyName requires an indexAccessNode - referencingNode may be a baseExpression or indexExpression contained Identifier
    const indexAccessNode =
      referencingNode.nodeType === 'IndexAccess'
        ? referencingNode
        : NodePath.getPath(referencingNode).getAncestorOfType('IndexAccess')
            .node;

    return mappingKeyIndicatorOnly
      ? indicator.mappingKeys[this.getMappingKeyName(indexAccessNode)]
      : indicator;
  }

  /**
   * @returns {Node || null} - the node (VariableDeclaration) being referred-to by the input referencingNode.
   */
  getReferencedNode(referencingNode: any): any | null {
    const binding = this.getReferencedBinding(referencingNode);
    return binding?.node || null;
  }

  /**
   * @returns {Node || null} - the node (VariableDeclaration) being referred-to by the input referencingNode.
   */
  getReferencedPath(referencingNode: any): NodePath | null {
    const binding = this.getReferencedBinding(referencingNode);
    return binding?.path || null;
  }

  /**
   * @returns {Object} - all bindings from all ancestor scopes.
   */
  getAncestorBindings(): any {
    let scope: Scope = this;
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
  filterBindingsByBooleans(booleanKeys: string[]): any {
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
  filterBindings(callback: CallableFunction): any {
    const { bindings } = this;
    const result = filterObject(bindings, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.some prototype)
   * @returns {Boolean} - true if one of the values of the object is evaluated as 'true' by the callback
   */
  someBinding(callback: CallableFunction): boolean {
    const result = someObject(this.bindings, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.filter prototype)
   * @returns {Object} - a set of bindings from this scope, filtered according to the callback
   */
  filterAncestorBindings(callback: CallableFunction): any {
    const ancestorBindings = this.getAncestorBindings();
    const result = filterObject(ancestorBindings, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.filter prototype)
   * @returns {Object} - a set of modifiedBindings from this scope, filtered according to the callback
   */
  filterModifiedBindings(callback: CallableFunction): any {
    const { modifiedBindings } = this;
    const result = filterObject(modifiedBindings, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes a binding object as input and returns a boolean (same as the Array.filter prototype)
   * @returns {Object} - a set of modifiedBindings from this scope, filtered according to the callback
   */
  filterReferencedBindings(callback: CallableFunction): any {
    const { referencedBindings } = this;
    const result = filterObject(referencedBindings, callback);
    return result;
  }

  /**
   * @param {Array<string>} booleanKeys - an array of strings of the boolean keys of a FunctionDefinition scope's indicator object.
   * @returns {Object} - a FunctionDefinition scope's indicators, filtered according to the booleanKeys
   */
  filterIndicatorsByBooleans(booleanKeys: string[]): any {
    let result = {};
    if (!Array.isArray(booleanKeys))
      throw new Error('booleanKeys param must be an array.');
    let validBooleanKeys: string[];
    switch (this.scopeType) {
      case 'FunctionDefinition':
        validBooleanKeys = [
          'isReferenced',
          'isModified',
          'oldCommitmentAccessRequired',
          'isNullified',
          'initialisationRequired',
          'newCommitmentsRequired',
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
  filterIndicators(callback: CallableFunction): any {
    const result = filterObject(this.indicators, callback);
    return result;
  }

  /**
   * @param {Function} callback - a callback which takes an indicator object as input and returns a boolean (same as the Array.some prototype)
   * @returns {Boolean} - true if one of the values of the object is evaluated as 'true' by the callback
   */
  someIndicator(callback: CallableFunction): boolean {
    const result = someObject(this.indicators, callback);
    return result;
  }

  /**
   * Gets a Function Definition scope's indicator object for a particular state variable's id.
   * @param {Number} id - an AST node's id.
   * @returns {Indicator Object || null}
   */
  getIndicatorById(id: number): any | null {
    return this.indicators[id] || null;
  }

  /**
   * Gets a Function Definition scope's indicator object for a particular state variable.
   * @param {Number} id - an AST node's id.
   * @returns {Indicator Object || null}
   */
  getIndicatorByName(name: string): any | null {
    let indicator: StateVariableIndicator;
    const indicators: StateVariableIndicator[] = Object.values(this.indicators);
    for (indicator of indicators) {
      if (indicator && indicator.name === name) return indicator;
    }
    return null;
  }

  // TODO: one for 'uses' secret state?

  /**
   * A mapping's key will contain an Identifier node pointing to a previously-declared variable.
   * @param {Object} - the mapping's index access node.
   * @returns {Node} - an Identifier node
   */
  getMappingKeyIdentifier(indexAccessNode: any): any {
    if (indexAccessNode.nodeType !== 'IndexAccess') return null;

    const { path } = this;
    const { indexExpression } = indexAccessNode;
    const keyNode = (path.isMsgSender(indexExpression) || path.isMsgValue(indexExpression))
      ? indexExpression?.expression
      : indexExpression; // the former to pick up the 'msg' identifier of a 'msg.sender' ast representation
    return keyNode;
  }

  /**
   * Gets a mapping key name for an identifier (not nec. an index access node).
   * @param {Object} - the possible mapping key's identifier.
   * @returns {String} - the name under which the mapping[key]'s indicator is stored
   */
  getIdentifierMappingKeyName(identifierNode: any, forceNotModification = false): any {
    if (this.path.isMsg(identifierNode)) return identifierNode.name;
    if (identifierNode.nodeType === 'MemberAccess') return identifierNode.memberName;
    const refPaths = this.getReferencedIndicator(identifierNode)?.referencingPaths;
    const thisIndex = refPaths?.findIndex(p => p.node === identifierNode);
    if (refPaths && thisIndex && refPaths[thisIndex]?.key === 'indexExpression') return this.getMappingKeyName(refPaths[thisIndex].getAncestorOfType('IndexAccess'));
    let { name } = identifierNode;
    // we find the next indexExpression after this identifier
    for (let i = Math.max(thisIndex, 0) || 0; i < (refPaths?.length || 0); i++) {
      if (refPaths?.[i].key !== 'indexExpression' || (!thisIndex && thisIndex !== 0 )) continue; 
      if (refPaths[thisIndex].isModification() && !forceNotModification) {
        name = this.getMappingKeyName(refPaths[i].getAncestorOfType('IndexAccess'));
        break;
        // if this identifier is not a modification, we need the previous indexExpression
      } else {
        for (let j = i - 1; j >= 0; j--) {
          if (refPaths[j].key === 'indexExpression') {
            name = this.getMappingKeyName(refPaths[j].getAncestorOfType('IndexAccess'));
            return name;
          }
        }
      }
    }
    return name;
  }

  /**
   * Gets a mapping's indicator name for a particular key.
   * @param {Object} - the mapping's index access node.
   * @returns {String} - the name under which the mapping[key]'s indicator is stored
   */
  getMappingKeyName(indexAccessNode: any): string {
    let indexAccessPath: NodePath;
    if (indexAccessNode instanceof NodePath) {
      indexAccessPath = indexAccessNode;
      indexAccessNode = indexAccessPath.node;
    } else {
      indexAccessPath = NodePath.getPath(indexAccessNode);
    }
    if (indexAccessNode.nodeType === 'MemberAccess' && indexAccessNode.expression.nodeType === 'IndexAccess')
      return this.getMappingKeyName(NodePath.getPath(indexAccessNode.expression).node);
    const keyIdentifierNode = indexAccessPath.getMappingKeyIdentifier(indexAccessNode);
    if (!keyIdentifierNode)
      return indexAccessNode.indexExpression.name || indexAccessNode.indexExpression.value;
    keyIdentifierNode.name ??= keyIdentifierNode.value;
    const returnKeyName = node => {
      if (this.path.isMsg(node)) return 'msg';
      switch (node.nodeType) {
        case 'VariableDeclaration':
        case 'Identifier':
          return node.name;
        case 'MemberAccess':
          return `${returnKeyName(node.expression)}.${node.memberName}`;
        case 'IndexAccess':
          return `${returnKeyName(node.baseExpression)}[${returnKeyName(node.indexExpression)}]`;
        case 'Literal':
          return node.value;
        default:
          return ``;
      }
    };
    const returnBinding = node => {
      if (this.path.isMsg(node)) return null;
      switch (node.nodeType) {
      case 'Literal':
        return null;
      case 'Identifier':
        return this.getReferencedBinding(node)
      case 'MemberAccess':
        return returnBinding(node.expression).structProperties[node.memberName];
      case 'IndexAccess':
        return returnBinding(node.baseExpression).mappingKeys[returnKeyName(node.indexExpression)]
      default:
        return null;
      }
    };
    const keyBinding = returnBinding(keyIdentifierNode);
    let keyName = returnKeyName(keyIdentifierNode);

    if (!(keyBinding instanceof VariableBinding) && !(keyBinding instanceof MappingKey)) return keyName;
    // If the value of the mapping key is edited between mapping accesses then the below copes with that.
    // NB: we can't use the modification count because this may refer to a mappingKey before its modified for the nth time
    if (keyBinding?.isModified) {
      let i = 0;
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
      if (i > 0) keyName = `${returnKeyName(keyIdentifierNode)}_${i}`;
    }
    return keyName;
  }

  /**
   * @returns {Boolean} - if some stateVariable is modified within the scope (of a FunctionDefinition scope).
   */
   modifiesSecretState(): boolean {
     if (this.scopeType !== 'FunctionDefinition') return false;
     const { indicators } = this;
     for (const stateVarId of Object.keys(indicators)) {
       const indicator = indicators[stateVarId];

       if (indicator?.isModified && indicator.binding?.isSecret) return true;

     }
    if (indicators instanceof FunctionDefinitionIndicator && indicators.internalFunctionModifiesSecretState) return true;
     return false;
   }

  /**
   * @returns {Boolean} - if some stateVariable is nullified within the scope (of a FunctionDefinition scope).
   */
  nullifiesSecretState(): boolean {
    if (this.scopeType !== 'FunctionDefinition') return false;
    const { indicators } = this;
    for (const stateVarId of Object.keys(indicators)) {
      const indicator = indicators[stateVarId];
      if (indicator.isNullified && indicator.binding.isSecret) return true;
    }
    return false;
  }

  /**
   * Adds nullifyingPaths to the scope's nullifiedBindings (a subset of modifiedBindings)
   * @param {Object} - the NodePath of the left hand side identifier node
   */
  // addNullifyingPath(identifierPath) {
  //   // TODO I don't think this is ever called
  //   const { node, parent } = identifierPath;
  //   const isMapping = node.typeDescriptions.typeString.includes('mapping');
  //   let referencedBinding = this.getReferencedBinding(node);
  //
  //   if (isMapping) {
  //     // we instead use the mapping[key] binding for most cases
  //     const keyName = this.getMappingKeyName(parent);
  //     referencedBinding = referencedBinding.mappingKeys[keyName];
  //   }
  //
  //   if (
  //     !referencedBinding.nullifyingPaths.some(
  //       p => p.node.id === identifierPath.node.id,
  //     )
  //   ) {
  //     // if the path hasn't been added - possibly not needed
  //     // @Binding new property
  //     referencedBinding.isNullified = true;
  //     referencedBinding.nullifyingPaths.push(identifierPath);
  //   }
  //
  //   if (isMapping) {
  //     // @Binding new property
  //     this.getReferencedBinding(node).isNullified = true; // mark the parent mapping
  //   }
  //
  //   // update this scope, to say "the code in this scope 'nullifies' a variable declared elsewhere"
  //   // @Scope @Binding updated property
  //   this.nullifiedBindings[
  //     identifierPath.node.referencedDeclaration
  //   ] = this.getReferencedBinding(identifierPath.node);
  // }

  /**
   * Adds a caller restriction
   * @param {String} - the restriction (match or exclude)
   * @param {Object} - the node of the restricted address
   */
  addCallerRestriction(restriction: string, restrictedNode: any) {
    if (this.callerRestriction && this.callerRestriction !== restriction)
      throw new TODOError(
        `We don't currently support two types of caller restriction in one scope (e.g. a whitelist and a blacklist.)`,
        restrictedNode,
      );
    this.callerRestriction = restriction;
    this.callerRestrictionNode = restrictedNode;
    // TODO call binding/indicator methods here?
  }
}

export default Scope;
