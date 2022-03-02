/* eslint-disable no-param-reassign */
/**
 * @desc:
 * EXAMPLE ONLY
 * @deprecated - some of the logic here is now out of date and won't work.
*/
const getNodeLocation = () => { }; // dummy - the original getNodeLocation has been removed.
export default {
    PragmaDirective: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
            };
            // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
            parent._newASTPointer.push(newNode);
        },
        exit(node, parent) { },
    },
    ContractDefinition: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                nodes: [],
            };
            node._newASTPointer = newNode.nodes;
            parent._newASTPointer.push(newNode);
        },
        exit(node, parent) { },
    },
    FunctionDefinition: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                parameters: {},
                returnParameters: {},
                body: {},
            };
            // node._newASTPointer = {};
            // node._newASTPointer.parameters = newNode.parameters;
            // node._newASTPointer.returnParameters = newNode.returnParameters;
            // node._newASTPointer.body = newNode.body;
            // node._newASTPointer = {};
            // node._newASTPointer.parameters = property(newNode, 'parameters');
            // node._newASTPointer.returnParameters = property(newNode, 'returnParameters');
            // node._newASTPointer.body = property(newNode, 'body');
            node._newASTPointer = newNode;
            parent._newASTPointer.push(newNode);
        },
        exit(node, parent) { },
    },
    ParameterList: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                parameters: [],
            };
            node._newASTPointer = newNode.parameters;
            const { containerName } = getNodeLocation();
            parent._newASTPointer[containerName] = newNode;
        },
        exit(node, parent) { },
    },
    Block: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                statements: [],
            };
            node._newASTPointer = newNode.statements;
            parent._newASTPointer.body = newNode;
        },
        exit(node, parent) { },
    },
    VariableDeclarationStatement: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                declarations: [],
                initialValue: {},
            };
            node._newASTPointer = newNode;
            parent._newASTPointer.push(newNode);
        },
        exit(node, parent) { },
    },
    BinaryOperation: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                leftExpression: {},
                rightExpression: {},
            };
            node._newASTPointer = newNode;
            const { containerName } = getNodeLocation();
            parent._newASTPointer[containerName] = newNode;
        },
        exit(node, parent) { },
    },
    Assignment: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                leftHandSide: {},
                rightHandSide: {},
            };
            node._newASTPointer = newNode;
            parent._newASTPointer.expression = newNode;
        },
        exit(node, parent) { },
    },
    ExpressionStatement: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                expression: {},
            };
            node._newASTPointer = newNode;
            parent._newASTPointer.push(newNode);
        },
        exit(node, parent) { },
    },
    VariableDeclaration: {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
                typeName: {},
            };
            node._newASTPointer = newNode;
            if (Array.isArray(parent._newASTPointer)) {
                parent._newASTPointer.push(newNode);
            }
            else {
                const { containerName } = getNodeLocation();
                parent._newASTPointer[containerName].push(newNode);
            }
        },
        exit(node, parent) { },
    },
    'Identifier|Literal|ElementaryTypeName': {
        enter(node, parent) {
            const newNode = {
                nodeType: node.nodeType,
            };
            // node._newASTPointer = // no context needed, because this is a leaf, so we won't be recursing any further.
            const { containerName } = getNodeLocation();
            parent._newASTPointer[containerName] = newNode;
        },
        exit(node, parent) { },
    },
};
