/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.js';
import NodePath from '../../../traverse/NodePath.js';
// import { TODOError } from '../../../error/errors.mjs';

/**
 * @desc:
 * Visitor throws a warning if the user is trying to compile Solidity which
 * declares a local variable within a function.
 * Local variables are tricky to deal with (and are a future enhancement),
 * because they might interact with public and/or private states. Deciding
 * which logic should remain in the shield contract, and which should be moved
 * into the circuit is tricky (as is making sure the parameters to the circuit
 * align with those decisions).
 */

let warningThrown = false;

const visitor = {
  'VariableDeclarationStatement|VariableDeclaration': {
    enter(path: NodePath, state: any) {
      const { node } = path;

      if (path.getAncestorContainedWithin('body') && !warningThrown) {
        warningThrown = true;
        logger.warn(
          "Local state declarations aren't fully supported yet, because their possible interactions with private states complicate things considerably. If the local state you've declared interacts with a secret variable, transpilation might result in bugs at the moment. We're actively working on it.",
        );
      }
    },
  },
};

export default visitor;
