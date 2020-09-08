/**
Simple recogniser to find global variables
*/
import config from 'config';
// import logger from '../logger.mjs';

function recogniseGlobals(line) {
  for (const g of config.GLOBALS) {
    if (line.startsWith(g)) return g;
  }
  return false;
}

export default recogniseGlobals;
