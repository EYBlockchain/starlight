/* eslint-disable consistent-return */

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
      const { name, body = {}, parameters = {} } = fields;
      return {
        nodeType,
        name,
        body,
        parameters,
        // Notice no return parameters. Whilst zokrates can return parameters, we've chosen to transpile in such a way that all parameters are _input_ parameters to the circuit.
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
      const { statements = [] } = fields;
      return {
        nodeType,
        statements,
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
      const { leftExpression = {}, rightExpression = {} } = fields;
      return {
        nodeType,
        leftExpression,
        rightExpression,
      };
    }
    case 'Assignment': {
      const { operator, leftHandSide = {}, rightHandSide = {} } = fields;
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
    case 'EditableCommitmentImportStatementsBoilerplate': {
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      return {
        nodeType,
      };
    }
    case 'EditableCommitmentCommonFilesBoilerplate': {
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      return {
        nodeType,
      };
    }
    case 'EditableCommitmentParametersBoilerplate': {
      const { privateStateName } = fields;
      // We'll build an array of parameters (each parameter being a VariableDeclaration AST node)
      return {
        nodeType,
        privateStateName,
      };
    }
    case 'EditableCommitmentStatementsBoilerplate': {
      const { privateStateName } = fields;
      // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
      return {
        nodeType,
        privateStateName,
      };
    }
    default:
      throw new TypeError(nodeType);
  }
}
