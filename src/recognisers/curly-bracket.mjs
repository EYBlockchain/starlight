/**
recognises that we are exiting a function.  It has no corresponding processor because it's too simple to require such a separation of concerns - the blockCount is updated here.
*/
import { blockCount } from '../state.mjs';

function recogniseCurlyBracket(line) {
  // This functions works out how many nested blocks you are now in
  const increment = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
  if (!increment) return false;
  blockCount.value += increment;
  // the blockCount (scope) has changed so we may need to do something:
  // if (increment === -1 && blockCount.value === 1) processors.processEndOfFunction(); temp removed
  return blockCount;
}

export default recogniseCurlyBracket;
