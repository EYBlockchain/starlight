"use strict";
/* eslint-disable consistent-return, no-param-reassign */
exports.__esModule = true;
exports.buildNode = exports.getVisitableKeys = void 0;
var ContractBoilerplateGenerator_mjs_1 = require("../boilerplate/contract/solidity/nodes/ContractBoilerplateGenerator.mjs");
var FunctionBoilerplateGenerator_mjs_1 = require("../boilerplate/contract/solidity/nodes/FunctionBoilerplateGenerator.mjs");
function getVisitableKeys(nodeType) {
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
        case 'ArrayTypeName':
            return ['baseType'];
        case 'ElementaryTypeNameExpression':
            return ['typeName'];
        case 'PragmaDirective':
        case 'ElementaryTypeName':
        case 'Identifier':
        case 'Literal':
        case 'UserDefinedTypeName':
        case 'ImportDirective':
            return [];
        // And again, if we haven't recognized the nodeType then we'll throw an
        // error.
        default:
            throw new TypeError(nodeType);
    }
}
exports.getVisitableKeys = getVisitableKeys;
/**
 * @param {string} nodeType - the type of node you'd like to build
 * @param {Object} fields - important key, value pairs to include in the node, and which enable the rest of the node's info to be derived. How do you know which data to include in `fields`? Read this function.
 */
function buildNode(nodeType, fields) {
    if (fields === void 0) { fields = {}; }
    switch (nodeType) {
        case 'SourceUnit': {
            var name_1 = fields.name, license = fields.license, _a = fields.nodes, nodes = _a === void 0 ? [] : _a;
            return {
                nodeType: nodeType,
                name: name_1,
                license: license,
                nodes: nodes
            };
        }
        case 'File': {
            var fileName = fields.fileName, _b = fields.nodes, nodes = _b === void 0 ? [] : _b;
            return {
                nodeType: nodeType,
                fileName: fileName,
                fileExtension: '.zok',
                nodes: nodes
            };
        }
        case 'PragmaDirective': {
            var literals = fields.literals;
            return {
                nodeType: nodeType,
                literals: literals
            };
        }
        case 'InheritanceSpecifier': {
            var name_2 = fields.name;
            return {
                nodeType: nodeType,
                baseName: { name: name_2 }
            };
        }
        case 'ImportStatementList': {
            var _c = fields.imports, imports = _c === void 0 ? [] : _c;
            return {
                nodeType: nodeType,
                imports: imports
            };
        }
        case 'ImportDirective': {
            var file = fields.file;
            return {
                nodeType: nodeType,
                file: file
            };
        }
        case 'ContractDefinition': {
            var name_3 = fields.name, _d = fields.baseContracts, baseContracts = _d === void 0 ? [] : _d, _e = fields.nodes, nodes = _e === void 0 ? [] : _e, isShieldContract = fields.isShieldContract;
            return {
                nodeType: nodeType,
                name: name_3,
                baseContracts: baseContracts,
                nodes: nodes,
                isShieldContract: isShieldContract
            };
        }
        case 'FunctionDefinition': {
            var name_4 = fields.name, visibility = fields.visibility, isConstructor = fields.isConstructor, _f = fields.body, body = _f === void 0 ? buildNode('Block') : _f, _g = fields.parameters, parameters = _g === void 0 ? buildNode('ParameterList') : _g;
            return {
                nodeType: nodeType,
                name: name_4,
                visibility: visibility,
                isConstructor: isConstructor,
                body: body,
                parameters: parameters
            };
        }
        case 'ParameterList': {
            var _h = fields.parameters, parameters = _h === void 0 ? [] : _h;
            return {
                nodeType: nodeType,
                parameters: parameters
            };
        }
        case 'Block': {
            var _j = fields.preStatements, preStatements = _j === void 0 ? [] : _j, _k = fields.statements, statements = _k === void 0 ? [] : _k, _l = fields.postStatements, postStatements = _l === void 0 ? [] : _l;
            return {
                nodeType: nodeType,
                preStatements: preStatements,
                statements: statements,
                postStatements: postStatements
            };
        }
        case 'VariableDeclaration': {
            var name_5 = fields.name, typeString = fields.typeString, visibility = fields.visibility, storageLocation = fields.storageLocation, isSecret = fields.isSecret, declarationType = fields.declarationType;
            return {
                nodeType: nodeType,
                name: name_5,
                visibility: visibility,
                storageLocation: storageLocation,
                typeDescriptions: { typeString: typeString },
                typeName: buildNode('ElementaryTypeName', {
                    typeDescriptions: { typeString: typeString }
                }),
                isSecret: isSecret,
                declarationType: declarationType
            };
        }
        case 'BinaryOperation': {
            var _m = fields.leftExpression, leftExpression = _m === void 0 ? {} : _m, operator = fields.operator, _o = fields.rightExpression, rightExpression = _o === void 0 ? {} : _o;
            return {
                nodeType: nodeType,
                leftExpression: leftExpression,
                operator: operator,
                rightExpression: rightExpression
            };
        }
        case 'Assignment': {
            var _p = fields.leftHandSide, leftHandSide = _p === void 0 ? {} : _p, operator = fields.operator, _q = fields.rightHandSide, rightHandSide = _q === void 0 ? {} : _q;
            return {
                nodeType: nodeType,
                operator: operator,
                leftHandSide: leftHandSide,
                rightHandSide: rightHandSide
            };
        }
        case 'Mapping': {
            var _r = fields.keyType, keyType = _r === void 0 ? {} : _r, _s = fields.valueType, valueType = _s === void 0 ? {} : _s, _t = fields.typeDescriptions, typeDescriptions = _t === void 0 ? {} : _t;
            return {
                nodeType: nodeType,
                keyType: keyType,
                valueType: valueType,
                typeDescriptions: typeDescriptions
            };
        }
        // 'MappingDeclaration' is a made-up nodeType, for convenient creation of a Mapping node within a VariableDeclaration node
        case 'MappingDeclaration': {
            var name_6 = fields.name, fromType = fields.fromType, toType = fields.toType, visibility = fields.visibility, storageLocation = fields.storageLocation;
            return buildNode('VariableDeclaration', {
                name: name_6,
                visibility: visibility,
                storageLocation: storageLocation,
                typeName: buildNode('Mapping', {
                    keyType: buildNode('ElementaryTypeName', {
                        name: fromType,
                        typeDescriptions: {
                            typeString: fromType
                        }
                    }),
                    valueType: buildNode('ElementaryTypeName', {
                        name: toType,
                        typeDescriptions: {
                            typeString: toType
                        }
                    }),
                    typeDescriptions: {
                        typeString: "mapping(".concat(fromType, " => ").concat(toType, ")")
                    }
                })
            });
        }
        case 'VariableDeclarationStatement': {
            var _u = fields.declarations, declarations = _u === void 0 ? [] : _u, _v = fields.initialValue, initialValue = _v === void 0 ? {} : _v;
            return {
                nodeType: nodeType,
                declarations: declarations,
                initialValue: initialValue
            };
        }
        case 'ExpressionStatement': {
            var _w = fields.expression, expression = _w === void 0 ? {} : _w;
            return {
                nodeType: nodeType,
                expression: expression
            };
        }
        case 'UnaryOperation': {
            var operator = fields.operator, prefix = fields.prefix, _x = fields.subExpression, subExpression = _x === void 0 ? {} : _x;
            return {
                nodeType: nodeType,
                operator: operator,
                prefix: prefix,
                subExpression: subExpression
            };
        }
        case 'ElementaryTypeName': {
            var typeDescriptions = fields.typeDescriptions;
            return {
                nodeType: nodeType,
                typeDescriptions: typeDescriptions
            };
        }
        case 'FunctionCall': {
            var _y = fields.expression, expression = _y === void 0 ? {} : _y, _z = fields.arguments, args = _z === void 0 ? [] : _z;
            return {
                nodeType: nodeType,
                expression: expression,
                arguments: args
            };
        }
        case 'IndexAccess': {
            var _0 = fields.baseExpression, baseExpression = _0 === void 0 ? {} : _0, _1 = fields.indexExpression, indexExpression = _1 === void 0 ? {} : _1;
            return {
                nodeType: nodeType,
                baseExpression: baseExpression,
                indexExpression: indexExpression
            };
        }
        case 'MemberAccess': {
            var _2 = fields.expression, expression = _2 === void 0 ? {} : _2, memberName = fields.memberName;
            return {
                nodeType: nodeType,
                memberName: memberName,
                expression: expression
            };
        }
        case 'MsgSender': {
            return {
                nodeType: nodeType
            };
        }
        case 'Identifier': {
            var name_7 = fields.name;
            return {
                nodeType: nodeType,
                name: name_7
            };
        }
        case 'Literal': {
            var value = fields.value, kind = fields.kind;
            return {
                nodeType: nodeType,
                value: value,
                kind: kind
            };
        }
        case 'ElementaryTypeNameExpression': {
            var _3 = fields.typeName, typeName = _3 === void 0 ? {} : _3;
            return {
                nodeType: nodeType,
                typeName: typeName
            };
        }
        case 'ContractBoilerplate': {
            // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
            var scope = fields.scope, bpSection = fields.bpSection;
            var bp = new ContractBoilerplateGenerator_mjs_1["default"](scope);
            return bp.getBoilerplate(bpSection);
        }
        case 'FunctionBoilerplate': {
            // This nodeType will be understood by the codeGenerator, where raw boilerplate code will be inserted.
            var scope = fields.scope, bpSection = fields.bpSection;
            var bp = new FunctionBoilerplateGenerator_mjs_1["default"](scope);
            return bp.getBoilerplate(bpSection);
        }
        // Boilerplate nodeTypes will be understood by the codeGenerator, where raw boilerplate code will be inserted.
        case 'ShieldContractConstructorBoilerplate': {
            return { nodeType: nodeType };
        }
        case 'ShieldContractVerifierInterfaceBoilerplate': {
            return { nodeType: nodeType };
        }
        case 'requireNewNullifiersNotInNullifiersThenAddThemBoilerplate': {
            return { nodeType: nodeType };
        }
        case 'requireCommitmentRootInCommitmentRootsBoilerplate': {
            return { nodeType: nodeType };
        }
        case 'verifyBoilerplate': {
            return { nodeType: nodeType };
        }
        case 'insertLeavesBoilerplate': {
            return { nodeType: nodeType };
        }
        default:
            throw new TypeError(nodeType);
    }
}
exports.buildNode = buildNode;
exports["default"] = { buildNode: buildNode };
