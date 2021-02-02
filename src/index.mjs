import removeDecorators from './parse/removeDecorators.mjs';
import redecorate from './parse/redecorate.mjs';
import compile from './solc.mjs';

import checks from './transformers/checks.mjs';
import ownership from './transformers/ownership.mjs';
import toCircuit from './transformers/toCircuit.mjs';
import toContract from './transformers/toContract.mjs';
import toOrchestration from './transformers/toOrchestration.mjs';

// Original funtion before listr - might choose to revert back to this simple function.
const zappify = options => {
  const { deDecoratedFile, toRedecorate } = removeDecorators(options);

  const solAST = compile(deDecoratedFile, options);

  const zsolAST = redecorate(solAST, toRedecorate, options);

  let path = checks(zsolAST, options);

  path = ownership(path, options);

  if (options.isTest && options.testType === 'prelim') return path;

  // toOrchestration(zsolAST, options);
  //
  toCircuit(zsolAST, options);
  //
  // toContract(zsolAST, options);

  if (options.isTest) return path.scope.indicators;

  return path;
};

export default zappify;
