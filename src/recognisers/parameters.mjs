/**
recognise a function definition
*/
import config from 'config';
import process from '../processors/function.mjs';
import logger from '../utils/logger.mjs';
import { ParseError } from '../utils/errors.mjs';
import { blockCount } from '../state.mjs';

function recogniseParameters(line) {
  if (line.startsWith('function')) {
    // function found

    // we don't support nested functions
    if (blockCount.value !== 2)
      throw new ParseError(
        `Nested functions or functions outside of a contract are not allowed: currently inside nested block ${blockCount.value}`,
      );

    // const ln = line
    //   .slice(0, -1)
    //   .replace(/\(/g, ' ( ')
    //   .replace(/\)/g, ' )')
    //   .split(' ')
    //   .map(el => el.trim()); // space out parentheses and split on whitespace

    let params = line.match(/\((.*?)\)/)[1];
    params = params.split(',');

    const keywords = [];
    const types = [];
    const names = [];
    const deDecLines = [];

    for (const keyword of config.decorators) {
      params.forEach(param => {
        if (param.includes(keyword)) {
          if (keyword !== 'secret') throw new Error(`Parameters cannot be known/unknown`);
          const deDecLine = param.replace(keyword, '');
          const ln = deDecLine.split(' ');
          const name = ln[ln.length - 1];
          keywords.push(keyword);
          types.push('param');
          names.push(name);
          deDecLines.push(deDecLine);
        }
      });
    }

    return { keywords, types, names, deDecLines };
  }
  return false;
}

export default recogniseParameters;
