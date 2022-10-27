/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

/**
 * @desc:
 * Visitor will throw errors when certain nodeTypes are traversed.
 * Namely: nodeTypes for complex Solidity syntax which we haven't written
 * support for yet.
 */

import { TODOError, ZKPError } from '../../../error/errors.js';
import { traverseNodesFast } from '../../../traverse/traverse.js';


export default {
  StructuredDocumentation: {
    enter(node: any) {
      throw new TODOError(`Solidity type ${node.nodeType}`, node);
    },

  },

  IndexAccess: {
    enter(node: any) {
      const nestedIndexAccessVisitor = (thisNode: any) => {
        if (thisNode.nodeType === 'IndexAccess') throw new TODOError(`Nested mapping calls require complex naming and accessing logic we haven't completed. Consider using local variables or simplifying mappings.`, thisNode);
      }
      traverseNodesFast(node.indexExpression, nestedIndexAccessVisitor, {});
    }
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
      node.members.forEach((member: any) => {
        if (member.typeDescriptions?.typeString.includes('mapping')) {
          throw new TODOError(
            `Structs involving properties as mappings create a very complex commitment structure. We may work on this in future if there is high demand for this feature.`,
            member,
          );
        }
      });

    },
  },

  // WhileStatement: {
  //   enter(node: any) {
  //     console.log(' while node ' , node.body.statements);
  //     if(node.interactsWithSecret)
  //     throw new ZKPError(
  //       'While statements are unsupported in zero-knowledge proof circuits because they cannot handle dynamic loops.',
  //       node,
  //     );
  //   },
  // },
};
