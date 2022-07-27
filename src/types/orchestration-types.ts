/* eslint-disable import/no-cycle, consistent-return */
import { buildBoilerplateNode } from '../boilerplate/orchestration/javascript/nodes/boilerplate-generator.js';

/**
 * @param {string} nodeType - the type of node you'd like to build
 * @param {Object} fields - important key, value pairs to include in the node, and which enable the rest of the node's info to be derived. How do you know which data to include in `fields`? Read this function.
 */

export default function buildNode(nodeType: string, fields: any = {}): any {
  switch (nodeType) {
    case 'File': {
      const { fileName, fileExtension = '.mjs', nodes = [] } = fields;
      return {
        nodeType,
        fileName,
        fileExtension,
        nodes,
      };
    }
    case 'Imports': {
      const { imports = [] } = fields;
      return {
        nodeType,
        imports,
      };
    }
    case 'FunctionDefinition': {
      // prettier-ignore
      const {
        name,
        parameters = buildNode('ParameterList'),
        body = buildNode('Block'),
        contractName
      } = fields;
      return {
        nodeType,
        name,
        contractName,
        parameters,
        body,

        // Notice no return parameters. We always return the transaction rct.
      };
    }
    case 'ParameterList': {
      const { parameters = [], modifiedStateVariables = [] } = fields;
      return {
        nodeType,
        parameters,
        modifiedStateVariables,
      };
    }
    case 'Block': {
      const {
        preStatements = [],
        statements = [],
        postStatements = [],
      } = fields;
      return {
        nodeType,
        preStatements,
        statements,
        postStatements,
      };
    }
    case 'Return': {
      const { value, kind } = fields;
      return {
        nodeType,
        value,
        kind,
      };
    }
    case 'VariableDeclaration': {
      const { name, type, interactsWithSecret, isSecret, isAccessed } = fields;
      return {
        nodeType,
        name,
        isSecret,
        isAccessed,
        interactsWithSecret,
        typeName: buildNode('ElementaryTypeName', { name: type }),
      };
    }
    case 'VariableDeclarationStatement': {
      const {
        declarations = [],
        initialValue = {},
        interactsWithSecret,
        oldASTId = 0,
      } = fields;
      return {
        nodeType,
        id: oldASTId,
        interactsWithSecret,
        declarations,
        initialValue,
      };
    }
    case 'BinaryOperation': {
      const { leftExpression = {}, operator, rightExpression = {} } = fields;
      return {
        nodeType,
        leftExpression,
        operator,
        rightExpression,
      };
    }
    case 'Assignment': {
      const { leftHandSide = {}, operator, rightHandSide = {} } = fields;
      return {
        nodeType,
        operator,
        leftHandSide,
        rightHandSide,
      };
    }
    case 'ExpressionStatement': {
      const {
        expression = {},
        oldASTId,
        interactsWithSecret,
        incrementsSecretState,
        decrementsSecretState,
        privateStateName,
      } = fields;
      return {
        nodeType,
        id: oldASTId,
        expression,
        interactsWithSecret,
        incrementsSecretState,
        decrementsSecretState,
        privateStateName,
      };
    }
    case 'InternalFunctionCall': {
      const { name, internalFunctionInteractsWithSecret = false} = fields;
      return{
        nodeType,
        name,
        internalFunctionInteractsWithSecret,
      };

    }
    case 'IndexAccess': {
      const {
        baseExpression = {},
        indexExpression = {},
        name,
        isAccessed = false,
        isSecret = false,
      } = fields;
      return {
        nodeType,
        name,
        baseExpression,
        indexExpression,
        isAccessed,
        isSecret,
      };
    }
    case 'MemberAccess': {
      const { name, memberName, expression = {} } = fields;
      return {
        nodeType,
        name,
        memberName,
        expression,
      };
    }
    case 'TupleExpression': {
      const { components = [] } = fields;
      return {
        nodeType,
        components,
      }
    }
    case 'IfStatement': {
      const { condition = {} , trueBody= {} , falseBody= {} } = fields;
      return {
        nodeType,
        condition,
        trueBody,
        falseBody,
      }
    }
    case 'ForStatement': {
      const { condition = {} ,initializationExpression = {} ,interactsWithSecret, loopExpression = {}, body= {} } = fields;
      return {
        nodeType,
        condition,
        initializationExpression,
        interactsWithSecret,
        loopExpression,
        body,
      }
    }
    case 'UnaryOperation': {
      const { operator, prefix, subExpression = {} } = fields;
      return {
        nodeType,
        operator,
        prefix,
        subExpression,
      };
    }

    case 'TypeConversion': {
      const { type, expression = {}, args = {} } = fields;
      return {
        nodeType,
        type,
        arguments: args,
        expression,
      };
    }
    case 'MsgSender': {
      return {
        nodeType,
      };
    }
    case 'Identifier': {
      const { name, subType = '' } = fields;
      return {
        nodeType,
        name,
        subType,
      };
    }
    case 'Literal': {
      const { value } = fields;
      return {
        nodeType,
        value,
      };
    }
    case 'ElementaryTypeName': {
      const { name } = fields;
      return {
        nodeType,
        name,
      };
    }
    case 'InitialisePreimage':
    case 'InitialiseKeys':
    case 'ReadPreimage':
    case 'WritePreimage':
    case 'MembershipWitness':
    case 'CalculateNullifier':
    case 'CalculateCommitment':
    case 'GenerateProof':
    case 'SendTransaction':
    case 'SetupCommonFilesBoilerplate':
    case 'EditableCommitmentCommonFilesBoilerplate':
    case 'IntegrationTestBoilerplate':
    case 'IntegrationTestFunction':
    case 'Boilerplate': {
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      return buildBoilerplateNode(nodeType, fields);
    }
    default:
      throw new TypeError(nodeType);
  }
}
