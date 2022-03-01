/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../utils/logger.js';
//import circuitTypes from '../../types/zokrates-types.js';
import { traverse, traverseNodesFast } from '../../traverse/traverse.js';
import NodePath from '../../traverse/NodePath.js';

/**
 * @desc:
 * TEMPLATE - for easy copy-pasting to start building a new visitor.
*/

export default {
  SourceUnit: {
    enter(path: NodePath, state: any) {},

    exit(path: NodePath, state: any) {},
  },

  PragmaDirective: {
    enter(path: NodePath, state: any) {},
    exit(path: NodePath, state: any) {},
  },

  ContractDefinition: {
    enter(path: NodePath, state: any) {},

    exit(path: NodePath, state: any) {},
  },

  FunctionDefinition: {
    enter(path: NodePath, state: any) {},

    exit(path: NodePath, state: any) {},
  },

  ParameterList: {
    enter(path: NodePath) {},

    exit(path: NodePath) {},
  },

  Block: {
    enter(path: NodePath) {},

    exit(path: NodePath) {},
  },

  VariableDeclarationStatement: {
    enter(path: NodePath) {},

    exit(path: NodePath) {},
  },

  BinaryOperation: {
    enter(path: NodePath) {},

    exit(path: NodePath) {},
  },

  Assignment: {
    enter(path: NodePath, state: any) {},

    exit(path: NodePath, state: any) {},
  },

  ExpressionStatement: {
    enter(path, state) {},

    exit(node: any, parent:any) {},
  },

  VariableDeclaration: {
    enter(path: NodePath, state: any) {},

    exit(path: NodePath) {},
  },

  ElementaryTypeName: {
    enter(path: NodePath) {},

    exit(path: NodePath) {},
  },

  Identifier: {
    enter(path: NodePath) {},

    exit(path: NodePath) {},
  },

  Literal: {
    enter(path: NodePath) {},

    exit(path: NodePath) {},
  },
};
