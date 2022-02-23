/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

/**
 * @desc:
 * Visitor will throw errors when certain nodeTypes are traversed.
 * Namely: nodeTypes for complex Solidity syntax which we haven't written
 * support for yet.
 */

import cloneDeep from 'lodash.clonedeep';
import { TODOError, ZKPError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';


export default {
  FunctionCall: {
    enter(node: any) {
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
    enter(node: any) {
      throw new TODOError(`Solidity type ${node.nodeType}`, node);
    },

    exit(path, state) {},
  },

  InlineAssembly: {
    enter(node: any, state: any) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle non-secret assembly in the future.`,
        node,
      );
    },

    exit(path: NodePath, state: any) {},
  },

  EnumDefinition: {
    enter(node: any, state: any) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle enums in the near future.`,
        node,
      );
    },

    exit(path: NodePath, state: any) {},
  },

  StructDefinition: {
    enter(node: any, state: any) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle structs in the near future.`,
        node,
      );
    },

    exit(path: NodePath, state: any) {},
  },

  WhileStatement: {
    enter(node: any, state: any) {
      throw new ZKPError(
        'While statements are unsupported in zero-knowledge proof circuits because they cannot handle dynamic loops.',
        node,
      );
    },

    exit(path: NodePath, state: any) {},
  },
};
