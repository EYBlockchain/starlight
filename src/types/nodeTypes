/* tslint:disable */

export type Expression =
  | Assignment
  | BinaryOperation
  | Conditional
  | ElementaryTypeNameExpression
  | FunctionCall
  | FunctionCallOptions
  | Identifier
  | IndexAccess
  | Literal
  | MemberAccess
  | NewExpression
  | TupleExpression
  | UnaryOperation;
export type SourceLocation = string;
export type StateMutability = "payable" | "pure" | "nonpayable" | "view";
export type TypeName = ArrayTypeName | ElementaryTypeName | FunctionTypeName | Mapping | UserDefinedTypeName;
export type Mutability = "mutable" | "immutable" | "constant";
export type StorageLocation = "calldata" | "default" | "memory" | "storage";
export type Visibility = "external" | "public" | "internal" | "private";
export type Statement =
  | EmitStatement
  | ExpressionStatement
  | ForStatement
  | IfStatement
  | WhileStatement
  | TryStatement
  | InlineAssembly
  | PlaceholderStatement
  | Return
  | VariableDeclarationStatement;

export interface SourceUnit {
  absolutePath: string;
  exportedSymbols: ExportedSymbols;
  id: number;
  license?: null | string;
  nodeType: "SourceUnit";
  nodes: (
    | ContractDefinition
    | EnumDefinition
    | FunctionDefinition
    | ImportDirective
    | PragmaDirective
    | StructDefinition
    | VariableDeclaration
  )[];
  src: SourceLocation;
}
export interface ExportedSymbols {
  [k: string]: number[] | undefined;
}
export interface ContractDefinition {
  abstract: boolean;
  baseContracts: InheritanceSpecifier[];
  contractDependencies: number[];
  contractKind: "contract" | "interface" | "library";
  documentation?: null | StructuredDocumentation;
  fullyImplemented: boolean;
  id: number;
  linearizedBaseContracts: number[];
  name: string;
  nodeType: "ContractDefinition";
  nodes: (
    | EnumDefinition
    | EventDefinition
    | FunctionDefinition
    | ModifierDefinition
    | StructDefinition
    | UsingForDirective
    | VariableDeclaration
  )[];
  scope: number;
  src: SourceLocation;
}
export interface InheritanceSpecifier {
  arguments?: Expression[] | null;
  baseName: UserDefinedTypeName;
  id: number;
  nodeType: "InheritanceSpecifier";
  src: SourceLocation;
}
export interface Assignment {
  argumentTypes?: null | TypeDescriptions[];
  id: number;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  leftHandSide: Expression;
  nodeType: "Assignment";
  operator: "=" | "+=" | "/=";
  rightHandSide: Expression;
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface TypeDescriptions {
  typeIdentifier?: string | null;
  typeString?: string | null;
}
export interface BinaryOperation {
  argumentTypes?: null | TypeDescriptions[];
  commonType: TypeDescriptions;
  id: number;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  leftExpression: Expression;
  nodeType: "BinaryOperation";
  operator:
    | "+"
    | "-"
    | "*"
    | "/"
    | "%"
    | "**"
    | "&&"
    | "||"
    | "!="
    | "=="
    | "<"
    | "<="
    | ">"
    | ">="
    | "^"
    | "<<"
    | ">>";
  rightExpression: Expression;
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface Conditional {
  argumentTypes?: null | TypeDescriptions[];
  condition: Expression;
  falseExpression: Expression;
  id: number;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  nodeType: "Conditional";
  src: SourceLocation;
  trueExpression: Expression;
  typeDescriptions: TypeDescriptions;
}
export interface ElementaryTypeNameExpression {
  argumentTypes?: null | TypeDescriptions[];
  id: number;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  nodeType: "ElementaryTypeNameExpression";
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
  typeName: ElementaryTypeName;
}
export interface ElementaryTypeName {
  id: number;
  name: string;
  nodeType: "ElementaryTypeName";
  src: SourceLocation;
  stateMutability?: StateMutability;
  typeDescriptions: TypeDescriptions;
}
export interface FunctionCall {
  argumentTypes?: null | TypeDescriptions[];
  arguments: Expression[];
  expression: Expression;
  id: number;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  kind: "functionCall" | "typeConversion" | "structConstructorCall";
  lValueRequested: boolean;
  names: string[];
  nodeType: "FunctionCall";
  src: SourceLocation;
  tryCall: boolean;
  typeDescriptions: TypeDescriptions;
}
export interface FunctionCallOptions {
  argumentTypes?: null | TypeDescriptions[];
  expression: Expression;
  id: number;
  isConstant: boolean;
  isLValue?: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  names: string[];
  nodeType: "FunctionCallOptions";
  options: Expression[];
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface Identifier {
  argumentTypes?: null | TypeDescriptions[];
  id: number;
  name: string;
  nodeType: "Identifier";
  overloadedDeclarations: unknown[];
  referencedDeclaration?: null | number;
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface IndexAccess {
  argumentTypes?: null | TypeDescriptions[];
  baseExpression?: Expression;
  id: number;
  indexExpression: Expression;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  nodeType: "IndexAccess";
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface Literal {
  argumentTypes?: null | TypeDescriptions[];
  hexValue: string;
  id: number;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  kind: "bool" | "number" | "string";
  lValueRequested: boolean;
  nodeType: "Literal";
  src: SourceLocation;
  subdenomination?: null;
  typeDescriptions: TypeDescriptions;
  value?: null | string;
}
export interface MemberAccess {
  argumentTypes?: null | TypeDescriptions[];
  expression: Expression;
  id: number;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  memberName?: string;
  nodeType: "MemberAccess";
  referencedDeclaration?: null | number;
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface NewExpression {
  argumentTypes?: null | TypeDescriptions[];
  id: number;
  isConstant: boolean;
  isLValue?: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  nodeType: "NewExpression";
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
  typeName: TypeName;
}
export interface ArrayTypeName {
  baseType: TypeName;
  id: number;
  length?: null | Expression;
  nodeType: "ArrayTypeName";
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface FunctionTypeName {
  id: number;
  nodeType: "FunctionTypeName";
  src: SourceLocation;
  stateMutability: StateMutability;
  typeDescriptions: TypeDescriptions;
  parameterTypes: ParameterList;
  returnParameterTypes: ParameterList;
  visibility: Visibility;
}
export interface ParameterList {
  id: number;
  nodeType: "ParameterList";
  parameters: VariableDeclaration[];
  src: SourceLocation;
}
export interface VariableDeclaration {
  constant: boolean;
  documentation?: null | StructuredDocumentation;
  functionSelector?: string;
  id: number;
  indexed?: boolean;
  mutability: Mutability;
  name: string;
  nodeType: "VariableDeclaration";
  overrides?: null;
  scope: number;
  src: SourceLocation;
  stateVariable: boolean;
  storageLocation: StorageLocation;
  typeDescriptions: TypeDescriptions;
  typeName?: TypeName | null;
  value?: Expression | null;
  visibility: Visibility;
}
export interface StructuredDocumentation {
  id: number;
  nodeType: "StructuredDocumentation";
  src: SourceLocation;
  text: string;
}
export interface Mapping {
  id: number;
  keyType: TypeName;
  nodeType: "Mapping";
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
  valueType: TypeName;
}
export interface UserDefinedTypeName {
  contractScope?: null;
  id: number;
  name: string;
  nodeType: "UserDefinedTypeName";
  referencedDeclaration: number;
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface TupleExpression {
  argumentTypes?: null | TypeDescriptions[];
  components: Expression[];
  id: number;
  isConstant: boolean;
  isInlineArray: boolean;
  isLValue: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  nodeType: "TupleExpression";
  src: SourceLocation;
  typeDescriptions: TypeDescriptions;
}
export interface UnaryOperation {
  argumentTypes?: null | TypeDescriptions[];
  id: number;
  isConstant: boolean;
  isLValue: boolean;
  isPure: boolean;
  lValueRequested: boolean;
  nodeType: "UnaryOperation";
  operator: "++" | "--" | "-" | "!" | "delete";
  prefix: boolean;
  src: SourceLocation;
  subExpression: Expression;
  typeDescriptions: TypeDescriptions;
}
export interface EnumDefinition {
  canonicalName: string;
  id: number;
  members: EnumValue[];
  name: string;
  nodeType: "EnumDefinition";
  src: SourceLocation;
}
export interface EnumValue {
  id: number;
  name: string;
  nodeType: "EnumValue";
  src: SourceLocation;
}
export interface EventDefinition {
  anonymous: boolean;
  documentation?: null | StructuredDocumentation;
  id: number;
  name: string;
  nodeType: "EventDefinition";
  parameters: ParameterList;
  src: SourceLocation;
}
export interface FunctionDefinition {
  baseFunctions?: number[];
  body?: null | Block;
  documentation?: null | StructuredDocumentation;
  functionSelector?: string;
  id: number;
  implemented: boolean;
  kind: "function" | "receive" | "constructor" | "fallback" | "freeFunction";
  modifiers: ModifierInvocation[];
  name: string;
  nodeType: "FunctionDefinition";
  overrides?: OverrideSpecifier | null;
  parameters: ParameterList;
  returnParameters: ParameterList;
  scope: number;
  src: SourceLocation;
  stateMutability: StateMutability;
  virtual: boolean;
  visibility: Visibility;
}
export interface Block {
  id: number;
  nodeType: "Block";
  src: SourceLocation;
  statements: Statement[];
}
export interface EmitStatement {
  eventCall: FunctionCall;
  id: number;
  nodeType: "EmitStatement";
  src: SourceLocation;
}
export interface ExpressionStatement {
  expression: Expression;
  id: number;
  nodeType: "ExpressionStatement";
  src: SourceLocation;
}
export interface ForStatement {
  body: Block | Statement;
  condition?: null | Expression;
  id: number;
  initializationExpression?: null | ExpressionStatement | VariableDeclarationStatement;
  loopExpression?: null | ExpressionStatement;
  nodeType: "ForStatement";
  src: SourceLocation;
}
export interface VariableDeclarationStatement {
  assignments: (null | number)[];
  declarations: (null | VariableDeclaration)[];
  id: number;
  initialValue?: Expression | null;
  nodeType: "VariableDeclarationStatement";
  src: SourceLocation;
}
export interface IfStatement {
  condition: Expression;
  falseBody?: null | Statement | Block;
  id: number;
  nodeType: "IfStatement";
  src: SourceLocation;
  trueBody: Block | Statement;
}
export interface WhileStatement {
  body: Block | Statement;
  condition: Expression;
  id: number;
  nodeType: "WhileStatement";
  src: SourceLocation;
}
export interface TryStatement {
  clauses: TryCatchClause[];
  externalCall: FunctionCall;
  id: number;
  nodeType: "TryStatement";
  src: SourceLocation;
}
export interface TryCatchClause {
  block: Block;
  errorName: string;
  id: number;
  nodeType: "TryCatchClause";
  parameters?: null | ParameterList;
  src: SourceLocation;
}
export interface InlineAssembly {
  AST: {
    [k: string]: unknown | undefined;
  };
  evmVersion:
    | "homestead"
    | "tangerineWhistle"
    | "spuriousDragon"
    | "byzantium"
    | "constantinople"
    | "petersburg"
    | "istanbul"
    | "berlin";
  externalReferences: {
    declaration: number;
    isOffset: boolean;
    isSlot: boolean;
    src: SourceLocation;
    valueSize: number;
  }[];
  id: number;
  nodeType: "InlineAssembly";
  src: SourceLocation;
}
export interface PlaceholderStatement {
  id: number;
  nodeType: "PlaceholderStatement";
  src: SourceLocation;
}
export interface Return {
  expression: Expression | null;
  functionReturnParameters: number;
  id: number;
  nodeType: "Return";
  src: SourceLocation;
}
export interface ModifierInvocation {
  arguments?: Expression[] | null;
  id: number;
  modifierName: Identifier;
  nodeType: "ModifierInvocation";
  src: SourceLocation;
}
export interface OverrideSpecifier {
  id: number;
  nodeType: "OverrideSpecifier";
  overrides: UserDefinedTypeName[];
  src: SourceLocation;
}
export interface ModifierDefinition {
  body: Block;
  documentation?: null | StructuredDocumentation;
  id: number;
  name: string;
  nodeType: "ModifierDefinition";
  overrides?: null;
  parameters: ParameterList;
  src: SourceLocation;
  virtual: boolean;
  visibility: Visibility;
}
export interface StructDefinition {
  canonicalName: string;
  id: number;
  members: VariableDeclaration[];
  name: string;
  nodeType: "StructDefinition";
  scope: number;
  src: SourceLocation;
  visibility: Visibility;
}
export interface UsingForDirective {
  id: number;
  libraryName: UserDefinedTypeName;
  nodeType: "UsingForDirective";
  src: SourceLocation;
  typeName: TypeName;
}
export interface ImportDirective {
  absolutePath: string;
  file: string;
  id: number;
  nodeType: "ImportDirective";
  scope: number;
  sourceUnit: number;
  src: SourceLocation;
  symbolAliases: {
    foreign: Identifier;
    local?: null | string;
  }[];
  unitAlias: string;
}
export interface PragmaDirective {
  id: number;
  nodeType: "PragmaDirective";
  literals: string[];
  src: SourceLocation;
}
