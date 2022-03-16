/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

/**
 * @desc:
 * Visitor will throw errors when certain nodeTypes are traversed.
 * Namely: nodeTypes for complex Solidity syntax which we haven't written
 * support for yet.
 */

import { TODOError, ZKPError } from '../../../error/errors.js';


export default {
  // FunctionCall: {
  //   enter(node: any) {
  //     if (
  //       node.kind === 'functionCall' &&
  //       node.expression.typeDescriptions.typeIdentifier.includes(`_internal_`)
  //     )
  //       throw new TODOError(
  //         `swati is doing`,
  //         node,
  //       );
  //   },
  // },

  StructuredDocumentation: {
    enter(node: any) {
      throw new TODOError(`Solidity type ${node.nodeType}`, node);
    },

  },

  InlineAssembly: {
    enter(node: any) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle non-secret assembly in the future.`,
        node,
      );
    },
  },

  EnumDefinition: {
    enter(node: any) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle enums in the near future.`,
        node,
      );
    },
  },

  StructDefinition: {
    enter(node: any) {
      throw new TODOError(
        `Solidity type ${node.nodeType}. We plan to handle structs in the near future.`,
        node,
      );
    },
  },

  WhileStatement: {
    enter(node: any) {
      throw new ZKPError(
        'While statements are unsupported in zero-knowledge proof circuits because they cannot handle dynamic loops.',
        node,
      );
    },
  },
};
