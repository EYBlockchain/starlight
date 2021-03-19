// @UNUSED?
/**
process a function process end
*/
import { ParseError } from '../error/errors.mjs';
import { currentFunction, zokrates } from '../state.mjs';
import logger from '../utils/logger.mjs';

function processEndOfFunction() {
  logger.debug(`End of function ${currentFunction}`);
  if (!currentFunction.name)
    throw new ParseError(
      `Unexpected end of function block: only functions should be in the 'contract' scope`,
    );
  currentFunction.name = undefined;
  zokrates.src += `\nreturn`;
}

export default processEndOfFunction;
