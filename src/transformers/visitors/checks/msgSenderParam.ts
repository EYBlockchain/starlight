/* eslint-disable no-param-reassign, no-shadow */

import NodePath from '../../../traverse/NodePath.js';
// import { TODOError } from '../../../error/errors.mjs';

/**
 * @desc:
 *
 */

const visitor = {

  FunctionDefinition: {
    enter(path: NodePath, state: any) {
      if (!path.scope.modifiesSecretState()) state.skipSubNodes = true;
    }
  },

  MemberAccess: {
    enter(path: NodePath) {
      if (!path.isMsgSender()) return;
      const isMappingKey = path.containerName === 'indexExpression';
      let expressionPath = path.getAncestorOfType('ExpressionStatement');
      expressionPath ??= path.getAncestorOfType('Assignment');
      expressionPath ??= path.getAncestorOfType('BinaryOperation');

      const fnDefPath = path.getFunctionDefinition();
      const fnDefIndicators = fnDefPath?.scope.indicators;


      // either a) msg.sender is a value we need for a secret or
      // b) it interacts with a public and private state as a mapping key, so we may be allowing cheating if we don't input it to the circuit
      if ((!isMappingKey && expressionPath?.containsSecret) ||
        (expressionPath?.containsPublic && expressionPath.containsSecret)) {
        fnDefIndicators.msgSenderParam = true;
      }
    },
  },
};

export default visitor;
