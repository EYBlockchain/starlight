/* eslint-disable consistent-return */
import { buildBoilerplateNode } from '../boilerplate/orchestration/javascript/nodes/boilerplate-generator.mjs';

/**
 * @param {string} nodeType - the type of node you'd like to build
 * @param {Object} fields - important key, value pairs to include in the node, and which enable the rest of the node's info to be derived. How do you know which data to include in `fields`? Read this function.
 */
export default function buildNode(nodeType, fields = {}) {
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
        body = buildNode('Block'),
        parameters = buildNode('ParameterList'),
        contractName
      } = fields;
      return {
        nodeType,
        name,
        contractName,
        body,
        parameters,
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
      const { statements = [] } = fields;
      return {
        nodeType,
        statements,
      };
    }
    case 'VariableDeclaration': {
      const { name, type, modifiesSecretState, isSecret, isAccessed } = fields;
      return {
        nodeType,
        name,
        isSecret,
        isAccessed,
        modifiesSecretState,
        typeName: buildNode('ElementaryTypeName', { name: type }),
      };
    }
    case 'VariableDeclarationStatement': {
      const { declarations = [], initialValue = {} } = fields;
      return {
        nodeType,
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
        incrementsSecretState,
        decrementsSecretState,
        privateStateName,
      } = fields;
      return {
        nodeType,
        expression,
        incrementsSecretState,
        decrementsSecretState,
        privateStateName,
      };
    }
    case 'IndexAccess': {
      const { baseExpression = {}, indexExpression = {} } = fields;
      return {
        nodeType,
        baseExpression,
        indexExpression,
      };
    }
    case 'MsgSender': {
      return {
        nodeType,
      };
    }
    case 'Identifier': {
      const { name } = fields;
      return {
        nodeType,
        name,
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
