/* eslint-disable no-param-reassign, no-shadow, no-unused-vars, no-continue */
import { StateVariableIndicator } from '../../traverse/Indicator.js';
import MappingKey from '../../traverse/MappingKey.js';
import buildNode from '../../types/orchestration-types.js';
import { buildPrivateStateNode } from '../../boilerplate/orchestration/javascript/nodes/boilerplate-generator.js';
// below stub will only work with a small subtree - passing a whole AST will always give true!
// useful for subtrees like ExpressionStatements
const interactsWithSecretVisitor = (thisPath, thisState) => {
    var _a;
    if ((_a = thisPath.scope.getReferencedBinding(thisPath.node)) === null || _a === void 0 ? void 0 : _a.isSecret)
        thisState.interactsWithSecret = true;
};
// collects increments and decrements into a string (for new commitment calculation) and array
// (for collecting zokrates inputs)
const collectIncrements = (stateVarIndicator) => {
    const incrementsArray = [];
    let incrementsString = '';
    // TODO sometimes decrements are added to .increments
    // current fix -  prevent duplicates
    for (const inc of stateVarIndicator.increments) {
        if (!inc.name)
            inc.name = inc.value;
        if (incrementsArray.some(existingInc => inc.name === existingInc.name))
            continue;
        incrementsArray.push({
            name: inc.name,
            precedingOperator: inc.precedingOperator,
        });
        if (inc === stateVarIndicator.increments[0]) {
            incrementsString += inc.value
                ? `parseInt(${inc.name}, 10)`
                : `parseInt(${inc.name}.integer, 10)`;
        }
        else {
            incrementsString += inc.value
                ? ` ${inc.precedingOperator} parseInt(${inc.name}, 10)`
                : ` ${inc.precedingOperator} parseInt(${inc.name}.integer, 10)`;
        }
    }
    for (const dec of stateVarIndicator.decrements) {
        if (!dec.name)
            dec.name = dec.value;
        if (incrementsArray.some(existingInc => dec.name === existingInc.name))
            continue;
        incrementsArray.push({
            name: dec.name,
            precedingOperator: dec.precedingOperator,
        });
        if (!stateVarIndicator.decrements[1] && !stateVarIndicator.increments[0]) {
            incrementsString += dec.value
                ? `parseInt(${dec.name}, 10)`
                : `parseInt(${dec.name}.integer, 10)`;
        }
        else {
            // if we have decrements, this str represents the value we must take away
            // => it's a positive value with +'s
            incrementsString += dec.value
                ? ` + parseInt(${dec.name}, 10)`
                : ` + parseInt(${dec.name}.integer, 10)`;
        }
    }
    return { incrementsArray, incrementsString };
};
/**
 * @desc:
 * Visitor transforms a `.zol` AST into a `.js` AST
 * NB: the resulting `.js` AST is custom, and can only be interpreted by this
 * repo's code generator. JS compilers will not be able to interpret this
 * AST.
 */
export default {
    ContractDefinition: {
        enter(path, state) {
            const { node, parent, scope } = path;
            node._newASTPointer = parent._newASTPointer;
            const contractName = `${node.name}Shield`;
            if (scope.indicators.zkSnarkVerificationRequired) {
                const newNode = buildNode('File', {
                    fileName: 'test',
                    fileExtension: '.mjs',
                    nodes: [
                        buildNode('IntegrationTestBoilerplate', {
                            contractName,
                            contractImports: state.contractImports,
                        }),
                    ],
                });
                node._newASTPointer.push(newNode);
            }
            const newNode = buildNode('SetupCommonFilesBoilerplate', {
                contractName,
                contractImports: state.contractImports,
            });
            node._newASTPointer.push(newNode);
            if (scope.indicators.newCommitmentsRequired) {
                const newNode = buildNode('EditableCommitmentCommonFilesBoilerplate');
                node._newASTPointer.push(newNode);
            }
        },
        exit(path, state) {
            var _a;
            const { node } = path;
            for (const file of node._newASTPointer) {
                if (file.nodeType === 'SetupCommonFilesBoilerplate') {
                    file.constructorParams = state.constructorParams;
                    file.contractImports = state.contractImports;
                }
                if (((_a = file.nodes) === null || _a === void 0 ? void 0 : _a[0].nodeType) === 'IntegrationTestBoilerplate') {
                    file.nodes[0].constructorParams = state.constructorParams;
                    file.nodes[0].contractImports = state.contractImports;
                }
            }
        },
    },
    ImportDirective: {
        enter(path, state) {
            var _a;
            const { node } = path;
            (_a = state.contractImports) !== null && _a !== void 0 ? _a : (state.contractImports = []);
            state.contractImports.push({
                absolutePath: node.absolutePath,
                file: node.file,
            });
            // we assume all import statements come before all functions
        },
    },
    FunctionDefinition: {
        enter(path, state) {
            var _a, _b;
            const { node, parent, scope } = path;
            if (scope.modifiesSecretState()) {
                const contractName = `${parent.name}Shield`;
                const newNode = buildNode('File', {
                    fileName: node.name,
                    fileExtension: '.mjs',
                    nodes: [
                        buildNode('Imports'),
                        buildNode('FunctionDefinition', { name: node.name, contractName }),
                    ],
                });
                node._newASTPointer = newNode.nodes[1]; // eslint-disable-line prefer-destructuring
                parent._newASTPointer.push(newNode);
                for (const file of parent._newASTPointer) {
                    if (((_a = file.nodes) === null || _a === void 0 ? void 0 : _a[0].nodeType) === 'IntegrationTestBoilerplate') {
                        file.nodes[0].functions.push(buildNode('IntegrationTestFunction', {
                            name: node.name,
                            parameters: [],
                        }));
                    }
                }
            }
            else {
                state.skipSubNodes = true;
                if (node.kind === 'constructor') {
                    (_b = state.constructorParams) !== null && _b !== void 0 ? _b : (state.constructorParams = []);
                    for (const param of node.parameters.parameters) {
                        state.constructorParams.push(buildNode('VariableDeclaration', {
                            name: param.name,
                            type: param.typeName.name,
                            isSecret: param.isSecret,
                            modifiesSecretState: false,
                        }));
                    }
                }
            }
        },
        exit(path, state) {
            var _a, _b, _c;
            var _d, _e;
            const { node, parent, scope } = path;
            (_a = (_d = node._newASTPointer).msgSenderParam) !== null && _a !== void 0 ? _a : (_d.msgSenderParam = state.msgSenderParam);
            const initialiseOrchestrationBoilerplateNodes = (fnIndicator) => {
                const newNodes = {};
                const contractName = `${parent.name}Shield`;
                newNodes.InitialiseKeysNode = buildNode('InitialiseKeys', {
                    contractName,
                    onChainKeyRegistry: fnIndicator.onChainKeyRegistry,
                });
                if (fnIndicator.initialisationRequired)
                    newNodes.initialisePreimageNode = buildNode('InitialisePreimage');
                newNodes.readPreimageNode = buildNode('ReadPreimage');
                if (fnIndicator.nullifiersRequired) {
                    newNodes.membershipWitnessNode = buildNode('MembershipWitness', {
                        contractName,
                    });
                    newNodes.calculateNullifierNode = buildNode('CalculateNullifier');
                }
                if (fnIndicator.newCommitmentsRequired)
                    newNodes.calculateCommitmentNode = buildNode('CalculateCommitment');
                newNodes.generateProofNode = buildNode('GenerateProof', {
                    circuitName: node.name,
                });
                newNodes.sendTransactionNode = buildNode('SendTransaction', {
                    functionName: node.name,
                    contractName,
                });
                newNodes.writePreimageNode = buildNode('WritePreimage', {
                    contractName,
                    onChainKeyRegistry: fnIndicator.onChainKeyRegistry,
                });
                return newNodes;
            };
            // By this point, we've added a corresponding FunctionDefinition node to the newAST, with the same nodes as the original Solidity function, with some renaming here and there, and stripping out unused data from the oldAST.
            const functionIndicator = scope.indicators;
            let thisIntegrationTestFunction = {};
            for (const file of parent._newASTPointer) {
                if (((_b = file.nodes) === null || _b === void 0 ? void 0 : _b[0].nodeType) === 'IntegrationTestBoilerplate') {
                    for (const fn of file.nodes[0].functions) {
                        if (fn.name === node.name)
                            thisIntegrationTestFunction = fn;
                    }
                }
                if (file.nodeType === 'SetupCommonFilesBoilerplate') {
                    file.functionNames.push(node.name);
                }
            }
            thisIntegrationTestFunction.parameters = node._newASTPointer.parameters;
            thisIntegrationTestFunction.newCommitmentsRequired =
                functionIndicator.newCommitmentsRequired;
            if ((functionIndicator.newCommitmentsRequired ||
                functionIndicator.nullifiersRequired) &&
                scope.modifiesSecretState()) {
                const newNodes = initialiseOrchestrationBoilerplateNodes(functionIndicator);
                // 1 - InitialisePreimage - whole states - per state
                // 2 - ReadPreimage - oldCommitmentAccessRequired - per state
                // 3 - MembershipWitness - nullifiersRequired - per state
                // 4 - CalculateNullifier - nullifiersRequired - per state
                // 5 - CalculateCommitment - newCommitmentsRequired - per state
                // 6 - GenerateProof - all - per function
                if (state.msgSenderParam) {
                    newNodes.generateProofNode.parameters.push(`msgSender`);
                    delete state.msgSenderParam; // reset
                }
                // 7 - SendTransaction - all - per function
                // 8 - WritePreimage - all - per state
                // this only includes accessed states which are not modified
                const accessedStateIndicators = [];
                const modifiedStateVariableIndicators = []; // array of StateVarIndicator or MappingKey
                let stateVarIndicator;
                for ([, stateVarIndicator] of Object.entries(functionIndicator)) {
                    if ((stateVarIndicator === null || stateVarIndicator === void 0 ? void 0 : stateVarIndicator.isAccessed) && !(stateVarIndicator === null || stateVarIndicator === void 0 ? void 0 : stateVarIndicator.isModified)) {
                        if (stateVarIndicator.isMapping) {
                            for (const [, mappingKey] of Object.entries(stateVarIndicator.mappingKeys)) {
                                accessedStateIndicators.push(mappingKey);
                            }
                        }
                        else {
                            accessedStateIndicators.push(stateVarIndicator);
                        }
                        continue;
                    }
                    if (!(stateVarIndicator === null || stateVarIndicator === void 0 ? void 0 : stateVarIndicator.isSecret) || !(stateVarIndicator === null || stateVarIndicator === void 0 ? void 0 : stateVarIndicator.isModified))
                        continue;
                    if (stateVarIndicator.isMapping) {
                        for (const [, mappingKey] of Object.entries(stateVarIndicator.mappingKeys)) {
                            modifiedStateVariableIndicators.push(mappingKey);
                        }
                    }
                    else {
                        modifiedStateVariableIndicators.push(stateVarIndicator);
                    }
                }
                for (stateVarIndicator of modifiedStateVariableIndicators) {
                    let id = stateVarIndicator.id;
                    let { name, isIncremented } = stateVarIndicator;
                    if (stateVarIndicator instanceof MappingKey) {
                        id = [id, stateVarIndicator.referencedKeyName];
                        name = name
                            .replace('[', '_')
                            .replace(']', '')
                            .replace('.sender', '');
                    }
                    let { incrementsArray, incrementsString } = isIncremented
                        ? collectIncrements(stateVarIndicator)
                        : { incrementsArray: null, incrementsString: null };
                    if (!incrementsString)
                        incrementsString = null;
                    if (!incrementsArray)
                        incrementsArray = null;
                    if (stateVarIndicator.isDecremented) {
                        // TODO refactor
                        (_c = (_e = node._newASTPointer).decrementedSecretStates) !== null && _c !== void 0 ? _c : (_e.decrementedSecretStates = []);
                        node._newASTPointer.decrementedSecretStates.push(name);
                        node._newASTPointer.decrementsSecretState = true;
                        thisIntegrationTestFunction.decrementsSecretState = true;
                    }
                    const modifiedStateVariableNode = buildNode('VariableDeclaration', {
                        name,
                        isSecret: stateVarIndicator.isSecret,
                        type: stateVarIndicator.node.typeDescriptions.typeString,
                    });
                    node._newASTPointer.parameters.modifiedStateVariables.push(modifiedStateVariableNode);
                    if (stateVarIndicator.isWhole &&
                        functionIndicator.initialisationRequired) {
                        newNodes.initialisePreimageNode.privateStates[name] = buildPrivateStateNode('InitialisePreimage', {
                            privateStateName: name,
                            indicator: stateVarIndicator,
                        });
                    }
                    newNodes.readPreimageNode.privateStates[name] = buildPrivateStateNode('ReadPreimage', {
                        id,
                        increment: isIncremented ? incrementsString : undefined,
                        indicator: stateVarIndicator,
                        reinitialisedOnly: stateVarIndicator.reinitialisable &&
                            !stateVarIndicator.isNullified,
                    });
                    if (stateVarIndicator.isNullified) {
                        newNodes.membershipWitnessNode.privateStates[name] = buildPrivateStateNode('MembershipWitness', {
                            privateStateName: name,
                            indicator: stateVarIndicator,
                        });
                        newNodes.calculateNullifierNode.privateStates[name] = buildPrivateStateNode('CalculateNullifier', {
                            indicator: stateVarIndicator,
                        });
                    }
                    if (stateVarIndicator.newCommitmentsRequired) {
                        newNodes.calculateCommitmentNode.privateStates[name] = buildPrivateStateNode('CalculateCommitment', {
                            privateStateName: name,
                            id,
                            indicator: stateVarIndicator,
                        });
                    }
                    if (stateVarIndicator.isModified) {
                        newNodes.generateProofNode.privateStates[name] = buildPrivateStateNode('GenerateProof', {
                            privateStateName: name,
                            id,
                            reinitialisedOnly: stateVarIndicator.reinitialisable &&
                                !stateVarIndicator.isNullified,
                            burnedOnly: stateVarIndicator.isBurned &&
                                !stateVarIndicator.newCommitmentsRequired,
                            increment: isIncremented ? incrementsArray : undefined,
                            indicator: stateVarIndicator,
                        });
                        newNodes.generateProofNode.parameters.push(name);
                        newNodes.sendTransactionNode.privateStates[name] = buildPrivateStateNode('SendTransaction', {
                            indicator: stateVarIndicator,
                        });
                        newNodes.writePreimageNode.privateStates[name] = buildPrivateStateNode('WritePreimage', {
                            id,
                            indicator: stateVarIndicator,
                            burnedOnly: stateVarIndicator.isBurned &&
                                !stateVarIndicator.newCommitmentsRequired,
                        });
                    }
                }
                for (const stateVarIndicator of accessedStateIndicators) {
                    // these ONLY require :
                    // Init and ReadPreimage
                    // MembershipWitness
                    // CalculateNullifier
                    // GenerateProof
                    // SendTransaction
                    let { name, id } = stateVarIndicator;
                    if (stateVarIndicator.isMapping) {
                        id = [id, stateVarIndicator.referencedKeyName];
                        name = name
                            .replace('[', '_')
                            .replace(']', '')
                            .replace('.sender', '');
                    }
                    newNodes.initialisePreimageNode.privateStates[name] = {
                        privateStateName: name,
                        accessedOnly: true,
                    };
                    newNodes.readPreimageNode.privateStates[name] = buildPrivateStateNode('ReadPreimage', {
                        id,
                        indicator: stateVarIndicator,
                        accessedOnly: true,
                    });
                    newNodes.membershipWitnessNode.privateStates[name] = buildPrivateStateNode('MembershipWitness', {
                        privateStateName: name,
                        indicator: stateVarIndicator,
                        accessedOnly: true,
                    });
                    newNodes.calculateNullifierNode.privateStates[name] = buildPrivateStateNode('CalculateNullifier', {
                        indicator: stateVarIndicator,
                    });
                    newNodes.generateProofNode.privateStates[name] = buildPrivateStateNode('GenerateProof', {
                        privateStateName: name,
                        id,
                        accessedOnly: true,
                        indicator: stateVarIndicator,
                    });
                    // newNodes.generateProofNode.parameters.push(name);
                    newNodes.sendTransactionNode.privateStates[name] = buildPrivateStateNode('SendTransaction', {
                        indicator: stateVarIndicator,
                        accessedOnly: true,
                    });
                }
                // this adds other values we need in the circuit
                for (const param of node._newASTPointer.parameters.parameters) {
                    if (param.isPrivate || param.isSecret || param.interactsWithSecret)
                        newNodes.generateProofNode.parameters.push(param.name);
                }
                // this adds other values we need in the tx
                for (const param of node.parameters.parameters) {
                    if (!param.isSecret)
                        newNodes.sendTransactionNode.publicInputs.push(param.name);
                }
                // the newNodes array is already ordered, however we need the initialisePreimageNode & InitialiseKeysNode before any copied over statements
                if (newNodes.initialisePreimageNode)
                    node._newASTPointer.body.statements.splice(0, 0, newNodes.initialisePreimageNode);
                node._newASTPointer.body.statements.splice(0, 0, newNodes.InitialiseKeysNode);
                // 1 - InitialisePreimage - whole states - per state
                // 2 - ReadPreimage - oldCommitmentAccessRequired - per state
                // 3 - MembershipWitness - nullifiersRequired - per state
                // 4 - CalculateNullifier - nullifiersRequired - per state
                // 5 - CalculateCommitment - newCommitmentsRequired - per state
                // 6 - GenerateProof - all - per function
                // 7 - SendTransaction - all - per function
                // 8 - WritePreimage - all - per state
                if (newNodes.readPreimageNode)
                    node._newASTPointer.body.statements.push(newNodes.readPreimageNode);
                if (newNodes.membershipWitnessNode)
                    node._newASTPointer.body.statements.push(newNodes.membershipWitnessNode);
                if (newNodes.calculateNullifierNode)
                    node._newASTPointer.body.statements.push(newNodes.calculateNullifierNode);
                if (newNodes.calculateCommitmentNode)
                    node._newASTPointer.body.statements.push(newNodes.calculateCommitmentNode);
                if (newNodes.generateProofNode)
                    node._newASTPointer.body.statements.push(newNodes.generateProofNode);
                if (newNodes.sendTransactionNode)
                    node._newASTPointer.body.statements.push(newNodes.sendTransactionNode);
                if (newNodes.writePreimageNode)
                    node._newASTPointer.body.statements.push(newNodes.writePreimageNode);
            }
        },
    },
    ParameterList: {
        enter(path) {
            const { node, parent } = path;
            const newNode = buildNode(node.nodeType);
            node._newASTPointer = newNode.parameters;
            parent._newASTPointer[path.containerName] = newNode;
        },
    },
    Block: {
        enter(path) {
            const { node, parent } = path;
            const newNode = buildNode(node.nodeType);
            node._newASTPointer = newNode.statements;
            parent._newASTPointer.body = newNode;
        },
    },
    VariableDeclarationStatement: {
        enter(path) {
            const { node, parent } = path;
            const newNode = buildNode(node.nodeType);
            node._newASTPointer = newNode;
            parent._newASTPointer.push(newNode);
        },
    },
    BinaryOperation: {
        enter(path) {
            const { node, parent } = path;
            const newNode = buildNode(node.nodeType, { operator: node.operator });
            node._newASTPointer = newNode;
            parent._newASTPointer[path.containerName] = newNode;
        },
    },
    Assignment: {
        enter(path) {
            const { node, parent } = path;
            const newNode = buildNode(node.nodeType, { operator: node.operator });
            node._newASTPointer = newNode;
            if (parent._newASTPointer.nodeType === 'VariableDeclarationStatement') {
                parent._newASTPointer.initialValue = newNode;
            }
            else {
                parent._newASTPointer.expression = newNode;
            }
        },
    },
    ExpressionStatement: {
        enter(path, state) {
            var _a;
            // We sometimes do need to copy over statements if we need to work out the new commitment value
            // e.g. secret x; x = y +2 => we need to copy over this line to the node file to construct the new commitment
            const { node, parent, scope } = path;
            const newState = {};
            path.traversePathsFast(interactsWithSecretVisitor, newState);
            const { interactsWithSecret } = newState;
            // we mark this to grab anything we need from the db / contract
            state.interactsWithSecret = interactsWithSecret;
            // ExpressionStatements can contain an Assignment node.
            if (node.expression.nodeType === 'Assignment') {
                let { leftHandSide: lhs } = node.expression;
                const indicator = scope.getReferencedIndicator(lhs, true);
                if (indicator.isMapping) {
                    lhs = lhs.baseExpression;
                }
                // We should only replace the _first_ assignment to this node. Let's look at the scope's modifiedBindings for any prior modifications to this binding:
                // if its secret and this is the first assigment, we add a vardec
                if (indicator.modifyingPaths[0].node.id === lhs.id &&
                    indicator.isSecret &&
                    indicator.isWhole) {
                    let accessed = false;
                    (_a = indicator.accessedPaths) === null || _a === void 0 ? void 0 : _a.forEach(obj => {
                        if (obj.getAncestorOfType('ExpressionStatement').node.id === node.id)
                            accessed = true;
                    });
                    const newNode = buildNode('VariableDeclarationStatement', {
                        declarations: [
                            buildNode('VariableDeclaration', {
                                name: lhs.name,
                                isAccessed: accessed,
                                isSecret: true,
                            }),
                        ],
                        interactsWithSecret: true,
                    });
                    node._newASTPointer = newNode;
                    parent._newASTPointer.push(newNode);
                    return;
                }
                // if its an incrementation, we need to know it happens but not copy it over
                if (node.expression.isIncremented && indicator.isPartitioned) {
                    const name = indicator.isMapping
                        ? indicator.name
                            .replace('[', '_')
                            .replace(']', '')
                            .replace('.sender', '')
                        : indicator.name;
                    const newNode = buildNode(node.nodeType, {
                        nodeType: node.nodeType,
                        interactsWithSecret,
                        expression: {},
                        incrementsSecretState: node.expression.isIncremented,
                        decrementsSecretState: node.expression.isDecremented,
                        privateStateName: name,
                    });
                    node._newASTPointer = newNode;
                    parent._newASTPointer.push(newNode);
                    // state.skipSubNodes = true;
                    return;
                }
            }
            if (node.expression.nodeType !== 'FunctionCall') {
                const newNode = buildNode(node.nodeType, {
                    interactsWithSecret,
                });
                node._newASTPointer = newNode;
                parent._newASTPointer.push(newNode);
            }
        },
        exit(path, state) {
            var _a;
            const { node, scope } = path;
            const { leftHandSide: lhs } = node.expression;
            // reset
            delete state.interactsWithSecret;
            if ((_a = path.node._newASTPointer) === null || _a === void 0 ? void 0 : _a.incrementsSecretState) {
                const indicator = scope.getReferencedIndicator(lhs, true);
                const increments = collectIncrements(indicator).incrementsString;
                path.node._newASTPointer.increments = increments;
            }
        },
    },
    VariableDeclaration: {
        enter(path, state) {
            const { node, parent, scope } = path;
            if (node.stateVariable) {
                // then the node represents assignment of a state variable - we've handled it.
                node._newASTPointer = parent._newASTPointer;
                state.skipSubNodes = true;
                return;
            }
            // we now have a param or a local var dec
            // TODO just use interactsWithSecret when thats added
            let interactsWithSecret = false;
            scope.bindings[node.id].referencingPaths.forEach(refPath => {
                const newState = {};
                refPath.parentPath.traversePathsFast(interactsWithSecretVisitor, newState);
                interactsWithSecret || (interactsWithSecret = newState.interactsWithSecret);
            });
            if (parent.nodeType === 'VariableDeclarationStatement' &&
                interactsWithSecret)
                parent._newASTPointer.interactsWithSecret = interactsWithSecret;
            // if it's not declaration of a state variable, it's (probably) declaration of a new function parameter. We _do_ want to add this to the newAST.
            const newNode = buildNode(node.nodeType, {
                name: node.name,
                isSecret: node.isSecret || false,
                interactsWithSecret,
                typeName: {},
            });
            node._newASTPointer = newNode;
            if (Array.isArray(parent._newASTPointer)) {
                parent._newASTPointer.push(newNode);
            }
            else {
                parent._newASTPointer[path.containerName].push(newNode);
            }
        },
    },
    ElementaryTypeName: {
        enter(path) {
            const { node, parent } = path;
            const newNode = buildNode(node.nodeType, { name: node.name });
            parent._newASTPointer[path.containerName] = newNode;
        },
    },
    ElementaryTypeNameExpression: {
        enter(path, state) {
            const { node, parent } = path;
            const newNode = buildNode('ElementaryTypeName', {
                name: node.typeName.name,
            });
            parent._newASTPointer[path.containerName] = newNode;
            state.skipSubNodes = true; // the subnodes are ElementaryTypeNames
        },
    },
    Identifier: {
        enter(path, state) {
            var _a;
            var _b;
            const { node, parent, scope } = path;
            const newNode = buildNode(node.nodeType, {
                name: node.name,
                subType: node.typeDescriptions.typeString,
            });
            const indicator = scope.getReferencedIndicator(node);
            const fnDefNode = path.getAncestorOfType('FunctionDefinition');
            parent._newASTPointer[path.containerName] = newNode;
            // we may need this identifier in the mjs file to edit a secret state
            // we check this here
            if (state.interactsWithSecret && // we only need to import something if it interactsWithSecret
                !path.isFunctionParameter() && // we already deal with params
                indicator instanceof StateVariableIndicator && // we can't import local variables
                ((indicator.isSecret && !indicator.isModified) || !indicator.isSecret) // we already deal with secret modified states
            ) {
                (_a = (_b = fnDefNode.node._newASTPointer.parameters).importedStateVariables) !== null && _a !== void 0 ? _a : (_b.importedStateVariables = []);
                node.isSecret = indicator.isSecret;
                fnDefNode.node._newASTPointer.parameters.importedStateVariables.push(node);
            }
        },
    },
    IndexAccess: {
        enter(path, state) {
            const { node, parent, scope } = path;
            const indicator = scope.getReferencedIndicator(node, true);
            const name = indicator.name
                .replace('[', '_')
                .replace(']', '')
                .replace('.sender', '');
            const newNode = buildNode('Identifier', {
                name,
                subType: node.typeDescriptions.typeString,
            });
            state.skipSubNodes = true; // the subnodes are baseExpression and indexExpression - we skip them
            parent._newASTPointer[path.containerName] = newNode;
        },
    },
    MemberAccess: {
        enter(path, state) {
            const { node, parent } = path;
            if (path.isMsgSender()) {
                const newNode = buildNode('MsgSender');
                state.skipSubNodes = true;
                parent._newASTPointer[path.containerName] = newNode;
                const newState = {};
                path.parentPath.traversePathsFast(interactsWithSecretVisitor, newState);
                if (newState.interactsWithSecret)
                    state.msgSenderParam = true;
                return;
            }
            const newNode = buildNode(node.nodeType, { name: node.memberName });
            node._newASTPointer = newNode;
            parent._newASTPointer[path.containerName] = newNode;
        },
    },
    Literal: {
        enter(path) {
            const { node, parent } = path;
            const newNode = buildNode(node.nodeType, { value: node.value });
            parent._newASTPointer[path.containerName] = newNode;
        },
    },
    FunctionCall: {
        enter(path, state) {
            const { node, parent } = path;
            if (node.kind !== 'typeConversion') {
                state.skipSubNodes = true;
                return;
            }
            const newNode = buildNode('TypeConversion', {
                type: node.typeDescriptions.typeString,
            });
            node._newASTPointer = newNode;
            parent._newASTPointer[path.containerName] = newNode;
        },
    },
};
