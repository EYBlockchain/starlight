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

function recogniseSprinkles(line) {
  if (!line) return false;
  for (let keyword of config.sprinkles) {
    // TODO: this can only handle 1 decorator per line. Might not be true for complex contracts.
    if (line.startsWith(keyword)) {
      // sprinkle found
      let desprinkledLine = tidy(line.replace(`${keyword}`, '')); // remove the sprinkled syntax
      let type;
      let name;
      let rhs;
      if (recogniseGlobal(desprinkledLine)) {
        type = 'global';
        [, , name] = desprinkledLine.replace(/ *\([^)]*\) */g, ' ').split(' ');
        name = name.replace(';', '');
      } else if (recogniseFunction(desprinkledLine)) {
        ({ type, name } = recogniseFunction(desprinkledLine, true));
      } else if (recogniseAssignment(desprinkledLine)) {
        type = 'assignment';
        if (keyword === 'secret')
          logger.info(`Warning: secret keyword used for assignment after declaration`);
        [name, rhs] = desprinkledLine.split('=').map(el => el.trim());
      }
      // below: attempts to capture two keywords e.g. secret known - may not be needed
      if (recogniseSprinkles(desprinkledLine).keyword) {
        keyword = [keyword].push(recogniseSprinkles(desprinkledLine).keyword);
        desprinkledLine = recogniseSprinkles(desprinkledLine).desprinkledFile;
      }
      logger.info(`Desprinkled the line \n${line} \nto \n${desprinkledLine}`);
      return { keyword, type, name, rhs, desprinkledLine };
    }
  }
  return {};
}

export default recogniseSprinkles;
