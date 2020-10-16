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
      const ln = line.slice(0, -1).replace(/ *\([^)]*\) */g, ' '); // strip and remove brackets ; - need to make this more robust
      console.log(ln);
      const [type, visibility, name] = ln.split(' ');
      process({ type, visibility, name }); // call the processor
      logger.info(`added a Global called ${name}`);
      return true;
    }
  }
  return false;
}

export default recogniseGlobal;
