import removeDecorators from './parse/removeDecorators.js';
import redecorate from './parse/redecorate.js';
import compile from './solc.js';

import checks from './transformers/checks.js';
import logger from './utils/logger.js';
import NodePath from './traverse/NodePath.js';
// import ownership from './transformers/ownership.mjs';
// import toCircuit from './transformers/toCircuit.mjs';
 import toContract from './transformers/toContract.js';
// import toOrchestration from './transformers/toOrchestration.mjs';

const zappify = (options: any) => {
  // Error.stackTraceLimit = 0; // prettier error output TODO see if we can remove this in place of error/errors.mjs handling the limit
  // testing prettier errors
  process.on('uncaughtException', err => {
    console.log(err);
    process.exit(1);
  });

  const { deDecoratedFile, toRedecorate } = removeDecorators(options);

  const solAST: object = compile(deDecoratedFile, options);

  const zolAST: object = redecorate(solAST, toRedecorate, options);

  let path: NodePath = checks(zolAST);
  //
  // path = ownership(path, options);
  //
  // if (options.isTest && options.testType === 'prelim') return path;
  //
  // toOrchestration(path, options);
  //
  // toCircuit(zolAST, options);
  //
   toContract(zolAST, options);
  //
  // if (options.isTest) return path.scope.indicators;
  console.log(path.node.nodes[1]);
  return zolAST;
};

export default zappify;
