import logger from '../utils/logger.js';
import explode from './visitors/explode.js';
import ownershipVisitor from './visitors/ownership/ownershipVisitor.js';
import errorChecksVisitor from './visitors/ownership/errorChecksVisitor.js';

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

function transformation1(ast: any) {
  const state = {
    stopTraversal: false,
    skipSubNodes: false,
  };

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  ast.traverse(explode(ownershipVisitor), state);
  logger.verbose('Performing final error checks on the zol AST...');
  ast.traverse(explode(errorChecksVisitor), state);

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return ast;
}

// A transformer function which will accept an ast.
export default function ownership(astPath: any) {
  logger.verbose('Performing ownership checks on the zol AST...');
  const updatedASTPath = transformation1(astPath);
  logger.verbose('Owners assigned.');
  return updatedASTPath;
}
