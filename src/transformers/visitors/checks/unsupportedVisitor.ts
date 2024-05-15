/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

/**
 * @desc:
 * Visitor will throw errors when certain nodeTypes are traversed.
 * Namely: nodeTypes for complex Solidity syntax which we haven't written
 * support for yet.
 */

import { TODOError, ZKPError, ParseError } from '../../../error/errors.js';
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

  WhileStatement: {
    enter(node: any) {
      throw new ZKPError(
        'While statements are unsupported in zero-knowledge proof circuits because they cannot handle dynamic loops.',
        node,
      );
    },
  },

  IfStatement: {
    enter(node: any) {
      if (['Identifier', 'Literal'].includes(node.condition.nodeType))
        throw new TODOError(
          `We can't currently handle conditions which are singular variables - instead of if(a) try something like if(a == true). This is because the compiler must store the 'LHS' (a) and 'RHS' (true) value of the condition in case either are modified throughout the function.`,
          node.condition
        );
    },
  },

  BinaryOperation: {
    enter(node: any) {
      if (node.operator == "&&" || node.operator == "||") {
        if (node.leftExpression.nodeType == "BinaryOperation" ) {
          if ((node.leftExpression.operator == "&&" || node.leftExpression.operator == "||") && node.leftExpression.operator !== node.operator) {
            throw new ParseError(
              `Please use brackets to clarify the logic structure. A condition contains nested logical operators without brackets, which can lead to ambiguity in reading the logic flow.`
            );
          }
        }
        if (node.rightExpression.nodeType == "BinaryOperation" ) {
          if ((node.rightExpression.operator == "&&" || node.rightExpression.operator == "||") && node.rightExpression.operator !== node.operator) {
            throw new ParseError(
              `Please use brackets to clarify the logic structure. A condition contains nested logical operators without brackets, which can lead to ambiguity in reading the logic flow.`
            );
          }
        }
      }
    },
  },
    
  VariableDeclaration: {
    enter(node: any) {
      if (node.name.startsWith('_') && node.isSecret)
        throw new ZKPError(
          `Zokrates does not support variables that begin with an underscore such as as _value.`,
          node
        );
      if (node.name === 'key'){
        throw new ZKPError(
          `Zokrates does not support variables with the name key, please choose a different name.`,
          node
        );
      }
    },
  },
};
