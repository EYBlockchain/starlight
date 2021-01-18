import recogniseGlobal from './global.mjs';
import recogniseAssignment from './assignment.mjs';
import recogniseFunction from './function.mjs';
import recogniseCurlyBracket from './curly-bracket.mjs';
import recogniseDecorators from './decorators.mjs';

export default {
  recogniseGlobal,
  recogniseAssignment,
  recogniseFunction,
  recogniseCurlyBracket,
  recogniseDecorators,
};
