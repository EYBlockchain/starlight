/**
Simple recogniser to find global variables
*/

import config from 'config';
import logger from '../utils/logger.mjs';
import recogniseGlobal from './global.mjs';
import recogniseAssignment from './assignment.mjs';
import recogniseFunction from './function.mjs';
import recogniseParameters from './parameters.mjs';

const operators = [' = ', '+= ', '-= ']; // QUESTION: why the inconsistent spacing?

function tidy(line) {
  // trim whitespace
  return line.replace(/\s+/g, ' ').replace(/^\s/, '');
}

/**
 * @return {Object} { keyword, type, name, rhs, deDecLine } || {} // FIXME: inconsistent properties returned, depending on input
 */
// FIXME: function does too much: recognises decorators, removes decorators, recognises assignments, updates 'global' state.
function recogniseDecorators(line) {
  // TODO: does this function do too much? What does the function actually do, altogether?
  if (!line) return {};
  for (let keyword of config.decorators) {
    // QUESTION: this can only handle 1 decorator per line. Might not be true for complex contracts. // How does it deal with function parameter lists? (see end of fn).
    // TODO: need to also account for multi declarations which start with `(`
    if (line.startsWith(keyword)) {
      // decorator found
      let deDecLine = tidy(line.replace(`${keyword}`, '')); // remove the decorator syntax, and remove any resulting whitespace FIXME: we should really only replace the first instance of the keyword, given that the `if` block has only checked for that condition. Presumably this 'accidentally' removes all keywords from a line with lots of function parameters listed too? TODO: separate case for line.includes(keyword)?
      let type;
      let name;
      let rhs;
      if (recogniseGlobal(deDecLine)) {
        // extract the name of the global
        // QUESTION: this has all already been done within `recogniseGlobal`; why not return it and use it from there?
        type = 'global';
        [, , name] = deDecLine.replace(/ *\([^)]*\) */g, ' ').split(' '); // for mappings - TODO: don't redo the work of `recogniseGLobals` here; return what we need (seemingly just the name). Return a `null` from recogniseGlobal upon failure.
        if (name.includes('=') || name === '=') {
          [, name] = deDecLine.split(' ');
        }
        name = name.replace(';', '');
      } else if (recogniseFunction(deDecLine)) {
        ({ type, name } = recogniseFunction(deDecLine, true)); // FIXME repetition of function call. Return a `null` from recogniseFunction upon failure.
      } else if (recogniseAssignment(deDecLine)) {
        // FIXME: this doesn't serve the purpose of "recognising a decorator", so arguably doesn't belong here
        type = 'assignment';
        if (keyword === 'secret')
          logger.warn(`Warning: secret keyword used for assignment after declaration`); // QUESTION: what does this mean?
        for (const operator of operators) {
          if (line.includes(operator)) {
            [name, rhs] = deDecLine.split(operator).map(el => el.trim());
          }
        }
      }
      // below: attempts to capture two keywords e.g. secret known - may not be needed
      // REVIEW: this can be deleted, because `known`/`unknown` are only for decrementations, but `secret` is for declarations, and you can't declare and decrement in one go.
      if (recogniseDecorators(deDecLine).keyword) {
        keyword = [keyword].push(recogniseDecorators(deDecLine).keyword);
        deDecLine = recogniseDecorators(deDecLine).deDecLine;
      }
      // ^^^ TODO: remove block

      logger.debug(`Removed decorators from the line \n${line} \nto \n${deDecLine}`);
      return { keyword, type, name, rhs, deDecLine };
    }
    // TODO: tuple variable declarations
    if (line.includes(keyword)) {
      // if the function is secret, then all the params are secret, and that's a TODO
      // if the fn isn't secret, but the param(s) are then we do the below
      // QUESTION: we might not be in a function? Should this code live here?
      let deDecLine = tidy(line.replace(`${keyword}`, '')); // remove all instances of this keyword
      let type;
      let name;
      // we use line, not dedecline, because we may have more than one secret param
      if (recogniseParameters(line)) {
        // {fn, fn name}
        const { keywords, types, names, deDecLines } = recogniseParameters(line);
        keyword = keywords;
        type = types;
        name = names;
        deDecLine = deDecLines;
        return { keyword, type, name, deDecLine };
      }
    }
  }
  return {};
}

export default recogniseDecorators;
