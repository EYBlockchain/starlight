/* eslint-disable no-param-reassign, no-continue */

import fs from 'fs';
import {
  traverseNodesFast,
  traverseNodesFastVisitor,
} from '../traverse/traverse.mjs';
import logger from '../utils/logger.mjs';
import { SyntaxTypeError, SyntaxError } from '../error/errors.mjs';
import explode from '../transformers/visitors/explode.mjs';
import redecorateVisitor from '../transformers/visitors/redecorateVisitor.mjs';

const errorCheckVisitor = (thisPath, decoratorObj) => {
  // extract the char number
  const srcStart = thisPath.node.src.split(':')[0];
  // if it matches the one we removed, throw error
  if (decoratorObj.charStart === Number(srcStart)) {
    throw new SyntaxTypeError(thisPath.node, decoratorObj.decorator);
  }
};

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

function transformation1(oldAST, toRedecorate) {
  // HACK: ordinarily the 2nd parameter `state` is an object. toRedecorate is an array (special kind of object). Not ideal, but it works.
  traverseNodesFastVisitor(oldAST, explode(redecorateVisitor), toRedecorate);

  // we check for decorators we couldn't re-add
  for (const decorator of toRedecorate) {
    if (decorator.added) continue;
    traverseNodesFast(oldAST, errorCheckVisitor, decorator);
    throw new SyntaxError(
      `We couldn't find where ${decorator.decorator} should be re-added (char number ${decorator.charStart}). Do all decorators precede a variable name?`,
    );
  }
  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return oldAST;
}

// A transformer function which will accept an ast.
export default function redecorate(ast, toRedecorate, options) {
  logger.verbose(`Creating decorated ast... `);
  const newAST = transformation1(ast, toRedecorate);

  const zolASTFilePath = `${options.parseDirPath}/${options.inputFileName}.zol_ast.json`;
  fs.writeFileSync(zolASTFilePath, JSON.stringify(newAST, null, 4));
  return JSON.parse(JSON.stringify(newAST, null, 4));
}
