/* eslint-disable no-param-reassign */

import NodePath from '../traverse/NodePath.mjs';
import { traverseNodesFastVisitor } from '../traverse/traverse.mjs';
import logger from '../utils/logger.mjs';
import explode from './visitors/explode.mjs';
import unsupportedVisitor from './visitors/checks/unsupportedVisitor.mjs';
import externalCallVisitor from './visitors/checks/externalCallVisitor.mjs';
import decoratorVisitor from './visitors/checks/decoratorVisitor.mjs';
import incrementedVisitor from './visitors/checks/incrementedVisitor.mjs';
import accessedVisitor from './visitors/checks/accessedVisitor.mjs';
import requireStatementVisitor from './visitors/checks/requireStatementVisitor.mjs';
import localDeclarationsVisitor from './visitors/checks/localDeclarationsVisitor.mjs';
import msgSenderParam from './visitors/checks/msgSenderParam.mjs';
import interactsWithSecretVisitor from './visitors/checks/interactsWithSecretVisitor.mjs';

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

function transformation1(oldAST) {
  const state = {
    stopTraversal: false,
    skipSubNodes: false,
  };

  // TODO move this back into path traversals
  // it's here to catch the internal calls error which scope can't handle right now
  traverseNodesFastVisitor(oldAST, explode(unsupportedVisitor), state);
  logger.verbose('No unsupported Solidity');

  const newAST = {
    nodeType: 'Folder',
    files: [],
  };

  oldAST._newASTPointer = newAST.files;
  const dummyParent = {
    ast: oldAST,
  };
  dummyParent._newASTPointer = newAST;

  const path = new NodePath({
    parent: dummyParent,
    key: 'ast', // since parent.ast = node
    container: oldAST,
    node: oldAST,
  });

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  path.traverse(explode(externalCallVisitor), state);
  logger.verbose('No unsupported external calls');
  path.traverse(explode(decoratorVisitor), state);
  logger.verbose('No conflicting known/unknown decorators');
  path.traverse(explode(interactsWithSecretVisitor), state);
  logger.verbose('Secret interacts marked');
  path.traverse(explode(incrementedVisitor), state);
  logger.verbose('Incrementations marked');
  path.traverse(explode(accessedVisitor), state);
  logger.verbose('Accessed values marked');
  path.traverse(explode(requireStatementVisitor), state);
  logger.verbose('Require statements labelled public / private');
  path.traverse(explode(localDeclarationsVisitor), state);
  logger.verbose('Checked for unsupported local variable declarations');
  path.traverse(explode(msgSenderParam), state);

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return path;
}

// A transformer function which will accept an ast.
export default function checks(ast) {
  logger.verbose('Performing checks on the zol AST...');
  const path = transformation1(ast);
  logger.verbose('Checks complete.');
  return path;
}
