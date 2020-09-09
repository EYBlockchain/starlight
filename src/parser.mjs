/**
Parser for lines of Solidity
*/

import logger from './utils/logger.mjs';
import recogniseGlobals from './recognisers/global.mjs';
import recogniseAssignment from './recognisers/assignment.mjs';
import processAssignment from './processors/assignment.mjs';

// main function of this module
function parse(line) {
  if (!line) return; // this is a line we can ignore
  // run through the various recognisers
  const global = recogniseGlobals(line);
  if (global) {
    logger.info(`Found a Global called ${global}`);
  }
  const assignment = recogniseAssignment(line);
  if (assignment) {
    logger.info(`${assignment.variable} was assigned value ${assignment.expression}`);
    processAssignment(assignment);
  }
  logger.debug(line);
}

export default parse;
