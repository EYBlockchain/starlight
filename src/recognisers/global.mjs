/**
Simple recogniser to find global variables
*/
import config from 'config';
import { addGlobal } from '../globals.mjs';
// import logger from '../logger.mjs';

function recogniseGlobals(line) {
  for (const g of config.GLOBALS) {
    if (line.startsWith(g)) {
      // global found
      const ln = line.slice(0, -1); // strip ; - need to make this more robust
      const [type, visibility, name] = ln.split(' ');
      addGlobal(type, visibility, name); // add the new global to our table
      return name;
    }
  }
  return false;
}

export default recogniseGlobals;
