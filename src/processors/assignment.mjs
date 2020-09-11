/**
output code for assignement
*/
import logger from '../utils/logger.mjs';
import { globals, inits, node, solidity, zokrates } from '../state.mjs';
import { assignNode, assignZokrates, assignSolidity } from '../standardFunctions/assignment.mjs';
import CompilerError from '../utils/compiler-error.mjs';
import processExpression from './expression.mjs';

function processAssignment(assignment) {
  // if this is the first assignment we've made, we need to import some boilerplate functions to execute a general assignment.
  if (!inits.assignment) {
    node.standardFunctions += assignNode;
    zokrates.standardFunctions += assignZokrates;
    solidity.standardFunctions += assignSolidity;
    inits.assignment = true;
  }

  const { expression, variable } = assignment;
  // split up the expression into Terms
  const terms = processExpression(expression);

  // now iterate through each term
  for (const term of terms) {
    // check we know how to process this assignment
    if (isNaN(term))
      throw new CompilerError('Only number expressions are supported in assignments');
    if (!globals[variable])
      throw new CompilerError('Only global variables are supported in assignments');

    if (!globals[variable].initialised) {
      // the global has been defined but has no initial value, so we can just
      // add a commitment: there's nothing to nullify
      globals[variable].initialised = true; // but from now on a commitment exist, so we will have to nullify
      logger.info(`Committing to a value of ${term} for variable '${variable}'`);

      // no assignment code for Solidity, once we've initialised it

      // assignment code for node and Zokrates, this makes the assignment code specific to the variable in question
      node.src += `\nprivateParams = [ ...privateParams, ${variable}_salt ];\npublicParams = [...publicParams, ${term}, ${variable}_publicKey, hash(${term}, ${variable}_publicKey,  ${variable}_salt) ];
      `;

      zokrates.src += `\ncheck_commitment(${variable}, ${variable}_publicKey, ${variable}_salt, ${variable}_hash)`;

      zokrates.mainParams += ` private field ${variable}, field ${variable}_publicKey, private field ${variable}_salt, field ${variable}_hash`;
    } else {
      // must nullify the previous commitment
      throw new CompilerError(
        `A commitment already exists but I don't know how to nullify it yet.  However, if I did know, I'd nullify it and then create a new commitment, equal to the old commitment plus ${term}`,
      );
    }
  }
}

export default processAssignment;
