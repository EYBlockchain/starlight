/**
Parser for lines of Solidity
*/

import logger from './utils/logger.mjs';
import recognisers from './recognisers/index.mjs';
import processors from './processors/index.mjs';

// main function of this module
function parse(line) {
  if (!line) return; // this is a line we can ignore
  // run through the various recognisers
  const global = recognisers.recogniseGlobal(line);
  const assignment = recognisers.recogniseAssignment(line);
  const func = recognisers.recogniseFunction(line);

  if (global) {
    processors.addGlobal(global); // add the new global to our table
    logger.info(`added a Global called ${global.name}`);
  } else if (assignment) {
    logger.info(`${assignment.variable} was assigned value ${assignment.expression}`);
    processors.processAssignment(assignment);
  } else if (func) {
    logger.info(`Found ${func.type} ${func.name}`);
    processors.processFunction(func);
  }
  logger.debug(line);
}

export default parse;
