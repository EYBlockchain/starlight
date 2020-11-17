/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';

export default {
  StructuredDocumentation: {
    enter(path, state, scope) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state, scope) {},
  },

  InlineAssembly: {
    enter(path, state, scope) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state, scope) {},
  },

  EnumDefinition: {
    // we can work on this later
    enter(path, state, scope) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state, scope) {},
  },

  StructDefinition: {
    enter(path, state, scope) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state, scope) {},
  },

  SourceUnit: {
    enter(path, state, scope) {},

    exit(path, state, scope) {},
  },

  PragmaDirective: {
    enter(path, state, scope) {},
    exit(path, state, scope) {},
  },

  ContractDefinition: {
    enter(path, state, scope) {},

    exit(path, state, scope) {},
  },

  FunctionDefinition: {
    enter(path, state, scope) {},

    exit(path, state, scope) {},
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
    enter(path, state, scope) {},

    exit(path, state, scope) {},
  },

  ExpressionStatement: {
    enter(path, state, scope) {},

    exit(node, parent) {},
  },

  VariableDeclaration: {
    enter(path, state, scope) {},

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
