import Listr from 'listr';
import desprinkle from './desprinkler.mjs';
import resprinkle from './resprinkler.mjs';
import compile from './solc.mjs';

import toCircuit from './transformers/toCircuit.mjs';
import toContract from './transformers/toContract.mjs';
import toOrchestration from './transformers/toOrchestration.mjs';
import logger from './utils/logger.mjs';

// Original funtion before listr - might choose to revert back to this simple function.
const zappify = options => {
  const { desprinkledFile, toResprinkle } = desprinkle(options);

  const solAST = compile(desprinkledFile, options);

  const zsolAST = resprinkle(solAST, toResprinkle, options);

  toOrchestration(zsolAST, options);

  toCircuit(zsolAST, options);

  toContract(zsolAST, options);
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
