/* eslint-disable no-param-reassign */

import fs from 'fs';
import NodePath from './traverse/NodePath.mjs';
import logger from './utils/logger.mjs';
import explode from './transformers/visitors/explode.mjs';
import redecorateVisitor from './transformers/visitors/redecorateVisitor.mjs';

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
  path.traverse(explode(redecorateVisitor), toRedecorate);
  console.log(toRedecorate);
  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return path;
}

// A transformer function which will accept an ast.
export default function redecorate(ast, toRedecorate, options) {
  logger.info(`Creating decorated ast... `);
  const newAST = transformation1(ast, toRedecorate);

  const zsolASTFilePath = `${options.parseDirPath}/${options.inputFileName}.zsol_ast.json`;
  fs.writeFileSync(zsolASTFilePath, JSON.stringify(newAST.node, null, 4));
  return JSON.parse(JSON.stringify(newAST.node, null, 4));
}
