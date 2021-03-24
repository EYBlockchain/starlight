/* eslint-disable no-param-reassign */

import fs from 'fs';
import NodePath from '../traverse/NodePath.mjs';
import logger from '../utils/logger.mjs';
import backtrace from '../error/backtrace.mjs';
import explode from '../transformers/visitors/explode.mjs';
import redecorateVisitor from '../transformers/visitors/redecorateVisitor.mjs';

const errorCheckVisitor = (thisPath, decoratorObj) => {
  // extract the char number
  const srcStart = thisPath.node.src.split(':')[0];
  // if it matches the one we removed, add it back to the AST
  if (decoratorObj.charStart === Number(srcStart)) {
    backtrace.getSourceCode(thisPath.node.src);
    throw new SyntaxError(
      `Decorator '${decoratorObj.decorator}' cannot be added to node of type '${thisPath.node.nodeType}'.`,
    );
  }
};

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

function transformation1(oldAST, toRedecorate) {
  const dummyParent = {
    ast: oldAST,
  };

  const path = new NodePath({
    parent: dummyParent,
    key: 'ast', // since parent.ast = node
    container: oldAST,
    node: oldAST,
  });

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  // NB: ordinarily the 2nd parameter `state` is an object. toRedecorate is an array (special kind of object). Not ideal, but it works.
  path.traverse(explode(redecorateVisitor), toRedecorate);

  for (const decorator of toRedecorate) {
    if (decorator.added) continue;
    path.traversePathsFast(errorCheckVisitor, decorator);
  }
  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return path;
}

// A transformer function which will accept an ast.
export default function redecorate(ast, toRedecorate, options) {
  logger.verbose(`Creating decorated ast... `);
  const newAST = transformation1(ast, toRedecorate);

  const zolASTFilePath = `${options.parseDirPath}/${options.inputFileName}.zol_ast.json`;
  fs.writeFileSync(zolASTFilePath, JSON.stringify(newAST.node, null, 4));
  return JSON.parse(JSON.stringify(newAST.node, null, 4));
}
