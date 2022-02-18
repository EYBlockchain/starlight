import removeDecorators from './parse/removeDecorators.js';
import redecorate from './parse/redecorate.js';
import compile from './solc.mjs';

import checks from './transformers/checks.js';
// import ownership from './transformers/ownership.mjs';
// import toCircuit from './transformers/toCircuit.mjs';
// import toContract from './transformers/toContract.mjs';
// import toOrchestration from './transformers/toOrchestration.mjs';

const zappify = options => {
  // Error.stackTraceLimit = 0; // prettier error output TODO see if we can remove this in place of error/errors.mjs handling the limit
  // testing prettier errors
  process.on('uncaughtException', err => {
    console.log(err);
    process.exit(1);
  });

  const { deDecoratedFile, toRedecorate } = removeDecorators(options);

  const solAST = compile(deDecoratedFile, options);

  const zolAST = redecorate(solAST, toRedecorate, options);

  let path = checks(zolAST, options);
  //
  // path = ownership(path, options);
  //
  // if (options.isTest && options.testType === 'prelim') return path;
  //
  // toOrchestration(path, options);
  //
  // toCircuit(zolAST, options);
  //
  // toContract(zolAST, options);
  //
  // if (options.isTest) return path.scope.indicators;
  console.log(path);
  return zolAST;
};

export default zappify;
