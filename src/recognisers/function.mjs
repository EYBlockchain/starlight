/**
recognise a function definition
*/
import config from 'config';
import process from '../processors/function.mjs';
import logger from '../utils/logger.mjs';
import { ParseError } from '../error/errors.mjs';
import { blockCount } from '../state.mjs';

function recogniseFunction(line, rtn = false) {
  for (const g of config.functions) {
    if (line.startsWith(g)) {
      // function (or constructor) found

      // we don't support nested functions
      if (blockCount.value !== 2)
        throw new ParseError(
          `Nested functions or functions outside of a contract are not allowed: currently inside nested block ${blockCount.value}`,
        );

      const ln = line
        .slice(0, -1)
        .replace(/\(/g, ' (')
        .replace(/\)/g, ' )')
        .split(' ')
        .map(el => el.trim()); // space out parentheses and split on whitespace
      let rest = [];
      let type = '';
      [type, ...rest] = ln;
      let name;
      let visibility;
      // special case: constructors are unnamed so name them 'constructor'
      if (type === 'constructor') {
        name = 'constructor';
        visibility = 'private';
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
