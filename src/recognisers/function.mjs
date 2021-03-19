/**
recognise a function definition
*/
import config from 'config';
import process from '../processors/function.mjs';
import logger from '../utils/logger.mjs';
import { ParseError } from '../error/errors.mjs';
import { blockCount } from '../state.mjs';

function recogniseFunction(line, rtn = false) {
  for (const f of config.functionTypes) {
    if (line.startsWith(f)) {
      // TODO might need to change this when we introduce `anon` keyword to the start of such lines. Nevermind, by this point, the anon keyword will have been removed, and the line will indeed start with 'function' or etc.
      // function (or constructor) found

      if (blockCount.value === 1)
        throw new ParseError(
          `'Free' functions (declared outside of a contract) aren't yet supported`,
        );
      if (blockCount.value !== 2)
        throw new ParseError(
          `Nested functions or functions outside of a contract are not supported: currently inside nested block ${blockCount.value}`,
        );

      const ln = line
        .slice(0, -1) // rm "{"? QUESTION: why? TODO: if it's a function signature defined over multiple lines, it won't have a closing brace on the first line.
        .replace(/\(/g, ' ( ') // space out parentheses
        .replace(/\)/g, ' ) ') // space out parentheses
        .split(' ') // split on whitespace
        .map(el => el.trim()); // trim whitespace from both ends of each word/char
      let rest = [];
      let type = '';
      [type, ...rest] = ln;
      let name;
      let visibility;
      // special case: constructors are unnamed so name them 'constructor'
      if (type === 'constructor') {
        name = 'constructor';
        visibility = 'private'; // FIXME: shouldn't this just be inherited from the line we're reading? Not sure if constructors can actually have `private` visibility... QUESTION: why is the 'private' word needed when constructors don't need this word?
        logger.debug(`Found ${type}`);
      } else {
        [name, ...rest] = rest;
        visibility = rest[rest.indexOf(')') + 1]; // visibility comes after first closing bracket
        logger.debug(`Found ${type} ${name} with visibility ${visibility}`);
      }
      if (!rtn) {
        process({ type, visibility, name, rest });
        return true;
      }

      return { type, visibility, name, rest };
    }
  }
  return false;
}

export default recogniseFunction;
