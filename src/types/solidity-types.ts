/* eslint-disable consistent-return, no-param-reassign */

import ContractBP from '../boilerplate/contract/solidity/nodes/ContractBoilerplateGenerator.js';
import FunctionBP from '../boilerplate/contract/solidity/nodes/FunctionBoilerplateGenerator.js';

export function getVisitableKeys(nodeType: string): string[] {
  switch (nodeType) {
    case 'SourceUnit':
    case 'ContractDefinition':
      return ['nodes', 'baseContracts'];
    case 'InheritanceSpecifier':
      return ['baseName'];
    case 'FunctionDefinition':
      return ['parameters', 'returnParameters', 'body'];
    case 'Conditional':
      return ['condition', 'trueExpression', 'falseExpression'];
    case 'ParameterList':
      return ['parameters'];
      case 'EventDefinition':
      return ['parameters'];
    case 'ReturnParameterList':
      return ['parameters'];
    case 'IfStatement':
      return ['condition', 'trueBody' , 'falseBody'];
    case 'WhileStatement':
      return ['condition', 'body'];
      case 'DoWhileStatement':
        return ['condition', 'body'];
    case 'ForStatement':
        return ['initializationExpression', 'condition', 'loopExpression' , 'body'];
    case 'Block':
      return ['statements'];
    case 'VariableDeclarationStatement':
      return ['declarations', 'initialValue'];
    case 'ExpressionStatement':
    case 'MemberAccess':
    case 'Return':
      return ['expression'];
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
    case 'UnaryOperation':
      return ['subExpression'];
    case 'TupleExpression':
      return ['components'];
    case 'FunctionCall':
      return ['expression', 'arguments'];
    case 'InternalFunctionCall' :
      return ['name','parameters'];
    case 'ArrayTypeName':
      return ['baseType'];
    case 'ElementaryTypeNameExpression':
      return ['typeName'];
    case 'EmitStatement':
      return ['eventCall'];
    case 'StructDefinition':
      return ['members'];
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
    case 'UserDefinedTypeName':
    case 'ImportDirective':
    case 'ModifierDefinition':
    case 'Break':
    case 'Continue':
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
export function buildNode(nodeType: string, fields: any = {}): any {
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
    case 'InheritanceSpecifier': {
      const { name } = fields;
      return {
        nodeType,
        baseName: { name },
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
        isConstructor,
        kind,
        stateMutability,
        msgSigRequired,
        body = buildNode('Block'),
        parameters = buildNode('ParameterList'),
        returnParameters = buildNode('ParameterList'), // TODO
      } = fields;

      return {
        nodeType,
        name,
        visibility,
        isConstructor,
        kind,
        stateMutability,
        msgSigRequired,
        body,
        parameters,
        returnParameters,
      };
    }
    case 'ParameterList': {
      const { parameters = [] } = fields;
      return {
        nodeType,
        parameters,
      };
    }
    case 'ReturnParameterList': {
      const { parameters = [] } = fields;
      return {
        nodeType,
        parameters,
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
    case 'VariableDeclaration': {
      const {
        name,
        typeString,
        visibility,
        storageLocation,
        isSecret,
        interactsWithSecret,
        declarationType,
      } = fields;
      return {
        nodeType,
        name,
        visibility,
        storageLocation,
        typeDescriptions: { typeString },
        typeName: buildNode('ElementaryTypeName', {
          typeDescriptions: { typeString },
        }),
        isSecret,
        interactsWithSecret,
        declarationType,
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
    case 'EventDefinition':
      {
      const { name , parameters = buildNode('ParameterList') } = fields;
      return {
        nodeType,
        name,
        parameters
        };
      }
    case 'EmitStatement':
      {
      const { eventCall = {} } = fields;
      return {
        nodeType,
        eventCall,
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
    case 'ExpressionStatement': {
      const { expression = {} } = fields;
      return {
        nodeType,
        expression,
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
    case 'FunctionCall': {
      const { expression = {}, arguments: args = [] } = fields;
      return {
        nodeType,
        expression,
        arguments: args, // 'arguments' is a reserved word in JS
      };
    }
    case 'InternalFunctionCall': {
      const { name, internalFunctionInteractsWithSecret = false, parameters = [], arguments: args = [] } = fields;
      return {
        nodeType,
        name,
        internalFunctionInteractsWithSecret,
        parameters,
        arguments: args
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
    case 'MemberAccess': {
      const { expression = {}, memberName } = fields;
      return {
        nodeType,
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
      };
    }

    case 'Conditional': {
      const { condition = {} , trueExpression= {} , falseExpression= {} } = fields;
      return {
        nodeType,
        condition,
        trueExpression,
        falseExpression,
      };
    }

    case 'ForStatement': {
      const { condition = {} ,initializationExpression = {} ,loopExpression = {}, body= {} } = fields;
      return {
        nodeType,
        condition,
        initializationExpression,
        loopExpression,
        body,
      };
    }

    case 'WhileStatement': {
      const { condition = {} , body= {} } = fields;
      return {
        nodeType,
        condition,
        body,
      };
    }

    case 'DoWhileStatement': {
      const { condition = {} , body= {} } = fields;
      return {
        nodeType,
        condition,
        body,
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
    case 'MsgSender':
    case 'MsgValue': {
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
      const { value, kind } = fields;
      return {
        nodeType,
        value,
        kind,
      };
    }
    case 'ElementaryTypeNameExpression': {
      const { typeName = {} } = fields;
      return {
        nodeType,
        typeName,
      };
    }
    case 'ArrayTypeName': {
      const { baseType = {} } = fields;
      return {
        nodeType,
        baseType,
      };
    }
    case 'StructDefinition': {
      const { name, members = []} = fields;
      return {
        nodeType,
        name,
        members,
      }
    }
    case 'ContractBoilerplate': {
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      const { scope, bpSection, circuitParams, returnpara } = fields;
      const bp = new ContractBP(scope);
      return bp.getBoilerplate(bpSection, circuitParams);
    }
    case 'FunctionBoilerplate': {
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      const { scope, bpSection, customInputs } = fields;
      const bp = new FunctionBP(scope);
      return bp.getBoilerplate(bpSection, customInputs);
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
