import Listr from 'listr';
import removeDecorators from './removeDecorators.mjs';
import redecorate from './redecorate.mjs';
import compile from './solc.mjs';

import checks from './transformers/checks.mjs';
import ownership from './transformers/ownership.mjs';
import toCircuit from './transformers/toCircuit.mjs';
import toContract from './transformers/toContract.mjs';
import toOrchestration from './transformers/toOrchestration.mjs';
import logger from './utils/logger.mjs';

// Original funtion before listr - might choose to revert back to this simple function.
const zappify = options => {
  const { deDecFile, toRedecorate } = removeDecorators(options);

  const solAST = compile(deDecFile, options);

  const zsolAST = redecorate(solAST, toRedecorate, options);

  const path = checks(zsolAST, options);

  ownership(path, options);

  if (options.isTest) return path.scope.indicators;

  return path;

  // toOrchestration(zsolAST, options);
  //
  // toCircuit(zsolAST, options);
  //
  // toContract(zsolAST, options);
};

// const tasks = new Listr([
//   {
//     title: '.zsol => .sol',
//     task: ctx => {
//       const { options } = ctx;
//       const { desprinkledFile, toResprinkle } = desprinkle(options);
//       ctx.desprinkledFile = desprinkledFile;
//       ctx.toResprinkle = toResprinkle;
//     },
//   },
//   {
//     title: '.sol => .sol AST',
//     task: ctx => {
//       const { desprinkledFile, options } = ctx;
//       const solAST = compile(desprinkledFile, options);
//       ctx.solAST = solAST;
//     },
//   },
//   {
//     title: '.sol AST => .zsol AST',
//     task: ctx => {
//       const { solAST, toResprinkle, options } = ctx;
//       const zsolAST = resprinkle(solAST, toResprinkle, options);
//       ctx.zsolAST = zsolAST;
//     },
//   },
//   {
//     title: '.zsol AST => circuit AST => .zok files',
//     task: ctx => {
//       const { zsolAST, options } = ctx;
//       toCircuit(zsolAST, options);
//     },
//   },
// ]);

// const zappify = options => {
//   const ctx = { options };
//   tasks.run(ctx).catch(err => {
//     throw new Error(err);
//   });
// };

export default zappify;
