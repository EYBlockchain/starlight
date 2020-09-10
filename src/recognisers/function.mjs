/**
recognise a function definition
*/
import config from 'config';

function recogniseFunction(line) {
  for (const g of config.FUNCTIONS) {
    if (line.startsWith(g)) {
      // function (or constructor) found
      const ln = line
        .slice(0, -1)
        .replace(/\(/g, ' (')
        .replace(/\)/g, ' )')
        .split(' ')
        .map(el => el.trim()); // space out parentheses and split in whitespace
      const [type, name, ...rest] = ln;
      if (type === 'constructor') {
        // special case: constructors are unnamed so name them 'constructor'
        const unrest = [name, ...rest];
        return { type, name: '', rest: unrest };
      }
      return { type, name, rest };
    }
  }
  return false;
}

export default recogniseFunction;
