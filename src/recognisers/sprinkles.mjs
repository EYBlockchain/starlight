/**
Simple recogniser to find global variables
*/

import config from 'config';
import logger from '../utils/logger.mjs';
import recogniseGlobal from './global.mjs';
import recogniseAssignment from './assignment.mjs';
import recogniseFunction from './function.mjs';

function tidy(_line) {
  // trim whitespace
  const line = _line.replace(/\s+/g, ' ').replace(/^\s/, '');
  // remove comments
  if (line.startsWith('//')) return null;
  return line;
}

function recogniseSprinkles(line, rtn = false) {
  if (!line) return false;
  logger.debug(line);
  for (const s of config.SPRINKLES) {
    if (line.startsWith(s)) {
      // sprinkle found
      const ln = tidy(line.replace(`${s}`, '')); // remove the sprinkled syntax
      let type;
      let name;
      if (recogniseGlobal(ln)) {
        type = 'global';
        [, , name] = ln.replace(/ *\([^)]*\) */g, ' ').split(' ');
        name = name.replace(';', '');
      } else if (recogniseFunction(ln)) {
        const res = recogniseFunction(ln, true);
        type = res.type;
        name = res.name;
      } else if (recogniseAssignment(ln)) {
        type = 'assignment';
        logger.info(`Warning: secret keyword used for assignment after declaration`);
        [name] = ln.split('=').map(el => el.trim());
      }
      if (rtn) {
        logger.info(`removed sprinkled syntax at ${ln}`);
        return { s, type, name, ln };
      }
      return true;
    }
  }
  return false;
}

export default recogniseSprinkles;
