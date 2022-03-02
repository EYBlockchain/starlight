/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.mjs';
import NodePath from '../../../traverse/NodePath.mjs';
// import { TODOError } from '../../../error/errors.mjs';

/**
 * @desc:
 *
 */

const visitor = {
  Assignment: {
    enter(path, state) {
      const { node, scope } = path;

      const binding = scope.getReferencedBinding(node.leftHandSide); // HACK - only works for one very specific example. We should instead create an `interactsWithSecret` indicator and attach it to any node with a child (or grandchild etc) which isSecret. That way, we could just do node.interactsWithSecret() within this function (and others), which would be clean.

      if (binding?.isSecret) {
        // We won't copy over secret code into the shield contract (obviously). But before we skip this node, we might need to copy over msg.sender if it's a value being assigned to something.
        const subState = { msgSenderFound: false };
        const rhsPath = NodePath.getPath(node.rightHandSide);
        rhsPath.traversePathsFast((p, substate) => {
          if (p.isMsgSender()) substate.msgSenderFound = true;
        }, subState);

        if (subState.msgSenderFound) {
          const fnDefPath = path.getFunctionDefinition();
          const fnDefScope = fnDefPath.scope;
          const fnDefIndicators = fnDefScope.indicators;
          fnDefIndicators.msgSenderParam = true;
        }
      }
    },
  },
};

export default visitor;
