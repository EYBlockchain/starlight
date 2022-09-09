/* eslint-disable no-param-reassign, no-shadow, no-continue */
// no-unused-vars <-- to reinstate eventually

import { VariableBinding } from '../../../traverse/Binding.js';
import { StateVariableIndicator } from '../../../traverse/Indicator.js';
import NodePath from '../../../traverse/NodePath.js';
import { ZKPError, TODOError, SyntaxError } from '../../../error/errors.js';


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
      if ((trueBody.containsSecret && trueBody.containsPublic) || !!falseBody && ((falseBody.containsSecret && falseBody.containsPublic) || (falseBody.containsSecret && trueBody.containsPublic) || (trueBody.containsSecret && falseBody.containsPublic))) {
        throw new TODOError(`This if statement contains edited secret and public states - we currently can't edit both in the same statement. Consider separating into public and secret methods.`, path.node);
      }
      if (condition.containsSecret && ( (!!falseBody && falseBody.containsPublic) || trueBody.containsPublic)) {
        throw new TODOError(`This if statement edits a public state based on a secret condition, which currently isn't supported.`, path.node);
      }
      for (var i=0; i<trueBody.statements.length; i++) {
        if((trueBody.statements[i].nodeType !== 'ExpressionStatement' || trueBody.statements[i].expression.nodeType !== 'Assignment') && trueBody.containsSecret)
        throw new TODOError(`This if statement expression contains a non assignment operation , which currently isn't supported`, path.node);
      }
      if(falseBody) {
      for(var i=0; i< falseBody.statements.length; i++) {
        if(( falseBody.statements[i].nodeType !== 'ExpressionStatement'  || falseBody.statements[i].expression.nodeType !== 'Assignment') && falseBody.containsSecret)
        throw new TODOError(`This if statement contains a non assignment operation , which currently isn't supported`, path.node);
        }
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

  ForStatement: {
    exit(path: NodePath) {
      const { initializationExpression, loopExpression, condition, body } = path.node;
      if ((condition.containsSecret || initializationExpression.containsSecret || loopExpression.containsSecret) && body.containsPublic) {
        throw new TODOError(`This For statement edits a public state based on a secret condition, which currently isn't supported.`, path.node);
      }
    }
  },

  FunctionDefinition: {
    exit(path: NodePath) {
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
        indicator.updateEncryption();
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
      // if no errors, we then check everything is nullifiable
      for (const [, binding] of Object.entries(scope.bindings)) {
        // TODO find contract level binding and call once
        if (!(binding instanceof VariableBinding)) continue;
        binding.isNullifiable();
      }
    },
  },
};
