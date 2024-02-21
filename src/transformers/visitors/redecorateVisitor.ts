/* eslint-disable no-param-reassign, no-shadow, no-unused-vars, no-continue */

import logger from '../../utils/logger.js';

/**
 * @desc:
 * Visitor creates a `.zol` AST from a `.sol` AST.
 * Using a custom object `toRedecorate` (=`state`) from the 'dedecoration'
 * phase, this Visitor adds properties to `.sol` AST nodes. The properties
 * which get added represent 'Zolidity' decorators that the user originally used
 * to label states (e.g. as `secret`/`unknown`/ etc.) but that were removed
 * during the 'dedecoration' phase in order to generate a `.sol` AST using solc.
 */

export default {
  VariableDeclarationStatement: {
    enter(node: any, state: any) {
      // we only care about statements if they contain a secret declaration
      // a VariableDeclarationStatement which holds a VariableDeclaration has one only one declaration
      if (node.declarations[0].nodeType !== 'VariableDeclaration') return;
      const varDec = node.declarations[0];
      // for each decorator we have to re-add...
      for (const toRedecorate of state) {
        // skip if the decorator is not secret (can't be a variable dec) or if its already been added
        if (toRedecorate.added || toRedecorate.decorator !== 'secret') continue;
        // extract the char number
        const srcStart = varDec.src.split(':')[0];
        // if it matches the one we removed, throw warning
        if (toRedecorate.charStart === Number(srcStart)) {
          logger.warn(
            `Superfluous 'secret' decorator used for a local declaration. If the variable interacts with a secret state, it will automatically be kept secret.`,
          );
          return;
        }
      }
    },
  },

  VariableDeclaration: {
    enter(node: any, state: any) {
      // for each decorator we have to re-add...
      for (const toRedecorate of state) {
        // skip if the decorator is not secret or sharedSecret (can't be a variable dec) or if its already been added
        if (toRedecorate.added || (toRedecorate.decorator !== 'secret' &&  toRedecorate.decorator !== 'sharedSecret')) continue;
        // extract the char number
        const srcStart = node.src.split(':')[0];
        // if it matches the one we removed, add it back to the AST
        if (toRedecorate.charStart === Number(srcStart)) {
          toRedecorate.added = true;
          node.isSecret = true;
          if(toRedecorate.decorator === 'sharedSecret')node.isSharedSecret = true;
          return;
        }
      }
    },
  },

  ExpressionStatement: {
    enter(node: any, state: any) {
      // for each decorator we have to re-add...
      for (const toRedecorate of state) {
        // skip if the decorator is not secret (can't be a variable dec) or if its already been added
        if (toRedecorate.added || toRedecorate.decorator !== 'encrypt') continue;
        // extract the char number
        const srcStart = node.src.split(':')[0];
        // if it matches the one we removed, add it back to the AST
        if (toRedecorate.charStart === Number(srcStart)) {
          toRedecorate.added = true;
          node.forceEncrypt = true;
          return;
        }
      }
    },
  },

  Identifier: {
    enter(node: any, state: any) {
      // see varDec for comments
      for (const toRedecorate of state) {
        if (toRedecorate.added || toRedecorate.decorator === 'secret') continue;
        const srcStart = node.src.split(':')[0];
        if (toRedecorate.charStart === Number(srcStart)) {
          toRedecorate.added = true;
          switch (toRedecorate.decorator) {
            case 'known':
              node.isKnown = true;
              return;
            case 'unknown':
              node.isUnknown = true;
              return;
            case 'reinitialisable':
              node.reinitialisable = true;
              return;
            default:
              return;
          }
        }
      }
    },
  },
};
