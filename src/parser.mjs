/**
Parser for lines of Solidity
*/

import logger from './utils/logger.mjs';
import recogniseGlobals from './recognisers/global.mjs';

// main function of this module
async function parse(line) {
  if (!line) return; // this is a line we can ignore

  if (recogniseGlobals(line)) logger.info(`Found a Global!`);
  logger.debug(line);
}

export default parse;
