/* eslint-disable consistent-return */
import BP from '../boilerplate/circuit/zokrates/nodes/BoilerplateGenerator.mjs';

// TODO: I don't think this is ever used; only the Solidity version ever gets visited. Can probably delete this function...
export function getVisitableKeys(nodeType) {
  switch (nodeType) {
    case 'Folder':
      return ['files'];
    case 'File':
      return ['nodes'];
    case 'ImportStatementList':
      return ['imports'];
    case 'SourceUnit':
    case 'ContractDefinition':
      return ['nodes'];
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
    case 'Assignment':
      return ['leftHandSide', 'rightHandSide'];
    case 'BinaryOperation':
      return ['leftExpression', 'rightExpression'];
    case 'VariableDeclaration':
      return ['typeName'];
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
      return [];
    case 'PartitionedIncrementationStatementBoilerplate':
      return ['addend'];
    case 'PartitionedDecrementationStatementBoilerplate':
      return ['subtrahend'];
    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(nodeType);
  }
}

const generateBoilerplate = ({ indicators, bpSection }) => {
  const bpArray = [];
  for (const indicatorObj of Object.values(indicators)) {
    const bp = new BP(indicatorObj);
    bpArray.push(...bp[bpSection]);
  }
  return bpArray;
};

const generateBoilerplateStatement = (bpType, extraParams) => {
  const { indicators } = extraParams;
  const bp = new BP(indicators);
  return bp.generateBoilerplateStatement(bpType, extraParams);
};

/**
 * @param {string} nodeType - the type of node you'd like to build
 * @param {Object} fields - important key, value pairs to include in the node, and which enable the rest of the node's info to be derived. How do you know which data to include in `fields`? Read this function.
 */
export function buildNode(nodeType, fields = {}) {
  switch (nodeType) {
    case 'File': {
      const { fileName, nodes = [] } = fields;
      return {
        nodeType,
        fileName,
        fileExtension: '.zok',
        nodes,
      };
    }
    case 'ImportStatementList': {
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
        parameters = buildNode('ParameterList')
      } = fields;
      return {
        nodeType,
        name,
        body,
        parameters,
        // Notice no return parameters. Although zokrates _can_ return parameters, we've chosen to transpile in such a way that all parameters are _input_ parameters to the circuit.
      };
    }
    case 'ParameterList': {
      const { parameters = [] } = fields;
      return {
        nodeType,
        parameters,
      };
    }
    case 'Block': {
      const { preStatements = [], statements = [], postStatements = [] } = fields;
      return {
        nodeType,
        preStatements,
        statements,
        postStatements,
      };
    }
    case 'VariableDeclaration': {
      const { name, type, isPrivate = false } = fields;
      return {
        nodeType,
        name,
        isPrivate,
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
      const { expression = {} } = fields;
      return {
        nodeType,
        expression,
      };
    }
    case 'Identifier': {
      const { name } = fields;
      return {
        nodeType,
        name,
      };
    }
    case 'ElementaryTypeName': {
      const { name } = fields;
      return {
        nodeType,
        name,
      };
    }
    case 'Boilerplate': {
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      return generateBoilerplate(fields);
    }
    case 'PartitionedIncrementationStatementBoilerplate': {
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      return generateBoilerplateStatement('incrementation', fields);
    }
    case 'PartitionedDecrementationStatementBoilerplate': {
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      return generateBoilerplateStatement('decrementation', fields);
    }
    default:
      throw new TypeError(nodeType);
  }
}
