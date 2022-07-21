/* eslint-disable no-param-reassign, no-shadow, no-unused-vars, no-continue */
import NodePath from '../../traverse/NodePath.js';
import { StateVariableIndicator, FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import { VariableBinding } from '../../traverse/Binding.js';
import MappingKey from '../../traverse/MappingKey.js';
import cloneDeep from 'lodash.clonedeep';
import buildNode from '../../types/orchestration-types.js';
import { buildPrivateStateNode } from '../../boilerplate/orchestration/javascript/nodes/boilerplate-generator.js';
import explode from './explode.js';
import internalCallVisitor from './orchestrationInternalFunctionCallVisitor.js';
import { interactsWithSecretVisitor, parentnewASTPointer } from './common.js';

// collects increments and decrements into a string (for new commitment calculation) and array
// (for collecting zokrates inputs)
const collectIncrements = (stateVarIndicator: StateVariableIndicator | MappingKey) => {
  const incrementsArray = [];
  let incrementsString = '';
  // TODO sometimes decrements are added to .increments
  // current fix -  prevent duplicates
  if (stateVarIndicator.isStruct && stateVarIndicator instanceof StateVariableIndicator) {
    let structIncs = { incrementsArray: {}, incrementsString: {}};
    for (const [key, value] of Object.entries(stateVarIndicator.structProperties)) {
      if (value instanceof MappingKey) {
        structIncs.incrementsArray[key] = collectIncrements(value).incrementsArray;
        structIncs.incrementsString[key] = collectIncrements(value).incrementsString;
      } else {
        structIncs.incrementsArray[key] = [];
        structIncs.incrementsString[key] = '0';
      }
    }
    return structIncs;
  }
  for (const inc of stateVarIndicator.increments) {

    if (inc.nodeType === 'IndexAccess' || inc.nodeType === 'MemberAccess') inc.name = getIndexAccessName(inc);
    if (!inc.name) inc.name = inc.value;
    if (incrementsArray.some(existingInc => inc.name === existingInc.name))
      continue;
    incrementsArray.push({
      name: inc.name,
      precedingOperator: inc.precedingOperator,
      accessed: inc.accessedSecretState,
    });

    if (inc === stateVarIndicator.increments[0]) {
      incrementsString += inc.value
        ? `parseInt(${inc.name}, 10)`
        : `parseInt(${inc.name}.integer, 10)`;
    } else {
      incrementsString += inc.value
        ? ` ${inc.precedingOperator} parseInt(${inc.name}, 10)`
        : ` ${inc.precedingOperator} parseInt(${inc.name}.integer, 10)`;
    }
  }
  for (const dec of stateVarIndicator.decrements) {
    if (dec.nodeType === 'IndexAccess' || dec.nodeType === 'MemberAccess') dec.name = getIndexAccessName(dec);
    if (!dec.name) dec.name = dec.value;
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
    } else {
      // if we have decrements, this str represents the value we must take away
      // => it's a positive value with +'s
      incrementsString += dec.value
        ? ` + parseInt(${dec.name}, 10)`
        : ` + parseInt(${dec.name}.integer, 10)`;
    }
  }
  return { incrementsArray, incrementsString };
};

// gathers public inputs we need to extract from the contract
// i.e. public 'accessed' variables
const addPublicInput = (path: NodePath, state: any) => {
  const { node } = path;
  let { name } = path.scope.getReferencedIndicator(node, true);
  const binding = path.getReferencedBinding(node);
  if (!['Identifier', 'IndexAccess'].includes(path.nodeType)) return;
  const isCondition = !!path.getAncestorContainedWithin('condition') && path.getAncestorOfType('IfStatement')?.containsSecret;
  const isForCondition = !!path.getAncestorContainedWithin('condition') && path.getAncestorOfType('ForStatement')?.containsSecret;
  const isInitializationExpression = !!path.getAncestorContainedWithin('initializationExpression') && path.getAncestorOfType('ForStatement')?.containsSecret;
  const isLoopExpression = !!path.getAncestorContainedWithin('loopExpression') && path.getAncestorOfType('ForStatement')?.containsSecret;

  // below: we have a public state variable we need as a public input to the circuit
  // local variable decs and parameters are dealt with elsewhere
  // secret state vars are input via commitment values
  if (
    binding instanceof VariableBinding &&
    (node.interactsWithSecret || node.baseExpression?.interactsWithSecret || isCondition || isForCondition || isInitializationExpression || isLoopExpression) &&
    (node.interactsWithPublic || node.baseExpression?.interactsWithPublic || isCondition || isForCondition || isInitializationExpression || isLoopExpression) &&
    binding.stateVariable && !binding.isSecret
  ) {
    const fnDefNode = path.getAncestorOfType('FunctionDefinition');
    let innerNode: any;
    if (path.isMapping(node)) {
      name = getIndexAccessName(node);
      node.name = name;
      const indexExpressionNode = path.isMsgSender(node.indexExpression) ?
      buildNode('MsgSender') :
      buildNode(node.indexExpression.nodeType, {
          name: node.indexExpression.name,
          value: node.indexExpression.value,
          subType: node.indexExpression.typeDescriptions?.typeString,
        });
      innerNode = buildNode('IndexAccess', {
          name,
          baseExpression: buildNode('Identifier', { name: node.baseExpression.name }),
          indexExpression: indexExpressionNode,
          isAccessed: true,
          isSecret: false,
        })
    } else {
      innerNode = buildNode('VariableDeclaration', {
        name,
        isAccessed: true,
        isSecret: false,
        interactsWithSecret: true,
      });

    }
    const newNode = buildNode('VariableDeclarationStatement', {
      declarations: [innerNode],
      interactsWithSecret: true,
    });

    fnDefNode.node._newASTPointer.body.preStatements ??= [];

    // below: we move statements into preStatementsif they are modified before the relevant secret state

    const modifiedBeforePaths = path.scope.getReferencedIndicator(node, true).modifyingPaths?.filter((p: NodePath) => p.node.id < node.id);

    const statements = fnDefNode.node._newASTPointer.body.statements;

    modifiedBeforePaths?.forEach((p: NodePath) => {
      const expressionId = p.getAncestorOfType('ExpressionStatement').node?.id;
      // if the public input is modified before here, it won't show up in the mjs file
      // we have to go back and mark any editing statements as interactsWithSecret so they show up
      if (expressionId) {
        let expNode = statements.find((n:any) => n?.id === expressionId);
        if (expNode) {
          expNode.interactsWithSecret = true;
          const moveExpNode = cloneDeep(expNode);
          delete statements[statements.indexOf(expNode)];
          fnDefNode.node._newASTPointer.body.preStatements.push(moveExpNode);
        }
      }
    });

    // if the node is the indexExpression, we dont need its value in the circuit
    state.publicInputs ??= [];
    if (!(path.containerName === 'indexExpression' && !path.parentPath.isSecret)) state.publicInputs.push(node);

    // check we haven't already imported this node
    if (fnDefNode.node._newASTPointer.body.preStatements.some((n: any) => n.nodeType === 'VariableDeclarationStatement' && n.declarations[0]?.name === name)) return;

    fnDefNode.node._newASTPointer.body.preStatements.unshift(
      newNode,
    );
  }

    if (['Identifier', 'IndexAccess'].includes(node.indexExpression?.nodeType)) addPublicInput(NodePath.getPath(node.indexExpression), state);
}

const getIndexAccessName = (node: any) => {
  if (node.nodeType == 'MemberAccess') return `${node.expression.name}.${node.memberName}`;
  if (node.nodeType == 'IndexAccess') return `${node.baseExpression.name}_${NodePath.getPath(node).scope.getMappingKeyName(node)}`;
  return null;
}
/**
 * @desc:
 * Visitor transforms a `.zol` AST into a `.js` AST
 * NB: the resulting `.js` AST is custom, and can only be interpreted by this
 * repo's code generator. JS compilers will not be able to interpret this
 * AST.
 */

const visitor = {
  ContractDefinition: {
    enter(path: NodePath, state: any) {
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

    exit(path: NodePath, state: any) {
      const { node } = path;
      for (const file of node._newASTPointer) {
        if (file.nodeType === 'SetupCommonFilesBoilerplate') {
          file.constructorParams = state.constructorParams;
          file.contractImports = state.contractImports;
          if(state.isjoinCommitmentsFunction?.includes('true'))
            file.functionNames.push('joinCommitments');
        }
        if (file.nodes?.[0].nodeType === 'IntegrationTestBoilerplate') {
          file.nodes[0].constructorParams = state.constructorParams;
          file.nodes[0].contractImports = state.contractImports;
        }
      }
    // Internal Call Visitor
    path.traverse(explode(internalCallVisitor), state);
  },
},
  ImportDirective: {
    enter(path: NodePath, state: any) {
      const { node } = path;
      state.contractImports ??= [];
      state.contractImports.push({
        absolutePath: node.absolutePath,
        file: node.file,
      });
      // we assume all import statements come before all functions
    },

  },

  FunctionDefinition: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      if (scope.modifiesSecretState()) {
        const contractName = `${parent.name}Shield`;
        const fnName = path.getUniqueFunctionName();
        node.fileName = fnName;

        // After getting an appropriate Name , we build the node

        const newNode = buildNode('File', {
          fileName: fnName, // the name of this function
          fileExtension: '.mjs',
          nodes: [
            buildNode('Imports'),
            buildNode('FunctionDefinition', { name: node.name, contractName }),
          ],
        });


        node._newASTPointer = newNode.nodes[1]; // eslint-disable-line prefer-destructuring
        parent._newASTPointer.push(newNode);
        for (const file of parent._newASTPointer) {
          if (file.nodes?.[0].nodeType === 'IntegrationTestBoilerplate') {
            file.nodes[0].functions.push(
              buildNode('IntegrationTestFunction', {
                name: fnName,
                parameters: [],
              }),
            );
          }
        }
      } else {
        state.skipSubNodes = true;
      }

      if (node.kind === 'constructor') {
        state.constructorParams ??= [];
        for (const param of node.parameters.parameters) {
          if (!param.isSecret) state.constructorParams.push(
            buildNode('VariableDeclaration', {
              name: param.name,
              type: param.typeName.name,
              isSecret: param.isSecret,
              interactsWithSecret: scope.getReferencedIndicator(param).interactsWithSecret,
            }),
          );
        }
      }
    },

    exit(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      state.msgSenderParam ??= scope.indicators.msgSenderParam;
      node._newASTPointer.msgSenderParam ??= state.msgSenderParam;
      const initialiseOrchestrationBoilerplateNodes = (fnIndicator: FunctionDefinitionIndicator) => {
        const newNodes: any = {};
        const contractName = `${parent.name}Shield`;
        newNodes.InitialiseKeysNode = buildNode('InitialiseKeys', {
          contractName,
          onChainKeyRegistry: fnIndicator.onChainKeyRegistry,
        });
        if (fnIndicator.oldCommitmentAccessRequired)
          newNodes.initialisePreimageNode = buildNode('InitialisePreimage');
        newNodes.readPreimageNode = buildNode('ReadPreimage', {
          contractName,
        });
        if (fnIndicator.nullifiersRequired || fnIndicator.containsAccessedOnlyState) {
          newNodes.membershipWitnessNode = buildNode('MembershipWitness', {
            contractName,
          });
          newNodes.calculateNullifierNode = buildNode('CalculateNullifier');
        }
        if (fnIndicator.newCommitmentsRequired || fnIndicator.internalFunctionInteractsWithSecret)
          newNodes.calculateCommitmentNode = buildNode('CalculateCommitment');
          newNodes.generateProofNode = buildNode('GenerateProof', {
          circuitName: node.fileName,
        });
        newNodes.sendTransactionNode = buildNode('SendTransaction', {
          functionName: node.fileName,
          contractName,
        });
        newNodes.writePreimageNode = buildNode('WritePreimage', {
          contractName,
          onChainKeyRegistry: fnIndicator.onChainKeyRegistry,
        });
        return newNodes;

      };
      // By this point, we've added a corresponding FunctionDefinition node to the newAST, with the same nodes as the original Solidity function, with some renaming here and there, and stripping out unused data from the oldAST.
      const functionIndicator: FunctionDefinitionIndicator = scope.indicators;
      for(const [, indicators ] of Object.entries(functionIndicator)){

        if(
          (indicators instanceof StateVariableIndicator) &&
          indicators.isPartitioned &&
          !indicators.isStruct &&
          indicators.isNullified ) {
           state.isjoinCommitmentsFunction ??= [];
           state.isjoinCommitmentsFunction?.push('true');
         }
      }
      let thisIntegrationTestFunction: any = {};
      for (const file of parent._newASTPointer) {
        if (file.nodes?.[0].nodeType === 'IntegrationTestBoilerplate') {
          for (const fn of file.nodes[0].functions) {
            if (fn.name === node.fileName) thisIntegrationTestFunction = fn;
          }
        }
        if (file.nodeType === 'SetupCommonFilesBoilerplate') {
          file.functionNames.push(node.fileName);
        }
      }
      thisIntegrationTestFunction.parameters = node._newASTPointer.parameters;
      thisIntegrationTestFunction.newCommitmentsRequired =
        functionIndicator.newCommitmentsRequired;
      if (
        ((functionIndicator.newCommitmentsRequired ||
          functionIndicator.nullifiersRequired) &&
        scope.modifiesSecretState()) || functionIndicator.internalFunctionInteractsWithSecret ) {
        const newNodes = initialiseOrchestrationBoilerplateNodes(
          functionIndicator,
        );
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

        const modifiedStateVariableIndicators: any[] = []; // array of StateVarIndicator or MappingKey
        let stateVarIndicator: StateVariableIndicator | MappingKey;
        for ([, stateVarIndicator] of Object.entries(
          functionIndicator,
        )) {
          if (stateVarIndicator?.isAccessed && !stateVarIndicator?.isModified) {
            if (stateVarIndicator.isMapping) {
              for (const [, mappingKey] of Object.entries(
                stateVarIndicator.mappingKeys,
              )) {
                accessedStateIndicators.push(mappingKey);
              }
            } else {
              accessedStateIndicators.push(stateVarIndicator);
            }
            continue;
          }
          if (!stateVarIndicator?.isSecret || !stateVarIndicator?.isModified)
            continue;
          if (stateVarIndicator.isMapping) {
            for (const [, mappingKey] of Object.entries(
              stateVarIndicator.mappingKeys,
            )) {
              modifiedStateVariableIndicators.push(mappingKey);
            }
          } else {
            modifiedStateVariableIndicators.push(stateVarIndicator);
          }
        }

        for (stateVarIndicator of modifiedStateVariableIndicators) {
          let id: number | (number | string)[] = stateVarIndicator.id;
          let { name, isIncremented } = stateVarIndicator;
          if (stateVarIndicator instanceof MappingKey) {
            id = [id, scope.getIdentifierMappingKeyName(stateVarIndicator.keyPath.node)];
            name = getIndexAccessName(stateVarIndicator.modifyingPaths[stateVarIndicator.modifyingPaths.length -1].getAncestorOfType('IndexAccess').node);
            // name = name
            //   .replace('[', '_')
            //   .replace(']', '')
            //   .replace('.sender', '');
          }
          let { incrementsArray, incrementsString } = isIncremented
            ? collectIncrements(stateVarIndicator)
            : { incrementsArray: null, incrementsString: null };
          if (!incrementsString) incrementsString = null;
          if (!incrementsArray) incrementsArray = null;

          if (stateVarIndicator.isDecremented) {
            // TODO refactor
            node._newASTPointer.decrementedSecretStates ??= [];
            node._newASTPointer.decrementedSecretStates.push(name);
            node._newASTPointer.decrementsSecretState = true;
            thisIntegrationTestFunction.decrementsSecretState = true;
          }

          const modifiedStateVariableNode = buildNode('VariableDeclaration', {
            name,
            isSecret: stateVarIndicator.isSecret,
            type: stateVarIndicator.node.typeDescriptions.typeString,
          });
          node._newASTPointer.parameters.modifiedStateVariables.push(
            modifiedStateVariableNode,
          );

          if (
            stateVarIndicator.isWhole &&
            functionIndicator.oldCommitmentAccessRequired
          ) {
            newNodes.initialisePreimageNode.privateStates[
              name
            ] = buildPrivateStateNode('InitialisePreimage', {
              privateStateName: name,
              indicator: stateVarIndicator,
              id,
            });
          }

          newNodes.readPreimageNode.privateStates[name] = buildPrivateStateNode(
            'ReadPreimage',
            {
              id,
              increment: isIncremented ? incrementsString : undefined,
              indicator: stateVarIndicator,
              initialised: stateVarIndicator.isWhole && functionIndicator.oldCommitmentAccessRequired,
              reinitialisedOnly:
                stateVarIndicator.reinitialisable &&
                !stateVarIndicator.isNullified,
            },
          );

          if (stateVarIndicator.isNullified) {
            newNodes.membershipWitnessNode.privateStates[
              name
            ] = buildPrivateStateNode('MembershipWitness', {
              privateStateName: name,
              indicator: stateVarIndicator,
            });
            newNodes.calculateNullifierNode.privateStates[
              name
            ] = buildPrivateStateNode('CalculateNullifier', {
              indicator: stateVarIndicator,
            });
          }
          if (stateVarIndicator.newCommitmentsRequired) {
            newNodes.calculateCommitmentNode.privateStates[
              name
            ] = buildPrivateStateNode('CalculateCommitment', {
              privateStateName: name,
              id,
              indicator: stateVarIndicator,
            });
          }
          if (stateVarIndicator.isModified) {
            newNodes.generateProofNode.privateStates[
              name
            ] = buildPrivateStateNode('GenerateProof', {
              privateStateName: name,
              id,
              reinitialisedOnly:
                stateVarIndicator.reinitialisable &&
                !stateVarIndicator.isNullified,
              burnedOnly:
                stateVarIndicator.isBurned &&
                !stateVarIndicator.newCommitmentsRequired,
              increment: isIncremented ? incrementsArray : undefined,
              indicator: stateVarIndicator,
            });
            newNodes.generateProofNode.parameters.push(name);
            newNodes.sendTransactionNode.privateStates[
              name
            ] = buildPrivateStateNode('SendTransaction', {
              indicator: stateVarIndicator,
              burnedOnly:
                stateVarIndicator.isBurned &&
                !stateVarIndicator.newCommitmentsRequired,
            });
            newNodes.writePreimageNode.privateStates[
              name
            ] = buildPrivateStateNode('WritePreimage', {
              id,
              indicator: stateVarIndicator,
              burnedOnly:
                stateVarIndicator.isBurned &&
                !stateVarIndicator.newCommitmentsRequired,
            });
          }
        }

        if (node.kind === 'constructor') {
          newNodes.writePreimageNode.isConstructor = true;
          newNodes.membershipWitnessNode.isConstructor = true;
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
            id = [id, scope.getIdentifierMappingKeyName(stateVarIndicator.keyPath.node)];
            name = getIndexAccessName(stateVarIndicator.modifyingPaths[stateVarIndicator.modifyingPaths.length -1].getAncestorOfType('IndexAccess').node);
            // name = name
            //   .replace('[', '_')
            //   .replace(']', '')
            //   .replace('.sender', '');
          }
          newNodes.initialisePreimageNode.privateStates[name] = {
            stateVarId: id,
            privateStateName: name,
            accessedOnly: true,
          };

          newNodes.readPreimageNode.privateStates[name] = buildPrivateStateNode(
            'ReadPreimage',
            {
              id,
              indicator: stateVarIndicator,
              initialised: stateVarIndicator.isWhole && functionIndicator.oldCommitmentAccessRequired,
              accessedOnly: true,
            },
          );
          newNodes.membershipWitnessNode.privateStates[
            name
          ] = buildPrivateStateNode('MembershipWitness', {
            privateStateName: name,
            indicator: stateVarIndicator,
            accessedOnly: true,
          });
          newNodes.calculateNullifierNode.privateStates[
            name
          ] = buildPrivateStateNode('CalculateNullifier', {
            indicator: stateVarIndicator,
          });

          newNodes.generateProofNode.privateStates[
            name
          ] = buildPrivateStateNode('GenerateProof', {
            privateStateName: name,
            id,
            accessedOnly: true,
            indicator: stateVarIndicator,
          });
          // newNodes.generateProofNode.parameters.push(name);
          newNodes.sendTransactionNode.privateStates[
            name
          ] = buildPrivateStateNode('SendTransaction', {
            indicator: stateVarIndicator,
            accessedOnly: true,
          });
        }
        const newFunctionDefinitionNode = node._newASTPointer;

        // this adds other values we need in the circuit
        for (const param of node._newASTPointer.parameters.parameters) {
          if (param.isPrivate || param.isSecret || param.interactsWithSecret) {
            if (param.typeName.isStruct) {
              param.typeName.properties.forEach((prop: any) => {
                newNodes.generateProofNode.parameters.push(`${param.name}.${prop.name}`);
              });
            } else newNodes.generateProofNode.parameters.push(param.name);
          }

        }
        if (state.publicInputs) {
          state.publicInputs.forEach((input: any) => {
            if (!newNodes.generateProofNode.parameters.includes(input.name))
              newNodes.generateProofNode.parameters.push(input.name);
          })

          delete state.publicInputs; // reset
        }
        if (state.constructorStatements && state.constructorStatements[0] && node.kind === 'constructor') newFunctionDefinitionNode.body.statements.unshift(...state.constructorStatements);
        // this adds other values we need in the tx
        for (const param of node.parameters.parameters) {
          if (!param.isSecret) {
            if (path.isStructDeclaration(param)) {
              const newParam = {
                name: param.name,
                properties: param._newASTPointer.typeName.properties.map(p => p.name)
              };
              newNodes.sendTransactionNode.publicInputs.push(newParam);
            } else newNodes.sendTransactionNode.publicInputs.push(param.name);
          }
        }

        // the newNodes array is already ordered, however we need the initialisePreimageNode & InitialiseKeysNode before any copied over statements
        // UNLESS they are public accessed states...
        let earliestPublicAccessIndex = newFunctionDefinitionNode.body.preStatements.findIndex(
          (nd: any) =>
          nd.nodeType === 'VariableDeclarationStatement' &&
          nd.interactsWithSecret && nd.declarations[0].isAccessed &&
          !nd.declarations[0].isSecret
        );
        if (earliestPublicAccessIndex >= 0)
          newFunctionDefinitionNode.body.preStatements.forEach((nd, i) => {
            if (i >= earliestPublicAccessIndex && nd.interactsWithSecret)
              earliestPublicAccessIndex = i;
          });
        if (newNodes.initialisePreimageNode)
          newFunctionDefinitionNode.body.preStatements.splice(
            earliestPublicAccessIndex + 1,
            0,
            newNodes.initialisePreimageNode,
          );

        newFunctionDefinitionNode.body.preStatements.splice(
          0,
          0,
          newNodes.InitialiseKeysNode,
        );

        // 1 - InitialisePreimage - whole states - per state
        // 2 - ReadPreimage - oldCommitmentAccessRequired - per state
        // 3 - MembershipWitness - nullifiersRequired - per state
        // 4 - CalculateNullifier - nullifiersRequired - per state
        // 5 - CalculateCommitment - newCommitmentsRequired - per state
        // 6 - GenerateProof - all - per function
        // 7 - SendTransaction - all - per function
        // 8 - WritePreimage - all - per state
        if (newNodes.readPreimageNode)
        newFunctionDefinitionNode.body.preStatements.push(newNodes.readPreimageNode);
        if (newNodes.membershipWitnessNode)
          newFunctionDefinitionNode.body.preStatements.push(
            newNodes.membershipWitnessNode,
          );
          if(newNodes.VariableDeclarationStatement)
          newFunctionDefinitionNode.body.preStatements.push(newNodes.VariableDeclarationStatement);

        if (newNodes.calculateNullifierNode)
          newFunctionDefinitionNode.body.postStatements.push(
            newNodes.calculateNullifierNode,
          );
        if (newNodes.calculateCommitmentNode)
          newFunctionDefinitionNode.body.postStatements.push(
            newNodes.calculateCommitmentNode,
          );
        if (newNodes.generateProofNode)
          newFunctionDefinitionNode.body.postStatements.push(newNodes.generateProofNode);
        if (newNodes.sendTransactionNode)
          newFunctionDefinitionNode.body.postStatements.push(
            newNodes.sendTransactionNode,
          );
        if (newNodes.writePreimageNode)
          newFunctionDefinitionNode.body.postStatements.push(newNodes.writePreimageNode);
      }
    },
  },
  ParameterList: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      let returnName : string[] = [];
       if(path.key === 'parameters'){
      const newNode = buildNode('ParameterList');
      node._newASTPointer = newNode.parameters;
      parent._newASTPointer[path.containerName] = newNode;
    } else if(path.key === 'returnParameters'){
       parent.body.statements.forEach(node => {
        if(node.nodeType === 'Return') {
          if(node.expression.nodeType === 'TupleExpression'){
           node.expression.components.forEach(component => {
             if(component.name){
              returnName?.push(component.name);
            }
             else
             returnName?.push(component.value);
           });
         } else{
           if(node.expression.name)
            returnName?.push(node.expression.name);
           else
           returnName?.push(node.expression.value);
        }
        }

      });

    node.parameters.forEach((node, index) => {
    if(node.nodeType === 'VariableDeclaration'){
    node.name = returnName[index];
  }
    });
    const newNode = buildNode('ParameterList');
    node._newASTPointer = newNode.parameters;
    parent._newASTPointer[path.containerName] = newNode;
    }
  },
  exit(path: NodePath, state: any){
    const { node, parent, scope } = path;
    if(path.key === 'returnParameters'){
      node._newASTPointer.forEach(item =>{
      parent.body.statements.forEach( node => {
        if(node.nodeType === 'Return'){
          for(const [ id , bindings ] of Object.entries(scope.referencedBindings)){
            if(node.expression.nodeType === 'TupleExpression'){
            node.expression.components.forEach(component => {
              if(id == component.referencedDeclaration) {
                if ((bindings instanceof VariableBinding)) {
                  if(component.name === item.name)
                  item.isSecret = bindings.isSecret
                }
              }
            })
          } else {
            if( id == node.expression.referencedDeclaration) {
              if ((bindings instanceof VariableBinding)){
               if(node.name === item.name)
               item.isSecret = bindings.isSecret
              }
            }
           }
          }
        }
      })
    })
    }
  },
  },

  Block: {
    enter(path: NodePath) {
      const { node, parent } = path;
      // ts complains if I don't include a number in this list
      if (['trueBody', 'falseBody', 99999999].includes(path.containerName)) {
        node._newASTPointer = parent._newASTPointer[path.containerName];
        return;
      }
      const newNode = buildNode(node.nodeType);
      node._newASTPointer = newNode.statements;
      parent._newASTPointer.body = newNode;
    },

  },

  VariableDeclarationStatement: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType);
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },

  },

  BinaryOperation: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType, { operator: node.operator });
      node._newASTPointer = newNode;
      path.inList ? parent._newASTPointer.push(newNode) : parent._newASTPointer[path.containerName] = newNode;
    },

  },

  Assignment: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType, { operator: node.operator });
      node._newASTPointer = newNode;
      if (parent._newASTPointer.nodeType === 'VariableDeclarationStatement') {
        parent._newASTPointer.initialValue = newNode;
      } else {
        parent._newASTPointer.expression = newNode;
      }
    },

  },

  TupleExpression: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
    if(parent.nodeType === 'Return') {
      state.skipSubNodes = true;
      return ;
    } else {
    const newNode = buildNode(node.nodeType);
    node._newASTPointer = newNode.components;
    parent._newASTPointer[path.containerName] = newNode;
  }

    },
  },

  UnaryOperation: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const { operator, prefix, subExpression } = node;

      const newNode = buildNode('Assignment', { operator: '='});
      newNode.rightHandSide = buildNode(node.nodeType, { operator, prefix });

      const newRHS = cloneDeep(NodePath.getPath(subExpression));
      newRHS.parent._newASTPointer = { subExpression: {}};
      newRHS.traverse(visitor, {});

      newNode.leftHandSide = newRHS.parent._newASTPointer.subExpression;
      newNode.rightHandSide.subExpression =  buildNode('Identifier', {
              name: path.scope.getIdentifierMappingKeyName(subExpression, true),
              subType: node.typeDescriptions.typeString,
            });

      node._newASTPointer = newNode;
      if (parent._newASTPointer.nodeType === 'VariableDeclarationStatement') {
        parent._newASTPointer.initialValue = newNode;
      } else {
        parent._newASTPointer.expression = newNode;
      }
      // we make a custom node like a = a++ to avoid nodejs errors => stop traversing
      state.skipSubNodes = true;
      // not using parentnewASTpointer here as the logic is very custom
    }
  },

  ExpressionStatement: {
    enter(path: NodePath, state: any) {
      // We sometimes do need to copy over statements if we need to work out the new commitment value
      // e.g. secret x; x = y +2 => we need to copy over this line to the node file to construct the new commitment
      const { node, parent, scope } = path;
      const newState: any = {};
      path.traversePathsFast(interactsWithSecretVisitor, newState);
      const { interactsWithSecret } = newState;
      let indicator;
      let name;
      // we mark this to grab anything we need from the db / contract
      state.interactsWithSecret = interactsWithSecret;
      // ExpressionStatements can contain an Assignment node.
      if (node.expression.nodeType === 'Assignment' || node.expression.nodeType === 'UnaryOperation') {
        let { leftHandSide: lhs } = node.expression;
        if (!lhs) lhs = node.expression.subExpression;
        const indicator = scope.getReferencedIndicator(lhs, true);

        const name = indicator.isMapping
          ? indicator.name
              .replace('[', '_')
              .replace(']', '')
              .replace('.sender', '')
          : indicator.name;

        if (indicator.isMapping) {
          lhs = lhs.baseExpression;
        } else if (lhs.nodeType === 'MemberAccess') {
          lhs = lhs.expression;
        }

        // check whether this statement should be init separately in the constructor
        const requiresConstructorInit = state.constructorStatements?.some((node: any) => node.declarations[0].name === indicator.name) && scope.scopeName === '';

        // collect all index names
        const names = indicator.referencingPaths.map((p: NodePath) => ({ name: scope.getIdentifierMappingKeyName(p.node), id: p.node.id })).filter(n => n.id <= lhs.id);

        // check whether this is the first instance of a new index name
        const firstInstanceOfNewName = names.length > 1 && names[names.length - 1].name !== names[names.length - 2].name;

        // check whether this should be a VariableDeclaration
        const firstEdit =
          (firstInstanceOfNewName && indicator.interactsWithSecret) ||
          (!indicator.isStruct && indicator.modifyingPaths[0]?.node.id === lhs.id && indicator.isSecret && indicator.isWhole) ||
          (indicator.isStruct && indicator instanceof MappingKey && indicator.container.modifyingPaths[0]?.node.id === lhs.id && indicator.isSecret && indicator.isWhole);

        // We should only replace the _first_ assignment to this node. Let's look at the scope's modifiedBindings for any prior modifications to this binding:
        // if its secret and this is the first assigment, we add a vardec
        if (
          firstEdit &&
          !requiresConstructorInit
        ) {
          let accessed = false;
          indicator.accessedPaths?.forEach(obj => {
            if (
              obj.getAncestorOfType('ExpressionStatement')?.node.id === node.id
            )
              accessed = true;
          });

          // we still need to initialise accessed states if they were accessed _before_ this modification
          const accessedBeforeModification = indicator.isAccessed && indicator.accessedPaths[0].node.id < lhs.id && !indicator.accessedPaths[0].isModification();

          if (accessedBeforeModification || path.isInSubScope()) accessed = true;

          const newNode = buildNode('VariableDeclarationStatement', {
            oldASTId: node.id,
            declarations: [
              buildNode('VariableDeclaration', {
                name: indicator.isStruct ? lhs.name : name,
                isAccessed: accessed,
                isSecret: true,
              }),
            ],
            interactsWithSecret: true,
          });

          if (indicator.isStruct) newNode.declarations[0].isStruct = true;

          if (accessedBeforeModification || path.isInSubScope()) {
            // we need to initialise an accessed state
            // or declare it outside of this subscope e.g. if statement
            const fnDefNode = path.getAncestorOfType('FunctionDefinition').node;
            delete newNode.initialValue;
            fnDefNode._newASTPointer.body.statements.unshift(newNode);
          } else {
            node._newASTPointer = newNode;
            parent._newASTPointer.push(newNode);
            return;
          }
        }
        // if its an incrementation, we need to know it happens but not copy it over
        if (node.expression.isIncremented && indicator.isPartitioned) {
          const newNode = buildNode(node.nodeType, {
            nodeType: node.nodeType,
            interactsWithSecret,
            oldASTId: node.id,
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
      if (node.expression.expression?.name !== 'require') {
        const newNode = buildNode(node.nodeType, {
          interactsWithSecret,
          oldASTId: node.id,
        });
        node._newASTPointer = newNode;
        if (Array.isArray(parent._newASTPointer[path.containerName]) || (!path.isInSubScope() && Array.isArray(parent._newASTPointer))) {
        parent._newASTPointer.push(newNode);
        } else {
          parent._newASTPointer[path.containerName] = newNode;
        }
      }
    },

    exit(path: NodePath, state: any) {
      const { node, scope } = path;
      const { leftHandSide: lhs } = node.expression;
      const indicator = scope.getReferencedIndicator(lhs, true);
      // reset
      delete state.interactsWithSecret;
      if (node._newASTPointer?.incrementsSecretState) {
        const increments = collectIncrements(indicator).incrementsString;
        path.node._newASTPointer.increments = increments;
      } else if (indicator?.isWhole && node._newASTPointer) {
        const name = indicator.isMapping
          ? indicator.name
              .replace('[', '_')
              .replace(']', '')
              .replace('.sender', '')
          : indicator.name;
        // we add a general number statement after each whole state edit
        if (node._newASTPointer.interactsWithSecret) path.getAncestorOfType('FunctionDefinition').node._newASTPointer.body.statements.push(
          buildNode('Assignment', {
              leftHandSide: buildNode('Identifier', { name }),
              operator: '=',
              rightHandSide: buildNode('Identifier', { name, subType: 'generalNumber' })
            }
          )
        );
      }
    },
  },

  StructDefinition: {
    enter(path: NodePath, state: any) {
      state.skipSubNodes = true;
    }
  },

  VariableDeclaration: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      if (node.stateVariable && !node.value) {
        // then the node represents assignment of a state variable - we've handled it.
        node._newASTPointer = parent._newASTPointer;
        state.skipSubNodes = true;
        return;
      }
      if (node.stateVariable && node.value && node.isSecret) {
        const initNode = buildNode('VariableDeclarationStatement', {
            declarations: [
              buildNode('VariableDeclaration', {
                name: node.name,
                isSecret: true,
              }),
            ],
            initialValue: buildNode('Assignment', {
              leftHandSide: buildNode('Identifier', {
                name: node.name
              }),
              operator: '=',
              rightHandSide: buildNode(node.value.nodeType, {
                name: node.value.name, value: node.value.value
                })
              }),
            interactsWithSecret: true,
          });
        state.constructorStatements ??= [];
        state.constructorStatements.push(initNode);
        node._newASTPointer = parent._newASTPointer;
        state.skipSubNodes = true;
        return;
      }

      // we now have a param or a local var dec
      // TODO just use interactsWithSecret when thats added
      let interactsWithSecret = false;

      scope.bindings[node.id].referencingPaths.forEach(refPath => {
        const newState: any = {};
        (refPath.getAncestorOfType('ExpressionStatement') || refPath.parentPath).traversePathsFast(
          interactsWithSecretVisitor,
          newState,
        );
        interactsWithSecret ||= newState.interactsWithSecret;
      });

      if (
        parent.nodeType === 'VariableDeclarationStatement' &&
        interactsWithSecret
      )
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
      } else {
        parent._newASTPointer[path.containerName].push(newNode);
      }
    },

  },
  Return: {
     enter(path: NodePath) {
       const { node, parent } = path;
       const newNode = buildNode(node.expression.nodeType, { value: node.expression.value });
       node._newASTPointer = newNode;
       if (Array.isArray(parent._newASTPointer)) {
         parent._newASTPointer.push(newNode);
       } else {
         parent._newASTPointer[path.containerName].push(newNode);
       }
     },

   },
  ElementaryTypeName: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType, { name: node.name });

      parent._newASTPointer[path.containerName] = newNode;
    },

  },

  UserDefinedTypeName: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const newNode = buildNode('ElementaryTypeName', {
        name: node.pathNode.name,
      });
      const varDecParent = path.getAncestorOfType('VariableDeclaration');
      if (varDecParent?.isStructDeclaration()) {
        const props = varDecParent.getStructDeclaration().members;
        newNode.properties = props.map(p => {
          return { name: p.name, type: p.typeName.name }
        });
        newNode.isStruct = true;
      }
      parent._newASTPointer[path.containerName] = newNode;
      state.skipSubNodes = true; // the subnodes are ElementaryTypeNames
    },

  },

  ElementaryTypeNameExpression: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const newNode = buildNode('ElementaryTypeName', {
        name: node.typeName.name,
      });

      parent._newASTPointer[path.containerName] = newNode;
      state.skipSubNodes = true; // the subnodes are ElementaryTypeNames
    },

  },

  Identifier: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      let { name } = node;
      name = path.scope.getIdentifierMappingKeyName(node);
      const newNode = buildNode(node.nodeType, {
        name,
        subType: node.typeDescriptions.typeString,
      });

      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
      // if this is a public state variable, this fn will add a public input
      addPublicInput(path, state);
    },

  },

  IndexAccess: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const name = getIndexAccessName(node);
      const newNode = buildNode('Identifier', {
        name,
        subType: node.typeDescriptions.typeString,
      });
      // if this is a public state variable, this fn will add a public input
      addPublicInput(path, state);
      state.skipSubNodes = true; // the subnodes are baseExpression and indexExpression - we skip them

      parent._newASTPointer[path.containerName] = newNode;
    },

  },

  MemberAccess: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      if (path.isMsgSender()) {
        const newNode = buildNode('MsgSender');
        state.skipSubNodes = true;
        parent._newASTPointer[path.containerName] = newNode;
        return;
      }
      // const name = getIndexAccessName(node);
      const newNode = buildNode('MemberAccess', { name: node.expression.name, memberName: node.memberName });
      node._newASTPointer = newNode;
      parent._newASTPointer[path.containerName] = newNode;
    },

  },

  Literal: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType, { value: node.value });

      parent._newASTPointer[path.containerName] = newNode;
    },
  },

  IfStatement: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType, {
        condition: {},
        trueBody: [],
        falseBody: []
      });
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },
  },

  ForStatement: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType);
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },
  },

  FunctionCall: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
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

export default visitor
