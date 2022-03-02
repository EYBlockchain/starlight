/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */
/**
 * @desc:
 * TEMPLATE - for easy copy-pasting to start building a new visitor.
*/
export default {
    SourceUnit: {
        enter(path, state) { },
        exit(path, state) { },
    },
    PragmaDirective: {
        enter(path, state) { },
        exit(path, state) { },
    },
    ContractDefinition: {
        enter(path, state) { },
        exit(path, state) { },
    },
    FunctionDefinition: {
        enter(path, state) { },
        exit(path, state) { },
    },
    ParameterList: {
        enter(path) { },
        exit(path) { },
    },
    Block: {
        enter(path) { },
        exit(path) { },
    },
    VariableDeclarationStatement: {
        enter(path) { },
        exit(path) { },
    },
    BinaryOperation: {
        enter(path) { },
        exit(path) { },
    },
    Assignment: {
        enter(path, state) { },
        exit(path, state) { },
    },
    ExpressionStatement: {
        enter(path, state) { },
        exit(node, parent) { },
    },
    VariableDeclaration: {
        enter(path, state) { },
        exit(path) { },
    },
    ElementaryTypeName: {
        enter(path) { },
        exit(path) { },
    },
    Identifier: {
        enter(path) { },
        exit(path) { },
    },
    Literal: {
        enter(path) { },
        exit(path) { },
    },
};
