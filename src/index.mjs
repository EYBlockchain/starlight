import removeDecorators from './parse/removeDecorators.mjs';
import redecorate from './parse/redecorate.mjs';
import compile from './solc.mjs';

import checks from './transformers/checks.mjs';
import ownership from './transformers/ownership.mjs';
import toCircuit from './transformers/toCircuit.mjs';
import toContract from './transformers/toContract.mjs';
import toOrchestration from './transformers/toOrchestration.mjs';

const zappify = options => {
  Error.stackTraceLimit = 0; // prettier error output

  const { deDecoratedFile, toRedecorate } = removeDecorators(options);

  const solAST = compile(deDecoratedFile, options);

  const zolAST = redecorate(solAST, toRedecorate, options);

  let path = checks(zolAST, options);

  path = ownership(path, options);

  if (options.isTest && options.testType === 'prelim') return path;

  toOrchestration(path, options);

  toCircuit(zolAST, options);

  toContract(zolAST, options);

  if (options.isTest) return path.scope.indicators;

  return path;
};

export default zappify;
