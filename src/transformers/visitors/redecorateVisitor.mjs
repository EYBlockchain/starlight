/* eslint-disable no-param-reassign, no-shadow, no-unused-vars, no-continue */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../utils/logger.mjs';
import { traverse, traverseNodesFast } from '../../traverse/traverse.mjs';

export default {
  VariableDeclaration: {
    enter(path, state) {
      const { node } = path;
      // for each decorator we have to re-add...
      for (const toRedecorate of state) {
        // skip if the decorator is not secret (can't be a variable dec) or if its already been added
        if (toRedecorate.added || toRedecorate.decorator !== 'secret') continue;
        // extract the char number
        const srcStart = node.src.split(':')[0];
        // if it matches the one we removed, add it back to the AST
        if (toRedecorate.charStart === Number(srcStart)) {
          if (path.isInType('VariableDeclarationStatement'))
            logger.warn(
              `Superfluous 'secret' decorator used for a local declaration. If the variable interacts with a secret state, it will automatically be kept secret.`,
            );
          toRedecorate.added = true;
          node.isSecret = true;
          return;
        }
      }
    },

    exit(path) {},
  },

  Identifier: {
    enter(path, state) {
      // see varDec for comments
      const { node } = path;
      for (const toRedecorate of state) {
        if (toRedecorate.added || toRedecorate.decorator === 'secret') continue;
        const srcStart = node.src.split(':')[0];
        if (toRedecorate.charStart === Number(srcStart)) {
          toRedecorate.added = true;
          toRedecorate.decorator === 'known'
            ? (node.isKnown = true)
            : (node.isUnknown = true);
          return;
        }
      }
    },

    exit(path) {},
  },
};
