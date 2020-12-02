/**
Simple recogniser to find global variables
*/

import config from 'config';
import logger from '../utils/logger.mjs';
import recogniseGlobal from './global.mjs';
import recogniseAssignment from './assignment.mjs';
import recogniseFunction from './function.mjs';
import recogniseParameters from './parameters.mjs';

const operators = [' = ', '+= ', '-= '];

function tidy(_line) {
  // trim whitespace
  const line = _line.replace(/\s+/g, ' ').replace(/^\s/, '');
  // remove comments
  if (line.startsWith('//')) return null;
  return line;
}

function recogniseDecorators(line) {
  if (!line) return false;
  for (let keyword of config.decorators) {
    // TODO: this can only handle 1 decorator per line. Might not be true for complex contracts.
    if (line.startsWith(keyword)) {
      // decorator found
      let deDecLine = tidy(line.replace(`${keyword}`, '')); // remove the decorator syntax
      let type;
      let name;
      let rhs;
      if (recogniseGlobal(deDecLine)) {
        type = 'global';
        [, , name] = deDecLine.replace(/ *\([^)]*\) */g, ' ').split(' ');
        name = name.replace(';', '');
      } else if (recogniseFunction(deDecLine)) {
        ({ type, name } = recogniseFunction(deDecLine, true));
      } else if (recogniseAssignment(deDecLine)) {
        type = 'assignment';
        if (keyword === 'secret')
          logger.info(`Warning: secret keyword used for assignment after declaration`);
        for (const operator of operators) {
          if (line.includes(operator)) {
            [name, rhs] = deDecLine.split(operator).map(el => el.trim());
          }
        }
      }
      // below: attempts to capture two keywords e.g. secret known - may not be needed
      if (recogniseDecorators(deDecLine).keyword) {
        keyword = [keyword].push(recogniseDecorators(deDecLine).keyword);
        deDecLine = recogniseDecorators(deDecLine).deDecLine;
      }
      logger.info(`Removed decorators from the line \n${line} \nto \n${deDecLine}`);
      return { keyword, type, name, rhs, deDecLine };
    }
    if (line.includes(keyword)) {
      // if the function is secret, then all the params are secret, and that's a TODO
      // if the fn isn't secret, but the param(s) are then we do the below
      let deDecLine = tidy(line.replace(`${keyword}`, '')); // remove the sprinkled syntax
      let type;
      let name;
      let rhs;
      // we use line, not dedecline, because we may have more than one secret param
      if (recogniseParameters(line)) {
        // {fn, fn name}
        const { keywords, types, names, deDecLines } = recogniseParameters(line);
        keyword = keywords;
        type = types;
        name = names;
        deDecLine = deDecLines;
        return { keyword, type, name, rhs, deDecLine };
      }
    }
  }
  return {};
}

export default recogniseDecorators;