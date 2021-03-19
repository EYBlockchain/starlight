/**
recognise a function definition
*/
import config from 'config';
import logger from '../utils/logger.mjs';
import { ParseError } from '../error/errors.mjs';
import { blockCount } from '../state.mjs';

function recogniseParameters(line) {
  if (line.startsWith('function')) {
    // function found
    // TODO: constructor() / receive() / fallback() ?

    // we don't support nested functions
    // TODO: also catch 'free' functions
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

    let params = line.match(/\((.*?)\)/)[1]; // match everything within 1st set of brackets ([1] excludes the brackets themselves)
    params = params.split(',');

    const keywords = [];
    const types = [];
    const names = [];
    const deDecLines = [];

    for (const keyword of config.decorators) {
      // TODO: don't need to cycle through all keywords: we only care about 'secret'; although we do need to catch errors for badly placed zol keywords... so maybe this is fine.
      // TODO: multi-line parameter lists!!!
      params.forEach(param => {
        if (param.includes(keyword)) {
          if (keyword !== 'secret') throw new Error(`Parameters cannot be known/unknown`);
          const deDecLine = param.replace(keyword, '');
          const ln = deDecLine.split(' ');
          const name = ln[ln.length - 1]; // name is always the last item per parameter
          keywords.push(keyword); // TODO: always secret?
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
