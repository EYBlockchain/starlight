/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import { TODOError, ZKPError } from '../../../error/errors.mjs';

export default {
  FunctionCall: {
    enter(node) {
      if (
        node.kind === 'functionCall' &&
        node.expression.typeDescriptions.typeIdentifier.includes(`_internal_`)
      )
        throw new TODOError(
          `Internal function calls involving any states. This doesn't work because we assume all Identifiers refer to a VariableDeclaration, when they can refer to a FunctionDefinition.`,
          node,
        );
    },
  },

  StructuredDocumentation: {
    enter(node) {
      throw new TODOError(`Solidity type ${node.nodeType}`, node);
    },

    exit(path, state) {},
  },

  InlineAssembly: {
    enter(node, state) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle non-secret assembly in the future.`,
        node,
      );
    },

    exit(path, state) {},
  },

  EnumDefinition: {
    enter(node, state) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle enums in the near future.`,
        node,
      );
    },

    exit(path, state) {},
  },

  StructDefinition: {
    enter(node, state) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle structs in the near future.`,
        node,
      );
    },

    exit(path, state) {},
  },

  WhileStatement: {
    enter(node, state) {
      throw new ZKPError(
        'While statements are unsupported in zero-knowledge proof circuits because they cannot handle dynamic loops.',
        node,
      );
    },

    exit(path, state) {},
  },
};
