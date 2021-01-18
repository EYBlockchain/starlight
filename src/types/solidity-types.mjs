/* eslint-disable consistent-return, no-param-reassign */

import cloneDeep from 'lodash.clonedeep';

export function getNodeSkeleton(nodeType) {
  switch (nodeType) {
    case 'SourceUnit':
    case 'ContractDefinition':
      return {
        nodes: [],
      };
    case 'FunctionDefinition':
      return {
        body: {},
        parameters: {},
        returnParameters: {},
      };
    case 'ParameterList':
      return {
        parameters: [],
      };
    case 'Block':
      return {
        statements: [],
      };
    case 'VariableDeclarationStatement':
      return {
        declarations: [],
        initialValue: {},
      };
    case 'ExpressionStatement':
      return {
        expression: {},
      };
    case 'UnaryOperation':
      return {
        subExpression: {},
      };
    case 'Assignment':
      return {
        leftHandSide: {},
        rightHandSide: {},
      };
    case 'BinaryOperation':
      return {
        leftExpression: {},
        rightExpression: {},
      };
    case 'VariableDeclaration':
      return {
        typeName: {},
      };
    case 'Mapping':
      return {
        keyType: {},
        valueType: {},
      };
    case 'IndexAccess':
      return {
        indexExpression: {},
        baseExpression:{},
      };
    case 'MemberAccess':
      return {
        expression: {},
      };
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
      return {};

    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(nodeType);
  }
}

export function getVisitableKeys(nodeType) {
  switch (nodeType) {
    case 'SourceUnit':
    case 'ContractDefinition':
      return ['nodes', 'baseContracts'];
    case 'InheritanceSpecifier':
      return ['baseName'];
    case 'FunctionDefinition':
      return ['parameters', 'returnParameters', 'body'];
    case 'ParameterList':
      return ['parameters'];
    case 'Block':
      return ['statements'];
    case 'VariableDeclarationStatement':
      return ['declarations', 'initialValue'];
    case 'ExpressionStatement':
      return ['expression'];
    case 'UnaryOperation':
      return ['subExpression'];
    case 'Assignment':
      return ['leftHandSide', 'rightHandSide'];
    case 'BinaryOperation':
      return ['leftExpression', 'rightExpression'];
    case 'VariableDeclaration':
      return ['typeName'];
    case 'Mapping':
      return ['keyType', 'valueType'];
    case 'IndexAccess':
      return ['indexExpression', 'baseExpression'];
    case 'MemberAccess':
      return ['expression'];
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
    case 'UserDefinedTypeName':
      return [];

    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(nodeType);
  }
}

/**
 * @param {string} nodeType - the type of node you'd like to build
 * @param {Object} fields - important key, value pairs to include in the node, and which enable the rest of the node's info to be derived. How do you know which data to include in `fields`? Read this function.
 */
export function buildNode(nodeType, fields) {
  switch (nodeType) {
    case 'SourceUnit': {
      const { name, license, nodes = [] } = fields;
      return {
        nodeType,
        name,
        license,
        nodes,
      };
    }
    case 'File': {
      const { fileName, nodes = [] } = fields;
      return {
        nodeType,
        fileName,
        fileExtension: '.zok',
        nodes,
      };
    }
    case 'PragmaDirective': {
      const { literals } = fields;
      return {
        nodeType,
        literals,
      };
    }
    case 'ImportStatementList': {
      const { imports = [] } = fields;
      return {
        nodeType,
        imports,
      };
    }
    case 'ImportDirective': {
      const { file } = fields;
      return {
        nodeType,
        file,
      };
    }
    case 'ContractDefinition': {
      const { name, baseContracts = [], nodes = [], isShieldContract } = fields;
      return {
        nodeType,
        name,
        baseContracts,
        nodes,
        isShieldContract,
      };
    }
    case 'FunctionDefinition': {
      const {
        name,
        visibility,
        body = { nodeType: 'Block', statements: [] },
        parameters = { nodeType: 'ParameterList', parameters: [] },
        returnParameters = { nodeType: 'ParameterList', parameters: [] },
      } = fields;
      return {
        nodeType,
        name,
        visibility,
        body,
        parameters,
        returnParameters,
      };
    }
    case 'VariableDeclaration': {
      const { name, type, visibility, storageLocation, typeName } = fields;
      return {
        nodeType,
        name,
        visibility,
        storageLocation,
        typeDescriptions: { typeString: type },
        typeName,
      };
    }
    case 'Mapping': {
      const { keyType = {}, valueType = {}, typeDescriptions = {} } = fields;
      return {
        nodeType,
        keyType,
        valueType,
        typeDescriptions,
      };
    }
    // 'MappingDeclaration' is a made-up nodeType, for convenient creation of a Mapping node within a VariableDeclaration node
    case 'MappingDeclaration': {
      const { name, fromType, toType, visibility, storageLocation } = fields;
      return buildNode('VariableDeclaration', {
        name,
        visibility,
        storageLocation,
        typeName: buildNode('Mapping', {
          keyType: buildNode('ElementaryTypeName', {
            name: fromType,
            typeDescriptions: {
              typeString: fromType,
            },
          }),
          valueType: buildNode('ElementaryTypeName', {
            name: toType,
            typeDescriptions: {
              typeString: toType,
            },
          }),
          typeDescriptions: {
            typeString: `mapping(${fromType} => ${toType})`,
          },
        }),
      });
    }
    case 'VariableDeclarationStatement': {
      const { declarations = [], initialValue = {} } = fields;
      return {
        nodeType,
        declarations,
        initialValue,
      };
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
    case 'ElementaryTypeName': {
      const { typeDescriptions } = fields;
      return {
        nodeType,
        typeDescriptions,
      };
    }
    // Boilerplate nodeTypes will be understood by the codeGenerator, where raw boilerplate code will be inserted.
    case 'ShieldContractConstructorBoilerplate': {
      return { nodeType };
    }
    case 'ShieldContractVerifierInterfaceBoilerplate': {
      return { nodeType };
    }
    case 'requireNewNullifiersNotInNullifiersThenAddThemBoilerplate': {
      return { nodeType };
    }
    case 'requireCommitmentRootInCommitmentRootsBoilerplate': {
      return { nodeType };
    }
    case 'verifyBoilerplate': {
      return { nodeType };
    }
    case 'insertLeavesBoilerplate': {
      return { nodeType };
    }
    default:
      throw new TypeError(nodeType);
  }
}

export default { buildNode };
