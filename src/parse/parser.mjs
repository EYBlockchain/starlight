/**
Parser for lines of Solidity
This is the connection point between Recognisers and Parsers.
*/

import logger from '../utils/logger.mjs';
import recognisers from '../recognisers/index.mjs';

// main function of this module
function parse(line) {
  if (!line) return; // this is a line we can ignore
  logger.debug(line);
  // run through the various recognisers

  // Inclusive Recognisers.  These recognise a feature in a line.  The line may have many features and will be of a 'type' and so we still have to run the other Recognisers on it.
  recognisers.recogniseCurlyBracket(line);

  // Exclusive Recognisers. These recognise the 'type' of a line - a line can only be of one type and so we can stop processing once we get a hit.
  if (recognisers.recogniseGlobal(line)) return;
  if (recognisers.recogniseAssignment(line)) return;
  if (recognisers.recogniseFunction(line)); // if block for prettiness only
}

export default parse;
