/**
Simple recogniser to find global variables
*/

import config from 'config';
import logger from '../utils/logger.mjs';
import process from '../processors/global.mjs';

function recogniseGlobal(line) {
  for (const g of config.globals) {
    if (line.startsWith(g)) {
      // global found
      const ln = line.replace(/ *\([^)]*\) */g, ' ').replace(';', '');
      logger.debug(ln);
      let [type, visibility, name] = ln.split(' ');
      if (name.includes('=')) {
        [type, name] = ln.split(' ');
        visibility = '';
      }
      process({ type, visibility, name }); // call the processor
      return true;
    }
  }
  return false;
}

export default recogniseGlobal;
