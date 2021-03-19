/**
Simple recogniser to find global variables
*/

import config from 'config';
import logger from '../utils/logger.mjs';
import process from '../processors/global.mjs';

/**
 * @returns {Boolean} whether the line is a global variable declaration
 */
function recogniseGlobal(line) {
  for (const g of config.globals) {
    if (line.startsWith(g)) {
      // global found
      // / *\([^)]*\) */g matches spaces before "(", the contents of the brackets, then ")", then spaces after ")".
      // hi hi      (hi)   hi  hi          (hi)     .
      //      ^^^^^^^^^^^^^      ^^^^^^^^^^^^^^^^^^^
      // Removes the brackets of a mapping declaration. But this would also (badly) remove variables declared as a tuple (). // TODO
      const ln = line.replace(/ *\([^)]*\) */g, ' ').replace(';', ''); // removes (contents of brackets) and ";".
      logger.debug(ln);
      let [type, visibility, name] = ln.split(' '); // FIXME: unreliable, e.g. if visibilty not specified by user. TODO list possible types & visibilities in the config.
      if (name.includes('=') || name === '=') {
        // <-- TODO try to not end up in a position where we're checking `name === '='`.
        [type, name] = ln.split(' ');
        visibility = '';
        // console.log([type, name]);
      }
      process({ type, visibility, name }); // call the processor
      return true;
    }
  }
  return false;
}

export default recogniseGlobal;
