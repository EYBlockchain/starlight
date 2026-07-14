/* eslint-disable no-param-reassign, no-shadow, no-continue */

import { TODOError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';

/**
 * @desc:
 * Throws an error if secret states are passed to an external function call.
 */

export default {
  FunctionCall: {
    enter(path: NodePath) {
      const { node, scope } = path;
      const args = node.arguments;

      if (
        path.isInternalFunctionCall() &&
        node.expression.nodeType === 'Identifier'
      ) {
        for (const [index, arg] of args.entries()) {
          if (
            arg.nodeType !== 'Identifier' &&
            !arg.expression?.typeDescriptions?.typeIdentifier?.includes(
              '_struct',
            )
          ) {
            // If we support expressions, e.g. `a - amount`, we will need to ensure there are
            // constraints in the circuits to prevent underflows/ overflows
            throw new TODOError(
              `Unsupported argument ${index + 1} in internal function call '${
                node.expression.name
              }'. Only identifiers and struct member accesses are currently supported.`,
              node,
            );
          }
        }

        const isSecretArray = args.map(
          arg => scope.getReferencedBinding(arg)?.isSecret,
        );
        const functionReferencedPath = scope.getReferencedPath(node.expression);
        const params = functionReferencedPath.node.parameters.parameters;
        params.forEach((param, index) => {
          if (param.isSecret) {
            if (isSecretArray[index] !== param.isSecret)
              throw new Error(
                'Make sure that passed parameters have same decorators',
              );
          }
        });
        const thisFunctionIndicator = path.scope.indicators;
        thisFunctionIndicator.internalFunctionInteractsWithSecret ??=
          functionReferencedPath.scope.indicators.interactsWithSecret;
        thisFunctionIndicator.internalFunctionModifiesSecretState ??=
          functionReferencedPath.scope.modifiesSecretState();
      }
    },
  },
};
