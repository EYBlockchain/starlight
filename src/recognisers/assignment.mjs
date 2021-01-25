/**
Recognise an expression of the form
variable = expression
*/

import process from '../processors/assignment.mjs';
import logger from '../utils/logger.mjs';

const operators = [' = ', '+= ', '-= '];

function recogniseAssignment(line) {
  // find assignements - currently we're over-reliant on correct spacing
  for (const operator of operators) {
    if (line.includes(operator)) {
      // it's an assignement
      const ln = line.replace(';', '');
      const [variable, expression] = ln.split(operator).map(el => el.trim());
      // process({ variable, expression }); temp removing
      logger.debug(`variable '${variable}' committing to a value of ${expression}`);
      return true;
    }
  }

  return false;
}

export default recogniseAssignment;
