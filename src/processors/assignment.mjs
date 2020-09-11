/**
output code for assignement
*/
import logger from '../utils/logger.mjs';
import { globals, inits, node, solidity, zokrates } from '../state.mjs';
import { assignNode, assignZokrates, assignSolidity } from '../standardFunctions/assignment.mjs';
import CompilerError from '../utils/compiler-error.mjs';

function processAssignment(assignment) {
  const { expression, variable } = assignment;
  // check we know how to process this assignment
  if (isNaN(expression))
    throw new CompilerError('Only number expressions are supported in assignments');
  if (!globals[variable])
    throw new CompilerError('Only global variables are supported in assignments');
  logger.silly(`Processing assignment '${variable} = ${expression}'\n`);

  // if this is the first assignment we've made, we need to import some boilerplate functions to execute a general assignment.
  if (!inits.assignment) {
    node.standardFunctions += assignNode;
    zokrates.standardFunctions += assignZokrates;
    solidity.standardFunctions += assignSolidity;
    inits.assignment = true;
  }

  // no assignment code for Solidity, once we've initialised it

  // assignment code for node and Zokrates, this makes the assignment code specific to the variable in question
  node.src += `\nprivateParams = [ ...privateParams, ${variable}_salt ];\npublicParams = [...publicParams, ${expression}, ${variable}_publicKey, hash(${expression}, ${variable}_publicKey,  ${variable}_salt) ];
  `;

  zokrates.src += `\ncheck_commitment(${variable}, ${variable}_publicKey, ${variable}_salt, ${variable}_hash)`;

  zokrates.mainParams += ` private field ${variable}, field ${variable}_publicKey, private field ${variable}_salt, field ${variable}_hash`;
}

export default processAssignment;
