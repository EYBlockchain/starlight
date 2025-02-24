import removeDecorators from './parse/removeDecorators.js';
import redecorate from './parse/redecorate.js';
import compile from './solc.js';

import checks from './transformers/checks.js';
import ownership from './transformers/ownership.js';
import toCircuit from './transformers/toCircuit.js';
import toContract from './transformers/toContract.js';
import toOrchestration from './transformers/toOrchestration.js';

const zappify = (options: any) => {

  process.on('uncaughtException', err => {
    console.log(err);
    process.exit(1);
  });

  const { deDecoratedFile, toRedecorate } = removeDecorators(options);

  const solAST = compile(deDecoratedFile, options);

  const zolAST = redecorate(solAST, toRedecorate, options);
  const lastSlashIndex = options.inputFilePath.lastIndexOf('/');
  const uuidsub = options.inputFilePath.substring(0, lastSlashIndex);
  const uuidzapp = options.inputFilePath.substring(lastSlashIndex + 1);
  zolAST.nodes[1].uuidsub = uuidsub;
  zolAST.nodes[1].uuidzapp = uuidzapp;
;
  let path = checks(zolAST);

  path = ownership(path, options);

  options.circuitAST = toCircuit(zolAST, options);

  toOrchestration(path, options);

  toContract(zolAST, options);

  return zolAST;
};

export default zappify;
