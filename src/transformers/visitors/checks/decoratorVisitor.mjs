/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../../utils/logger.mjs';

export default {
  SourceUnit: {
    enter(path, state) {},

    exit(path, state) {},
  },

  PragmaDirective: {
    enter(path, state) {},
    exit(path, state) {},
  },

  ContractDefinition: {
    enter(path, state) {},

    exit(path, state) {},
  },

  FunctionDefinition: {
    enter(path, state) {},

    exit(path, state) {},
  },

  ParameterList: {
    enter(path) {},

    exit(path) {},
  },

  Block: {
    enter(path) {},

    exit(path) {},
  },

  VariableDeclarationStatement: {
    enter(path) {},

    exit(path) {},
  },

  BinaryOperation: {
    enter(path) {},

    exit(path) {},
  },

  Assignment: {
    enter(path, state) {},

    exit(path, state) {},
  },

  ExpressionStatement: {
    enter(path, state) {},

    exit(node, parent) {},
  },

  VariableDeclaration: {
    enter(path, state) {},

    exit(path, state) {},
  },

  ElementaryTypeName: {
    enter(path) {},

    exit(path) {},
  },

  IndexAccess: {
    enter(path, state) {
      const { node, parent } = path;
      if (node.isUnknown) node.baseExpression.isUnknown = true;
      if (node.isKnown) node.baseExpression.isKnown = true;
    },

    exit(node, parent) {},
  },

  Identifier: {
    enter(path, state) {},

    exit(path, state) {
      const { node, scope, parent } = path;
      if (path.isMsg()) return; // the node represents the special 'msg' type in solidity
      const varDec =
        path.parentPath.node.nodeType !== 'MemberAccess'
          ? scope.getReferencedBinding(node)
          : scope.getReferencedBinding(path.parentPath.parentPath.node.baseExpression);

      if (varDec.stateVariable) {
        // node is decorated
        if (!varDec.isSecret && node.isUnknown)
          throw new Error(`Identifier ${node.name} is marked as unknown but is not secret.`);
        if (!varDec.isSecret && node.isKnown)
          logger.warn(
            `PEDANTIC: Superfluous 'known' decorator. A conventional smart contract state variable (${node.name}) is 'known' by its very nature.`,
          );
        let refPaths;
        if (varDec.mappingKey) {
          refPaths = [];
          Object.keys(varDec.mappingKey).forEach(key => {
            varDec.mappingKey[key].referencingPaths.forEach(referencingPath => {
              refPaths.push(referencingPath);
            });
          });
        } else {
          refPaths = varDec.referencingPaths;
        }
        refPaths.forEach(path => {
          if ((path.node.isKnown && node.isUnknown) || (path.node.isUnknown && node.isKnown))
            throw new Error(`Identifier ${node.name} is marked as unknown and known.`);
        });
        if (node.isKnown) varDec.isKnown = node.isKnown;
        if (node.isUnknown) varDec.isUnknown = node.isUnknown;
      } else if (varDec.secretVariable && path.getAncestorContainedWithin('leftHandSide')) {
        // we have a parameter (at least, for now a secret non state var is a param)
        throw new Error(`Cannot reassign secret function parameter ${node.name}.`);
      }
    },
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
