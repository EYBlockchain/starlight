/**
Simple recogniser to find global variables
*/

import config from 'config';
import logger from '../utils/logger.mjs';
import process from '../processors/global.mjs';

function recogniseGlobal(line) {
  for (const g of config.GLOBALS) {
    if (line.startsWith(g)) {
      // global found
      const ln = line.slice(0, -1); // strip ; - need to make this more robust
      const [type, visibility, name] = ln.split(' ');
      process({ type, visibility, name }); // call the processor
      logger.info(`added a Global called ${name}`);
      return true;
    }
  }
  return false;
}

export default recogniseGlobal;
