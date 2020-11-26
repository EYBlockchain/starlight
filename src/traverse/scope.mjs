/* eslint-disable no-shadow, no-param-reassign, no-use-before-define, no-continue */

import logger from '../utils/logger.mjs';
import { scopeCache } from './cache.mjs';

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
    this.bindings = [];
    this.referencedBindings = [];
    this.modifiedBindings = [];
    this.indicators = [];

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
        this.indicators = [
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
        ];
        break;
      default:
    }
  }

  update(path) {
    const { node, parent } = path;
    const { name, id, nodeType } = node;

    if (this.bindings[name])
      throw new Error(
        `Whilst updating scope for nodeType ${nodeType}, expected this.bindings[${name}] to be undefined, but found binding: ${this.bindings[name]} for this scope: ${this}`,
      );

    switch (nodeType) {
      case 'ContractDefinition':
      case 'FunctionDefinition':
        // a 'ContractDefinition' is a declaration (binding) within a SourceUnit scope.
        // a 'FunctionDefinition' is a declaration (binding) within a ContractDefinition scope.
        this.bindings.push({
          kind: nodeType,
          id,
          name,
          node,
          path,
          scope: this,
        });
        break;

      case 'VariableDeclaration':
        this.bindings.push({
          kind: nodeType, // TODO: make 'kind' more specific, e.g. 'param'?
          id,
          name,
          node,
          path,
          scope: this,
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

        if (this.scopeType === 'ContractDefinition' && node.isSecret) {
          this.indicators.commitmentsRequired = true;
          this.indicators.zkSnarkVerificationRequired = true;
        }
        break;

      case 'Identifier': {
        // 1) Update the binding this Identifier node is referencing:
        const referencedBinding = this.findReferencedBinding(node);
        if (!referencedBinding)
          throw new Error(
            `Couldn't find a referencedDeclaration. I.e. couldn't find a node with id ${node.referencedDeclaration}`,
          );

        referencedBinding.referenced = true;
        ++referencedBinding.referenceCount;
        referencedBinding.referencingPaths.push(path);
        this.referencedBindings.push(referencedBinding);

        // Currently, the only state variable 'modification' we're aware of is when a state variable is referenced on the LHS of an assignment:
        if (parent.nodeType === 'Assignment' && path.containerName === 'leftHandSide') {
          referencedBinding.modified = true;
          ++referencedBinding.modificationCount;
          referencedBinding.modifyingPaths.push(path);
          this.modifiedBindings.push(referencedBinding);
        }

        // 2) Update the indicators of the scope:
        const referencedNode = referencedBinding.node;
        if (referencedNode.stateVariable && this.isInScopeType('FunctionDefinition')) {
          const fnDefScope = this.getAncestorOfScopeType('FunctionDefinition');
          const contractDefScope = this.getAncestorOfScopeType('ContractDefinition');
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
    return callback(scope) || scope.parentScope.queryAncestors(callback);
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

  findReferencedBinding(referencingNode) {
    const node = referencingNode;
    if (!node.referencedDeclaration) return null; // if the node doesn't refer to another variable
    return this.queryAncestors(s => {
      return s.bindings.find(binding => binding.node.id === node.referencedDeclaration);
    });
  }

  collectAllAncestorBindings() {
    let scope = this;
    let bindingsArray = [];
    do {
      const { bindings } = scope;
      if (!bindings) continue;
      bindingsArray = bindingsArray.concat(bindings);
      // bindingsArray = bindingsArray.concat(Object.keys(bindings).map(key => bindings[key]));
    } while ((scope = scope.parentScope));
    return bindingsArray;
  }

  collectAllStateVariableBindings() {
    return this.collectAllAncestorBindings().filter(binding => binding.stateVariable);
  }
}

export const isIncremented = (expressionNode, lhsNode, scope) => {
  // here: flag rewrites and incrementations
  let isIncrementedBool;
  let isDecrementedBool;
  // first, check if the LHS node is secret
  let lhsSecret;
  if (lhsNode.nodeType === 'Identifier') {
    const lhsbinding = scope.findReferencedBinding(lhsNode);
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
            const isSecret = scope.findReferencedBinding(param).secretVariable;
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
        const rhsbinding = scope.findReferencedBinding(expressionNode.rightHandSide);
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
  const referencedBinding = scope.findReferencedBinding(lhsNode);
  if (referencedBinding.node.stateVariable && scope.isInScopeType('FunctionDefinition')) {
    const fnDefScope = scope.getAncestorOfScopeType('FunctionDefinition');
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

// export default Scope;
