/* eslint-disable no-param-reassign, no-shadow, no-continue */
// no-unused-vars <-- to reinstate eventually

import { VariableBinding } from '../../../traverse/Binding.js';
import { StateVariableIndicator } from '../../../traverse/Indicator.js';
import NodePath from '../../../traverse/NodePath.js';
import { ZKPError, TODOError } from '../../../error/errors.js';


/**
 * @desc:
 * Visitor checks each indicator and binding for errors, now we've done all the prelim traversals
 * If no errors, it updates the indicator with higher level info from the binding.
 * Finally, it checks, in the binding, that every secret whole state is nullified.
 */

export default {

  IfStatement: {
    exit(path: NodePath) {
      const { trueBody, falseBody, condition } = path.node;
      if ((trueBody.containsSecret && trueBody.containsPublic) || (falseBody.containsSecret && falseBody.containsPublic) || (falseBody.containsSecret && trueBody.containsPublic) || (trueBody.containsSecret && falseBody.containsPublic) ) {
        throw new TODOError(`This if statement contains edited secret and public states - we currently can't edit both in the same statement. Consider separating into public and secret methods.`, path.node);
      }
      if (condition.containsSecret && (falseBody.containsPublic || trueBody.containsPublic)) {
        throw new TODOError(`This if statement edits a public state based on a secret condition, which currently isn't supported.`, path.node);
      }
    }
  },

  FunctionDefinition: {
    exit(path: NodePath) {
      const { scope } = path;
      if (path.node.containsSecret && path.node.kind === 'constructor')
        throw new ZKPError(`We cannot handle secret states in the public contract constructor, consider moving your secret state interactions to other functions`, path.node);
      for (const [, indicator] of Object.entries(scope.indicators)) {
        // we may have a function indicator property we'd like to skip
        if (!(indicator instanceof StateVariableIndicator)) continue;
        indicator.prelimTraversalErrorChecks();
        indicator.updateFromBinding();
        indicator.updateNewCommitmentsRequired();
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
