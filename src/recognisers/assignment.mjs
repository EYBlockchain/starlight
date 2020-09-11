/**
Recognise an expression of the form
variable = expression
*/

import process from '../processors/assignment.mjs';
import logger from '../utils/logger.mjs';

function recogniseAssignment(line) {
  // find assignements - currently we're over-reliant on correct spacing
  if (line.includes(' = ')) {
    // it's an assignement
    const ln = line.slice(0, -1); // strip ; TODO make this more robust
    const [variable, expression] = ln.split('=').map(el => el.trim());
    process({ variable, expression });
    logger.info(`variable '${variable}' committing to a value of ${expression}`);
    return true;
  }
  return false;
}

export default recogniseAssignment;
