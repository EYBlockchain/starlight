/* eslint-disable no-param-reassign, no-shadow, no-continue */
// no-unused-vars <-- to reinstate eventually

import { VariableBinding } from '../../../traverse/Binding.js';
import { StateVariableIndicator } from '../../../traverse/Indicator.js';
import NodePath from '../../../traverse/NodePath.js';
import { traverseNodesFast } from '../../../traverse/traverse.js';
import { ZKPError, TODOError, SyntaxError } from '../../../error/errors.js';
import { KeyObject } from 'crypto';
import logger from '../../../utils/logger.js';
export let structWarnings = [];


/**
 * @desc:
 * Visitor checks each indicator and binding for errors, now we've done all the prelim traversals
 * If no errors, it updates the indicator with higher level info from the binding.
 * Finally, it checks, in the binding, that every secret whole state is nullified.
 */

export default {
  VariableDeclaration: {
    enter(path: NodePath) {
      const { node, scope } = path;
      if (path.isConstantArray() && node.stateVariable && node.isSecret) {
        throw new TODOError(
          `We can't currently handle secret arrays of constant length. If you want one editable state, try a struct, otherwise use a mapping or dynamic array.`,
          node
        );
      }
      if (node.value && scope.scopeType === 'ContractDefinition') {
        if (!path.getSiblingNodes().some((sib: any) => sib.kind === 'constructor'))
          throw new SyntaxError(`Your variable ${node.name} is being initialised without any constructor - we can't create a commitment for this value without a circuit present. Consider moving this initial value to the constructor.`);

        if (node.value.nodeType === 'Identifier') {
          throw new SyntaxError(`Your variable ${node.name} is being initialised to ${node.value.name} outside of a function. Consider moving it to the constructor or another function.`);
        }
      }
    }
  },

  IfStatement: {
    exit(path: NodePath) {
      const { trueBody, falseBody, condition } = path.node;

      if([falseBody?.nodeType, trueBody.nodeType].includes('IfStatement') && (falseBody.containsSecret))
        throw new TODOError(
          `We can't currently handle else-if statements. Try a new if statement with one condition instead of an else-if. This is because ZoKrates can't easily handle multiple computational branches.`,
          trueBody.nodeType === 'IfStatement' ? trueBody : falseBody
        );

      if ((trueBody.containsSecret && trueBody.containsPublic) || !!falseBody && ((falseBody.containsSecret && falseBody.containsPublic) || (falseBody.containsSecret && trueBody.containsPublic) || (trueBody.containsSecret && falseBody.containsPublic))) {
        throw new TODOError(`This if statement contains edited secret and public states - we currently can't edit both in the same statement. Consider separating into public and secret methods.`, path.node);
      }
      if (condition.containsSecret && ( (!!falseBody && falseBody.containsPublic) || trueBody.containsPublic)) {
        throw new TODOError(`This if statement edits a public state based on a secret condition, which currently isn't supported.`, path.node);
      }
      if(trueBody.containsSecret) {
      for (var i=0; i<trueBody.statements.length; i++) {
        if((trueBody.statements[i].nodeType !== 'ExpressionStatement' || trueBody.statements[i].expression.nodeType !== 'Assignment'))
        throw new TODOError(`This if statement expression contains a non assignment operation , which currently isn't supported`, path.node);
      }
    }
      if(falseBody && falseBody.containsSecret) {
      for(var i=0; i< falseBody.statements.length; i++) {
        if(( falseBody.statements[i].nodeType !== 'ExpressionStatement'  || falseBody.statements[i].expression.nodeType !== 'Assignment'))
        throw new TODOError(`This if statement contains a non assignment operation , which currently isn't supported`, path.node);
        }
      }
    }
  },

  IndexAccess: {
    exit(path: NodePath) {
      const { node } = path;
      const { indexExpression, baseExpression } = node;
      if (node.containsSecret && node.containsPublic) {
        const mappingBinding = path.getReferencedBinding(baseExpression);
        const keyBinding = path.getReferencedBinding(indexExpression);
        if (keyBinding instanceof VariableBinding && keyBinding.isSecret
          && mappingBinding instanceof VariableBinding && !mappingBinding.isSecret)
          throw new ZKPError(`Accessing a public mapping ${mappingBinding.name} with a secret value ${keyBinding.name} is not supported - there is no way to hide the secret value when it's used in a public call`, path.node);
      }
    }
  },

  EventDefinition: {
    exit(path: NodePath) {
      const { parameters } = path.node;
      for(let i=0 ; i< parameters.parameters.length ; i++) {
      if(parameters.parameters[i].isSecret)
      throw new TODOError(`EventDefinition contains secret states , which isn't supported.`, path.node);
      }
    }
  },

  EmitStatement: {
    exit(path: NodePath) {
      if(path.node.eventCall.containsSecret)
      throw new TODOError(`EmitStatement contains secret states , which isn't supported.`, path.node);
    }
  },

  WhileStatement: {
    exit(path: NodePath) {
      if(path.node.containsSecret)
      throw new TODOError(`WhileStatement contains secret states , which isn't supported.`, path.node);
    }
  },

  DoWhileStatement: {
    exit(path: NodePath) {
      if(path.node.containsSecret)
      throw new TODOError(`DoWhileStatement contains secret states , which isn't supported.`, path.node);
    }
  },

  ForStatement: {
    exit(path: NodePath) {
      const { initializationExpression, loopExpression, condition, body } = path.node;
      const miniIdVisitor = (thisNode: any, thisState: any) => {
        if (thisNode.nodeType === 'Identifier') thisState.push(thisNode.referencedDeclaration);
      };

      let idInLoopExpression = [];
      traverseNodesFast(loopExpression, miniIdVisitor, idInLoopExpression);

      const miniMappingVisitor = (thisNode: any) => {
        if (thisNode.nodeType !== 'IndexAccess') return;
        if (path.isLocalStackVariable(thisNode) || path.isFunctionParameter(thisNode)) return;
        const key = path.getMappingKeyIdentifier(thisNode);
        if (!key.referencedDeclaration) return;
        if (idInLoopExpression.includes(key.referencedDeclaration))
        throw new ZKPError(`The mapping ${thisNode.baseExpression.name} is being accessed by the loop expression ${key.name}, which means we are editing as many secret states as there are loop iterations. This is not currently supported due to the computation involved.`, thisNode);
      };

      traverseNodesFast(body, miniMappingVisitor);
      
      if ((condition.containsSecret || initializationExpression.containsSecret || loopExpression.containsSecret) && body.containsPublic) {
        throw new TODOError(`This For statement edits a public state based on a secret condition, which currently isn't supported.`, path.node);
      }

      const miniIncrementationVisitor = (thisNode: any) => {
        if (thisNode.nodeType !== 'Identifier') return;
        const binding = path.scope?.getReferencedBinding(thisNode);
        if (binding?.isPartitioned && NodePath.getPath(thisNode).isModification())
          throw new TODOError(`This For statement increments or decrements a partitioned state, which is not currently supported in a loop.`, thisNode);
      }

      traverseNodesFast(body, miniIncrementationVisitor);

    }
  },

  FunctionDefinition: {
    exit(path: NodePath, state: any) {
      const { scope } = path;
      if (path.node.containsSecret && path.node.kind === 'constructor') path.node.name = 'cnstrctr';
      if (path.node.containsSecret && (path.node.kind === 'fallback' || path.node.kind === 'receive'))
      throw new TODOError(`Secret states on fallback / receive functions is currently not supported`, path.node);
      for (const [, indicator] of Object.entries(scope.indicators)) {
        // we may have a function indicator property we'd like to skip
        if (!(indicator instanceof StateVariableIndicator)) continue;
        indicator.prelimTraversalErrorChecks();
        indicator.updateFromBinding();
        indicator.updateNewCommitmentsRequired();
        indicator.updateEncryption(state.options);
        if (indicator.isStruct) {
          let found = { whole: false, partitioned: false };
          for (const [, structProperty] of Object.entries(indicator.structProperties)) {
            found.whole = structProperty.isWhole;
            found.partitioned = structProperty.isPartitioned;
          }
          if (found.whole && found.partitioned)
            throw new TODOError(`Found a struct which has both whole and partitioned states, this currently is not supported as these state types require different commitment structures. For now, one commitment per struct is supported.`, indicator.node);
        }
      }
      // finally, we update commitments req for the whole function
      scope.indicators.updateNewCommitmentsRequired();
    },
  },

  ContractDefinition: {
    exit(path: NodePath) {
      // bindings are contract scope level, so we track global states here
      const { scope } = path;
      for (const [, binding] of Object.entries(scope.bindings)) {
        if (!(binding instanceof VariableBinding)) continue;
        binding.prelimTraversalErrorChecks();
      }
      if(structWarnings.length>0) {
      logger.warn( ' The following struct properties may cause unconstrained variable errors in the circuit ' , Array.from(new Set(structWarnings)));
      }
      structWarnings = [];
      // if no errors, we then check everything is nullifiable
      for (const [, binding] of Object.entries(scope.bindings)) {
        // TODO find contract level binding and call once
        if (!(binding instanceof VariableBinding)) continue;
        binding.isNullifiable();
      }
    },
  },
};
