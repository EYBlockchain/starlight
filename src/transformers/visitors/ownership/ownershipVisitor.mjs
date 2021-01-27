/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../../utils/logger.mjs';
import { traverse, traverseNodesFast, traversePathsFast } from '../../../traverse/traverse.mjs';

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

    exit(path, state) {
      Object.keys(path.scope.bindings).forEach(id => {
        const binding = path.scope.bindings[id];
        if (binding.isSecret && !binding.isOwned) {
          logger.warn(
            `Warning: secret state ${binding.name} is not owned. Without an owner, the state is initialised by the first caller submitting a dummy nullifier. This reveals when the state is initialised.`,
          );
        }
      });
    },
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
    enter(path, state) {},

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

    exit(path, state) {
      const { node, scope, parentPath } = path;

      // not a nullification - then we dont care about this statement for ownerahip
      if (!node.expression.isNullification) return;

      const lhsNode = node.expression.leftHandSide || node.expression.subExpression;
      let lhsIdentifier;
      let lhsbinding;
      let isMapping;

      // below - get lhs info
      if (lhsNode.nodeType === 'Identifier') {
        lhsIdentifier = lhsNode;
        lhsbinding = scope.getReferencedBinding(lhsIdentifier);
        isMapping = false;
      } else if (lhsNode.nodeType === 'IndexAccess') {
        isMapping = true;
        lhsIdentifier = lhsNode.baseExpression;
        const keyName = scope.getMappingKeyIndicator(lhsNode);
        lhsbinding = scope.getReferencedBinding(lhsIdentifier).mappingKey[keyName];
      }

      const lhsSecret = !!lhsbinding.isSecret;
      if (!lhsSecret) return;

      const functionDefScope = scope.getAncestorOfScopeType('FunctionDefinition');

      const ownerNode = scope.callerRestrictionNode;
      let blacklistedNode;

      // look for any caller restriction in this function; if there is any, then this state can only be nullified by that owner
      switch (scope.callerRestriction) {
        case 'match':
          switch (ownerNode.nodeType) {
            case 'Identifier':
              if (lhsbinding.owner && lhsbinding.owner.name !== ownerNode.name)
                throw new Error(
                  `Found two distinct owners of one state: ${lhsbinding.owner.name} and ${ownerNode.name}`,
                );
              lhsbinding.owner = scope.getReferencedBinding(ownerNode);
              lhsbinding.isOwned = true;
              logger.debug(`The owner of state ${lhsbinding.name} is ${ownerNode.name}`);
              scope.indicators[lhsIdentifier.referencedDeclaration].isOwned = true;
              break;
            case 'Literal':
              if (lhsbinding.owner && lhsbinding.owner.value !== ownerNode.value)
                throw new Error(
                  `Found two distinct owners of one state: ${lhsbinding.owner.value} and ${ownerNode.value}`,
                );
              lhsbinding.owner = ownerNode;
              lhsbinding.isOwned = true;
              logger.debug(`The owner of state ${lhsbinding.name} is ${ownerNode.name}`);
              break;
            default:
              break;
          }
          break;
        case 'notMatch':
          // if we have msg.sender =/= someone, they are added to a notOwner indicator for later
          lhsbinding.notOwner = blacklistedNode;
          break;
        default:
          // look for msg.sender (mapping w/ msg.sender key)
          if (!isMapping) break;
          // if the mapping key node type isn't an address which is of type t_magic_message, we skip
          if (
            !lhsbinding.referencedKeyNodeType.includes('address') &&
            !lhsbinding.referencedKeyNodeType.includes('magic')
          )
            break;
          // if the mapping key for THIS identifier is msg.sender...
          if (lhsbinding.referencedKeyisMsg) {
            let msgSenderEverywhere = true;
            // we look through each nullifying path of this mapping[msg.sender]
            for (const nullPath of lhsbinding.nullifyingPaths) {
              // skip current node
              if (nullPath.parentPath.parentPath.node.id === node.id) continue;
              // break out if we find a key =/= msg.sender
              if (
                (nullPath.parent.leftExpression &&
                  nullPath.parent.leftExpression.indexExpression.expression.name !== 'msg') ||
                (nullPath.parent.indexExpression &&
                  nullPath.parent.indexExpression.expression.name !== 'msg')
              ) {
                msgSenderEverywhere = false;
                break;
              }
            }
            if (!msgSenderEverywhere) break;
            // here: all nullifying paths have msg.sender as mapping key
            // below error: if msgSenderEverywhere BUT we also have an admin restriction
            if (lhsbinding.owner && lhsbinding.owner.name !== 'msg')
              throw new Error(
                `Found two distinct owners of one state: ${lhsbinding.owner.name} and msg.sender`,
              );
            logger.debug(
              `The owner of state ${lhsNode.baseExpression.name}[${lhsNode.indexExpression.expression.name}] is ${lhsNode.indexExpression.expression.name}`,
            );
            lhsbinding.owner = lhsNode.indexExpression.expression;
            lhsbinding.isOwned = true;
            scope.getReferencedBinding(lhsIdentifier).owner = lhsNode.indexExpression.expression;
            scope.getReferencedBinding(lhsIdentifier).isOwned = true;
            scope.indicators[lhsIdentifier.referencedDeclaration].isOwned = true;
          }
          break;
      }
      // if we have an owner which is an eth address, we need a way to convert from addresses to zkp public keys:
      if (
        lhsbinding.owner.name === 'msg' ||
        lhsbinding.owner.node.typeDescriptions.typeIdentifier.includes('address')
      )
        scope.onChainKeyRegistry = true;
      // logger.debug(scope.getReferencedBinding(lhsIdentifier));
      // logger.debug('------');
      // logger.debug(scope.indicators[lhsIdentifier.referencedDeclaration]);
    },
  },

  VariableDeclaration: {
    enter(path, state) {},

    exit(path) {},
  },

  ElementaryTypeName: {
    enter(path) {},

    exit(path) {},
  },

  Identifier: {
    enter(path) {},

    exit(path) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
