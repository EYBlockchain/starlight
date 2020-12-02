/* eslint-disable no-param-reassign */

export const VISITOR_KEYS = {};
export const ALIAS_KEYS = {};
export const FLIPPED_ALIAS_KEYS = {};
export const NODE_FIELDS = {};
export const BUILDER_KEYS = {};

/*
opts: {
  fields?: {
    [string]: FieldOptions,
  },
  visitor?: Array<string>,
  aliases?: Array<string>,
  builder?: Array<string>,
  inherits?: string,
  deprecatedAlias?: string,
  validate?: Validator,
} = {},
*/
export default function defineType(
  type, //
  opts,
) {
  const fields = opts.fields || {};
  const visitor = opts.visitor || [];
  const builder = opts.builder || [];
  const aliases = opts.aliases || [];

  // ensure all field keys are represented in `fields`
  for (const key of visitor.concat(builder)) {
    fields[key] = fields[key] || {};
  }

  VISITOR_KEYS[type] = visitor;
  BUILDER_KEYS[type] = builder;
  NODE_FIELDS[type] = fields;
  ALIAS_KEYS[type] = aliases;

  aliases.forEach(alias => {
    FLIPPED_ALIAS_KEYS[alias] = FLIPPED_ALIAS_KEYS[alias] || [];
    FLIPPED_ALIAS_KEYS[alias].push(type);
  });
}

defineType('AST', {
  fields: {
    ast: {},
  },
  builder: ['ast'],
  visitor: ['ast'],
  aliases: [],
});

defineType('SourceUnit', {
  fields: {
    nodes: {},
  },
  builder: [
    'absolutePath', //
    'exportedSymbols',
    'id',
    'license',
    'nodeType',
    'nodes',
    'src',
  ],
  visitor: ['nodes'],
  aliases: ['Program', 'File'],
});

defineType('PragmaDirective', {
  fields: {},
  builder: ['id', 'literals', 'nodeType', 'src'],
  visitor: [],
  aliases: ['Pragma', 'Version'],
});

defineType('ContractDefinition', {
  fields: {
    nodes: {},
  },
  builder: [
    'abstract',
    'baseContracts',
    'contractDependencies',
    'contractKind',
    'fullyImplemented',
    'id',
    'linearizedBaseContracts',
    'name',
    'nodeType',
    'nodes',
    'scope',
    'src',
  ],
  visitor: ['nodes'],
  aliases: ['Scopable', 'Function', 'Contract', 'FunctionParent', 'Statement', 'Declaration'],
});

defineType('FunctionDefinition', {
  fields: {
    parameters: {},
    returnParameters: {},
    body: {},
  },
  builder: [
    'body',
    'functionSelector',
    'id',
    'implemented',
    'kind',
    'modifiers',
    'name',
    'nodeType',
    'parameters',
    'returnParameters',
    'scope',
    'src',
    'stateMutability',
    'virtual',
    'visibility',
  ],
  visitor: ['body', 'parameters', 'returnParameters'],
  aliases: ['Scopable', 'Function', 'BlockParent', 'FunctionParent', 'Statement', 'Declaration'],
});

defineType('ParameterList', {
  fields: {
    parameters: {},
  },
  builder: [
    'id', //
    'nodeType',
    'parameters',
    'src',
  ],
  visitor: ['parameters'],
  aliases: ['Parameters'],
});

defineType('Block', {
  fields: {
    statements: {},
  },
  builder: ['id', 'nodeType', 'src', 'statements'],
  visitor: ['statements'],
  aliases: ['Scopable', 'BlockParent', 'Block', 'Statement'],
});

defineType('VariableDeclaration', {
  fields: {
    typeName: {},
  },
  builder: [
    'constant',
    'functionSelector',
    'id',
    'mutability',
    'name',
    'nodeType',
    'scope',
    'src',
    'stateVariable',
    'storageLocation',
    'typeDescriptions',
    'typeName',
    'visibility',
    'isSecret',
  ],
  visitor: ['typeName'],
  aliases: ['Declaration'],
});

defineType('VariableDeclarationStatement', {
  fields: {
    declarations: {},
    initialValue: {},
  },
  builder: ['assignments', 'declarations', 'id', 'initialValue', 'nodeType', 'src'],
  visitor: ['declarations', 'initialValue'],
  aliases: ['Statement', 'Declaration'],
});

defineType('ExpressionStatement', {
  fields: {
    expression: {},
  },
  builder: ['expression', 'id', 'nodeType', 'src'],
  visitor: ['expression'],
  aliases: ['Expression', 'Statement'],
});

defineType('Assignment', {
  fields: {
    operator: {
      // we can add validation functions in here, but we won't, for now.
      validate: (() => {})(),
    },
    leftHandSide: {},
    rightHandSide: {},
  },
  builder: [
    'id',
    'isConstant',
    'isLValue',
    'isPure',
    'lValueRequested',
    'leftHandSide',
    'nodeType',
    'operator',
    'rightHandSide',
    'src',
    'typeDescriptions',
  ],
  visitor: ['leftHandSide', 'rightHandSide'],
  aliases: ['Expression'],
});

defineType('BinaryOperation', {
  fields: {
    operator: {},
    leftExpression: {},
    rightExpression: {},
  },
  builder: [
    'id',
    'isConstant',
    'isLValue',
    'isPure',
    'lValueRequested',
    'leftExpression',
    'nodeType',
    'operator',
    'rightExpression',
    'src',
    'typeDescriptions',
  ],
  visitor: ['leftExpression', 'rightExpression'],
  aliases: ['Binary', 'Expression'],
});

defineType('Identifier', {
  fields: {
    name: {},
    typeDescriptions: {},
  },
  builder: [
    'id',
    'name',
    'nodeType',
    'overloadedDeclarations',
    'referencedDeclaration',
    'src',
    'typeDescriptions',
  ],
  visitor: ['typeDescriptions'],
  aliases: ['Expression'],
});

defineType('Literal', {
  fields: {
    typeDescriptions: {},
  },
  builder: [
    'hexValue',
    'id',
    'nodeType',
    'isConstant',
    'isLValue',
    'isPure',
    'kind',
    'lValueRequested',
    'nodeType',
    'src',
    'typeDescriptions',
    'value',
  ],
  visitor: ['typeDescriptions'],
  aliases: ['Expression'],
});

defineType('ElementaryTypeName', {
  fields: {
    typeDescriptions: {},
  },
  builder: ['id', 'name', 'nodeType', 'src', 'typeDescriptions'],
  visitor: [],
  aliases: ['Type'],
});
