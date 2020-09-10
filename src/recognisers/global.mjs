/**
Simple recogniser to find global variables
*/
import config from 'config';
// import logger from '../logger.mjs';

function recogniseGlobal(line) {
  for (const g of config.GLOBALS) {
    if (line.startsWith(g)) {
      // global found
      const ln = line.slice(0, -1); // strip ; - need to make this more robust
      const [type, visibility, name] = ln.split(' ');
      return { type, visibility, name };
    }
  }
  return false;
}

export default recogniseGlobal;
