/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../../utils/logger.mjs';
import { getNodeLocation, findReferencedDeclaration } from '../../../types/solidity-types.mjs';
import circuitTypes from '../../../types/circuit-types.mjs';
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
      if (!node.expression.isNullification) return;

      const lhsNode = node.expression.leftHandSide || node.expression.subExpression;
      let lhsIdentifier;
      let lhsbinding;
      let isMapping;
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

      switch (scope.callerRestriction) {
        case 'match':
          switch (ownerNode.nodeType) {
            case 'Identifier':
              if (lhsbinding.owner && lhsbinding.owner.name !== ownerNode.name)
                throw new Error(
                  `Found two distinct owners of one state: ${lhsbinding.owner.name} and ${ownerNode.name}`,
                );
              lhsbinding.owner = scope.getReferencedBinding(ownerNode);
              lhsbinding.owned = true;
              break;
            case 'Literal':
              if (lhsbinding.owner && lhsbinding.owner.value !== ownerNode.value)
                throw new Error(
                  `Found two distinct owners of one state: ${lhsbinding.owner.value} and ${ownerNode.value}`,
                );
              lhsbinding.owner = ownerNode;
              lhsbinding.owned = true;
              break;
            default:
              break;
          }
          break;
        case 'notMatch':
          lhsbinding.notOwner = blacklistedNode;
          break;
        default:
          // look for msg.sender
          // 1st case - mapping w/ msg.sender key
          if (!isMapping) break;
          if (
            !lhsbinding.referencedKeyNodeType.includes('address') &&
            !lhsbinding.referencedKeyNodeType.includes('magic')
          )
            break;
          if (lhsbinding.referencedKeyisParam === 'msg') {
            let msgSenderEverywhere = true;
            for (const nullPath of lhsbinding.nullifyingPaths) {
              // skip current node
              if (nullPath.node.id === node.id) continue;
              // break out if we find a key =/= msg.sender
              if (
                nullPath.node.expression.leftHandSide.leftExpression.indexExpression.expression
                  .name !== 'msg'
              ) {
                msgSenderEverywhere = false;
                break;
              }
            }
            if (!msgSenderEverywhere) break;
            if (lhsbinding.owner && lhsbinding.owner.name !== 'msg')
              throw new Error(
                `Found two distinct owners of one state: ${lhsbinding.owner.name} and msg.sender`,
              );
            lhsbinding.owner = lhsNode.indexExpression.expression;
            lhsbinding.owned = true;
            scope.getReferencedBinding(lhsIdentifier).owner = lhsNode.indexExpression.expression;
            scope.getReferencedBinding(lhsIdentifier).owned = true;
          }
          break;
      }
      console.log(scope.getReferencedBinding(lhsIdentifier));
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
