/**
process a function process end
*/
import CompilerError from '../utils/compiler-error.mjs';
import { currentFunction, zokrates } from '../state.mjs';
import logger from '../utils/logger.mjs';

function processEndOfFunction() {
  logger.info(`End of function ${currentFunction}`);
  if (!currentFunction.name)
    throw new CompilerError(
      `Unexpected end of function block: only functions should be in the 'contract' scope`,
    );
  currentFunction.name = undefined;
  zokrates.src += `\nreturn`;
}

export default processEndOfFunction;
