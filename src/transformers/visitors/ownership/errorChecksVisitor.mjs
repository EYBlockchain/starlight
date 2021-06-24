/* eslint-disable no-param-reassign, no-shadow, no-continue */
// no-unused-vars <-- to reinstate eventually

import { StateVariableIndicator } from '../../../traverse/Indicator.mjs';

/**
 * @desc:
 * Visitor checks each indicator and binding for errors, now we've done all the prelim traversals
 * If no errors, it updates the indicator with higher level info from the binding.
 * Finally, it checks, in the binding, that every secret whole state is nullified.
 */

export default {
  FunctionDefinition: {
    exit(path) {
      const { scope } = path;
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
    exit(path) {
      // bindings are contract scope level, so we track global states here
      const { scope } = path;
      for (const [, binding] of Object.entries(scope.bindings)) {
        binding.prelimTraversalErrorChecks();
      }
      // if no errors, we then check everything is nullifiable
      for (const [, binding] of Object.entries(scope.bindings)) {
        // TODO find contract level binding and call once
        binding.isNullifiable();
      }
    },
  },
};
