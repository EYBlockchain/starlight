/* eslint-disable no-param-reassign, no-shadow, no-continue */

import { TODOError, ZKPError } from '../../../error/errors.js';
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
      let isSecretArray : string[];

      for (const arg of args) {
         if (arg.nodeType !== 'Identifier' && !arg.expression?.typeDescriptions.typeIdentifier.includes('_struct')) continue;
         isSecretArray = args.map(arg => scope.getReferencedBinding(arg)?.isSecret);
       }

      if(path.isInternalFunctionCall() && node.expression.nodeType === 'Identifier') {
         const functionReferencedPath = scope.getReferencedPath(node.expression);
         const params = functionReferencedPath.node.parameters.parameters;
         params.forEach((param, index) => {
           if(param.isSecret){
             if(isSecretArray[index] !== param.isSecret)
                throw new Error('Make sure that passed parameters have same decorators');
             }
         });

         const thisFunctionIndicator = path.scope.indicators;
         thisFunctionIndicator.internalFunctionInteractsWithSecret ??= functionReferencedPath.scope.indicators.interactsWithSecret;
         thisFunctionIndicator.internalFunctionModifiesSecretState ??= functionReferencedPath.scope.modifiesSecretState();
      }
    },
  },
};
