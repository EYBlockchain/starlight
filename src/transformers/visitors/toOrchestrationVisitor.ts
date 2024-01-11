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
import { interactsWithSecretVisitor, parentnewASTPointer, initialiseOrchestrationBoilerplateNodes, getIndexAccessName } from './common.js';

// collects increments and decrements into a string (for new commitment calculation) and array
// (for collecting zokrates inputs)
const collectIncrements = (stateVarIndicator: StateVariableIndicator | MappingKey) => {
  const incrementsArray: any[] = [];
  let incrementsString = '';
  // TODO sometimes decrements are added to .increments
  // current fix -  prevent duplicates
  if (stateVarIndicator.isStruct && (
      stateVarIndicator instanceof StateVariableIndicator ||
      stateVarIndicator.isParent
    )) {
    let structIncs = { incrementsArray: {}, incrementsString: {}};
    const sps = stateVarIndicator.referencingPaths[0]?.getStructDeclaration()?.members.map(m => m.name);
    for (const sp of sps) {
      if (stateVarIndicator.structProperties?.[sp] instanceof MappingKey) {
        structIncs.incrementsArray[sp] = collectIncrements(stateVarIndicator.structProperties?.[sp]).incrementsArray;
        structIncs.incrementsString[sp] = collectIncrements(stateVarIndicator.structProperties?.[sp]).incrementsString;
      } else {
        structIncs.incrementsArray[sp] = [];
        structIncs.incrementsString[sp] = '0';
      }
    }
    return structIncs;
  }
  for (const inc of stateVarIndicator.increments || []) {

    if (inc.nodeType === 'IndexAccess' || inc.nodeType === 'MemberAccess') inc.name = getIndexAccessName(inc);
    if (!inc.name) inc.name = inc.value;
    if (incrementsArray.some(existingInc => inc.name === existingInc.name))
      continue;
    incrementsArray.push({
      name: inc.name,
      precedingOperator: inc.precedingOperator,
      accessed: inc.accessedSecretState,
    });

    if (inc === stateVarIndicator.increments?.[0]) {
      incrementsString += inc.value
        ? `parseInt(${inc.name}, 10)`
        : `parseInt(${inc.name}.integer, 10)`;
    } else {
      incrementsString += inc.value
        ? ` ${inc.precedingOperator} parseInt(${inc.name}, 10)`
        : ` ${inc.precedingOperator} parseInt(${inc.name}.integer, 10)`;
    }
  }
  for (const dec of stateVarIndicator.decrements || []) {
    if (dec.nodeType === 'IndexAccess' || dec.nodeType === 'MemberAccess') dec.name = getIndexAccessName(dec);
    if (!dec.name) dec.name = dec.value;
    if (incrementsArray.some(existingInc => dec.name === existingInc.name))
      continue;
    incrementsArray.push({
      name: dec.name,
      precedingOperator: dec.precedingOperator,
    });

    if (!stateVarIndicator.decrements?.[1] && !stateVarIndicator.increments?.[0]) {
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
  let { name } = path.scope.getReferencedIndicator(node, true) || path.node;
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
    if (!fnDefNode) throw new Error(`Not in a function`);
    let innerNode: any;
    if (path.isMapping(node)) {
      name = getIndexAccessName(node);
      node.name = name;
      let indexExpressionNode: any;
      if(path.isMsgSender(node.indexExpression))
      indexExpressionNode = buildNode('MsgSender');
      else if(path.isMsgValue(node.indexExpression))
      indexExpressionNode = buildNode('MsgValue');
      else
      indexExpressionNode = buildNode(node.indexExpression.nodeType, {
          name: node.indexExpression.name,
          value: node.indexExpression.value,
          subType: node.indexExpression.typeDescriptions?.typeString,});
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

    const modifiedBeforePaths = path.scope.getReferencedIndicator(node, true)?.modifyingPaths?.filter((p: NodePath) => p.node.id < node.id);

    const statements = fnDefNode.node._newASTPointer.body.statements;

    modifiedBeforePaths?.forEach((p: NodePath) => {
      const expressionId = p.getAncestorOfType('ExpressionStatement')?.node?.id;
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
    if (!(path.containerName === 'indexExpression' && !(path.parentPath.isSecret|| path.parent.containsSecret))) state.publicInputs.push(node);

    // check we haven't already imported this node
    if (fnDefNode.node._newASTPointer.body.preStatements.some((n: any) => n.nodeType === 'VariableDeclarationStatement' && n.declarations[0]?.name === name)) return;

    fnDefNode.node._newASTPointer.body.preStatements.unshift(
      newNode,
    );
  }

    if (['Identifier', 'IndexAccess'].includes(node.indexExpression?.nodeType)) addPublicInput(NodePath.getPath(node.indexExpression), state);
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

      let newNode = buildNode('SetupCommonFilesBoilerplate', {
        contractName,
        contractImports: state.contractImports,
      });
      node._newASTPointer.push(newNode);
      newNode = buildNode('File', {
        fileName: 'api_services',
        fileExtension: '.mjs',
        nodes: [
          buildNode('IntegrationApiServicesBoilerplate', {
            contractName,
            contractImports: state.contractImports,
          }),
        ],
      });
      node._newASTPointer.push(newNode);
      newNode = buildNode('File', {
        fileName: 'api_routes',
        fileExtension: '.mjs',
        nodes: [
          buildNode('IntegrationApiRoutesBoilerplate', {
            contractName,
            contractImports: state.contractImports,
          }),
        ],
      });
      node._newASTPointer.push(newNode);
      if (scope.indicators.newCommitmentsRequired) {
        const newNode = buildNode('EditableCommitmentCommonFilesBoilerplate');
        node._newASTPointer.push(newNode);
      }
    },

    exit(path: NodePath, state: any) {
      const { node } = path;
      node._newASTPointer.wholeNullified = state.wholeNullified;
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
        if (file.nodes?.[0].nodeType === 'IntegrationApiServicesBoilerplate') {
          file.nodes[0].functions.push(
            buildNode('IntegrationApiServiceFunction', {
              name: fnName,
              parameters: [],
              returnParameters:[],
            }),
          );
        }
        if (file.nodes?.[0].nodeType === 'IntegrationApiRoutesBoilerplate') {
          file.nodes[0].functions.push(
            buildNode('IntegrationApiRoutesFunction', {
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
          state.constructorParams.push(
            buildNode('VariableDeclaration', {
              name: param.name,
              type: param.typeName.name,
              isSecret: param.isSecret,
              interactsWithSecret: scope.getReferencedIndicator(param)?.interactsWithSecret,
            }),
          );
        }
      }
    },

    exit(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      state.msgSenderParam ??= scope.indicators.msgSenderParam;
      state.msgValueParam ??= scope.indicators.msgValueParam;
      node._newASTPointer.msgSenderParam ??= state.msgSenderParam;
      node._newASTPointer.msgValueParam ??= state.msgValueParam;


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
      let thisIntegrationApiServiceFunction: any = {};
      for (const file of parent._newASTPointer) {
        if (file.nodes?.[0].nodeType === 'IntegrationTestBoilerplate') {
          for (const fn of file.nodes[0].functions) {
            if (fn.name === node.fileName) thisIntegrationTestFunction = fn;
          }
        }
        if (file.nodes?.[0].nodeType === 'IntegrationApiServicesBoilerplate') {
          for (const fn of file.nodes[0].functions) {
            if (fn.name === node.fileName) thisIntegrationApiServiceFunction = fn;
          }
        }
        if (file.nodeType === 'SetupCommonFilesBoilerplate') {
          file.functionNames.push(node.fileName);
        }
      }

      thisIntegrationTestFunction.parameters = node._newASTPointer.parameters;
      thisIntegrationTestFunction.newCommitmentsRequired =
        functionIndicator.newCommitmentsRequired;
      thisIntegrationTestFunction.encryptionRequired = functionIndicator.encryptionRequired;

    // Adding parameter nodes to each of the function in api_services file
      thisIntegrationApiServiceFunction.parameters = node._newASTPointer.parameters;
      thisIntegrationApiServiceFunction.newCommitmentsRequired =
        functionIndicator.newCommitmentsRequired;
      thisIntegrationApiServiceFunction.encryptionRequired = functionIndicator.encryptionRequired;
    // Adding Return ParameterList to api_services file
    thisIntegrationApiServiceFunction.returnParameters = node._newASTPointer.returnParameters;
      if (
        ((functionIndicator.newCommitmentsRequired ||
          functionIndicator.nullifiersRequired) &&
        scope.modifiesSecretState()) ||
        functionIndicator.internalFunctionInteractsWithSecret) {

        const newNodes = initialiseOrchestrationBoilerplateNodes(
          functionIndicator,
          path
        );

        if (state.msgSenderParam) {
          newNodes.generateProofNode.parameters.push(`msgSender`);
          delete state.msgSenderParam; // reset
        }
        if (state.msgValueParam) {
          newNodes.generateProofNode.parameters.push(`msgValue`);
          delete state.msgValueParam; // reset
        }

        const allIndicators: (StateVariableIndicator | MappingKey)[]  = [];
        let stateVarIndicator: StateVariableIndicator | MappingKey;
        for ([, stateVarIndicator] of Object.entries(
          functionIndicator,
        )) {
          if (stateVarIndicator instanceof StateVariableIndicator && stateVarIndicator.isMapping) {
            for (const [, mappingKey] of Object.entries(
              stateVarIndicator.mappingKeys || {}
            )) {
              allIndicators.push(mappingKey);
            }
          } else if (stateVarIndicator instanceof StateVariableIndicator) {
            allIndicators.push(stateVarIndicator);
          }
        }

        for (stateVarIndicator of allIndicators) {
          let id: number | (number | string)[] = stateVarIndicator.id;
          let { name, isIncremented } = stateVarIndicator;
          let accessedOnly = stateVarIndicator?.isAccessed && !stateVarIndicator?.isModified;
          let secretModified = stateVarIndicator.isSecret && stateVarIndicator.isModified;

          if (stateVarIndicator instanceof MappingKey) {
            accessedOnly =
              stateVarIndicator.container?.isAccessed && !stateVarIndicator.container?.isModified;
            secretModified =
              stateVarIndicator.container?.isSecret && stateVarIndicator.container?.isModified;
            id = [id, scope.getMappingKeyName(stateVarIndicator.keyPath.node) || ``];

            name = (accessedOnly ?
              getIndexAccessName(stateVarIndicator.accessedPaths[stateVarIndicator.accessedPaths.length -1]?.getAncestorOfType('IndexAccess')?.node) :
              stateVarIndicator.container?.isModified ?
                getIndexAccessName(stateVarIndicator.modifyingPaths[stateVarIndicator.modifyingPaths.length -1].getAncestorOfType('IndexAccess')?.node) :
                getIndexAccessName(stateVarIndicator.referencingPaths[stateVarIndicator.referencingPaths.length -1].getAncestorOfType('IndexAccess')?.node))
              || '';
          }

          if (stateVarIndicator.isWhole && stateVarIndicator.isNullified) {
            state.wholeNullified ??= [];
            if (!state.wholeNullified.includes(name)) state.wholeNullified.push(name)
          }
          
          let { incrementsArray, incrementsString } = isIncremented
            ? collectIncrements(stateVarIndicator)
            : { incrementsArray: null, incrementsString: null };
          if (!incrementsString) incrementsString = null;
          if (!incrementsArray) incrementsArray = null;

          if (accessedOnly || (stateVarIndicator.isWhole && functionIndicator.oldCommitmentAccessRequired)) {
            if(stateVarIndicator.isSecret ||  stateVarIndicator.node.interactsWithSecret)
            newNodes.initialisePreimageNode.privateStates[
              name
            ] = buildPrivateStateNode('InitialisePreimage', {
              privateStateName: name,
              indicator: stateVarIndicator,
              accessedOnly,
              id,
            });
          }
          if (accessedOnly || secretModified)
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
                accessedOnly,
              },
            );

          if (stateVarIndicator.isNullified || accessedOnly) {
            newNodes.membershipWitnessNode.privateStates[
              name
            ] = buildPrivateStateNode('MembershipWitness', {
              privateStateName: name,
              indicator: stateVarIndicator,
              accessedOnly,
            });
            newNodes.calculateNullifierNode.privateStates[
              name
            ] = buildPrivateStateNode('CalculateNullifier', {
              accessedOnly,
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

          if (secretModified || accessedOnly) {
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
              accessedOnly,
              indicator: stateVarIndicator,
            });

            newNodes.sendTransactionNode.privateStates[
              name
            ] = buildPrivateStateNode('SendTransaction', {
              indicator: stateVarIndicator,
              reinitialisedOnly:
                stateVarIndicator.reinitialisable &&
                !stateVarIndicator.isNullified,
              burnedOnly:
                stateVarIndicator.isBurned &&
                !stateVarIndicator.newCommitmentsRequired,
              accessedOnly,
            });
          }
          if (secretModified && !accessedOnly) {
            // accessedOnly should be false, but just in case...
            if (stateVarIndicator.isDecremented) {
              // TODO refactor
              node._newASTPointer.decrementedSecretStates ??= [];
              node._newASTPointer.decrementedSecretStates.push(name);
              node._newASTPointer.decrementsSecretState = true;
              thisIntegrationTestFunction.decrementsSecretState = true;
              thisIntegrationApiServiceFunction.decrementsSecretState.push(name);
            }

            const modifiedStateVariableNode = buildNode('VariableDeclaration', {
              name,
              isSecret: stateVarIndicator.isSecret,
              type: stateVarIndicator.node.typeDescriptions.typeString,
            });
            node._newASTPointer.parameters.modifiedStateVariables.push(
              modifiedStateVariableNode,
            );
            newNodes.generateProofNode.parameters.push(name);
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

        const newFunctionDefinitionNode = node._newASTPointer;

        // this adds other values we need in the circuit
        for (const param of node._newASTPointer.parameters.parameters) {
          if (param.isPrivate || param.isSecret || param.interactsWithSecret) {
            if (param.typeName.isStruct) {
              param.typeName.properties.forEach((prop: any) => {
                newNodes.generateProofNode.parameters.push(`${param.name}.${prop.name}${param.typeName.isConstantArray ? '.all' : ''}`);
              });
            } else newNodes.generateProofNode.parameters.push(`${param.name}${param.typeName.isConstantArray ? '.all' : ''}`);
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
            if (path.isStructDeclaration(param) || path.isConstantArray(param)) {
              let newParam: any = {};
              newParam.name = param.name;
              if (path.isStructDeclaration(param)) newParam.properties = param._newASTPointer.typeName.properties.map(p => p.name);
              if (path.isConstantArray) newParam.isConstantArray = true;
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

        // OR they are local variable declarations we need for initialising preimage...

        let localVariableDeclarations: any[] = [];
        newFunctionDefinitionNode.body.statements.forEach((n, index) => {
          if (n.nodeType === 'VariableDeclarationStatement' && n.declarations[0].declarationType === 'localStack')
            localVariableDeclarations.push({node: cloneDeep(n), index});
        });

        if (localVariableDeclarations[0]) {
          localVariableDeclarations.forEach(n => {
            const localIndicator = scope.indicators[n.node.declarations[0].id];
            const indexExpressionPath = localIndicator.referencingPaths.find(p =>
              p.getAncestorContainedWithin('indexExpression') && p.getAncestorOfType('IndexAccess')?.node.containsSecret
            );
            if (indexExpressionPath) {
              // we have found a local variable which is used as an indexExpression, so we need it before we get the mapping value
              // NB if there are multiple, we have just found the first one
              const varDecComesAfter = scope.getReferencedIndicator(
                NodePath.getPath(localIndicator.node)?.getCorrespondingRhsNode(), true
              );
              if (!varDecComesAfter) {
                // here, we don't need to worry about defining anything first, so we push this local var to the top
                newFunctionDefinitionNode.body.preStatements.splice(
                  earliestPublicAccessIndex + 2,
                  0,
                  n.node,
                );
              } else {
                // now we have to split initPreimage
                const varDecComesBefore = scope.getReferencedIndicator(
                  indexExpressionPath.getAncestorOfType('IndexAccess').node.baseExpression, true
                );
                const varDecComesBeforeSVID = [varDecComesBefore?.id, localIndicator.name];
                const varDecComesAfterSVID = [varDecComesAfter.id, varDecComesAfter instanceof MappingKey ? varDecComesAfter.referencedKeyName : ''];
                let newInitPreimageNode1 = { nodeType: 'InitialisePreimage', privateStates: {}};
                let newInitPreimageNode2 = { nodeType: 'InitialisePreimage', privateStates: {}};
                let sortPreimage = 1;
                let correctlyComesAfter = false;
                let stateName: string;
                let stateNode: any;
                for ([stateName, stateNode] of
                  Object.entries(
                    newFunctionDefinitionNode.body.preStatements[earliestPublicAccessIndex + 2].privateStates
                  )
                ) {
                  // we need to splice this local var dec between two initialisePreimage nodes
                  // so here we find the place to split
                  if (
                    stateNode.stateVarId[0] === varDecComesAfterSVID[0] &&
                    stateNode.stateVarId[1] === varDecComesAfterSVID[1] &&
                    sortPreimage === 1
                  ) {
                    correctlyComesAfter = true;
                  }

                  if (
                    stateNode.stateVarId[0] === varDecComesBeforeSVID[0] &&
                    stateNode.stateVarId[1] === varDecComesBeforeSVID[1]
                  ) {
                    if (!correctlyComesAfter) throw new Error('A local variable declaration is required to access some secret state but requires a different one to be defined - this level of complexity is currently not supported by the compiler.')
                    sortPreimage = 2;
                  }

                  if (sortPreimage === 1) newInitPreimageNode1.privateStates[stateName] = cloneDeep(stateNode);
                  else newInitPreimageNode2.privateStates[stateName] = cloneDeep(stateNode);
                }

                newFunctionDefinitionNode.body.preStatements[earliestPublicAccessIndex + 2] = newInitPreimageNode1;
                newFunctionDefinitionNode.body.preStatements.splice(
                  earliestPublicAccessIndex + 3,
                  0,
                  n.node,
                );
                newFunctionDefinitionNode.body.preStatements.splice(
                  earliestPublicAccessIndex + 4,
                  0,
                  newInitPreimageNode2,
                );

              }
              delete newFunctionDefinitionNode.body.statements[n.index];
            }
          });
        }



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

  EventDefinition: {
    enter(path: NodePath, state: any) {
      state.skipSubNodes = true;
    }
  },

  EmitStatement: {
    enter(path: NodePath, state: any) {
      state.skipSubNodes = true;
    }
  },

  WhileStatement: {
    enter(path: NodePath, state: any) {
      state.skipSubNodes = true;
    }
  },

  DoWhileStatement: {
    enter(path: NodePath, state: any) {
      state.skipSubNodes = true;
    }
  },

  ParameterList: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      let returnName : string[] = [];
      if(!!path.getAncestorOfType('EventDefinition')) return;
      if(!!path.getAncestorOfType('EmitStatement')) return;
       if(path.key === 'parameters'){
      const newNode = buildNode('ParameterList');
      node._newASTPointer = newNode.parameters;
      parent._newASTPointer[path.containerName] = newNode;
    } else if(path.key === 'returnParameters'){
       parent.body.statements.forEach(node => {
        if(node.nodeType === 'Return') {
          switch(node.expression.nodeType) { 
            case 'TupleExpression' : {
              node.expression.components.forEach(component => {
                if(component.name)
                  returnName?.push(component.name);
                else if(component.nodeType === 'IndexAccess' ||component.nodeType === 'MemberAccess' )
                  returnName?.push(getIndexAccessName(component));
                else
                  returnName?.push(component.value);
              });
              break;
            }
            
            case 'MemberAccess':
            case 'IndexAccess': 
              returnName?.push(getIndexAccessName(node.expression))
              break;
            default : 
            if(node.expression.name)
             returnName?.push(node.expression.name);
           else
             returnName?.push(node.expression.value); 
            break;   
          }
          }
        });
        node.parameters.forEach((node, index) => {
          if(node.nodeType === 'VariableDeclaration')
          node.name = returnName[index];
        });
    }
    const newNode = buildNode('ParameterList');
    node._newASTPointer = newNode.parameters;
    parent._newASTPointer[path.containerName] = newNode;
  },
  exit(path: NodePath, state: any){
    const { node, parent, scope } = path;
    if(path.key === 'returnParameters'){
      node._newASTPointer.forEach(item =>{
      parent.body.statements.forEach( node => {
        if(node.nodeType === 'Return'){
          for(const [ id , bindings ] of Object.entries(scope.referencedBindings)){
            switch(node.expression.nodeType) {
              case 'TupleExpression' : 
                node.expression.components.forEach(component => {
                  if((component.nodeType === 'IndexAccess' && id == component.indexExpression?.referencedDeclaration )||(component.nodeType === 'MemberAccess' && id == component.expression?.referencedDeclaration )|| id == component.referencedDeclaration) {
                    if ((bindings instanceof VariableBinding)) {
                      if(item.name.includes(bindings.node.name))
                       item.isSecret = bindings.isSecret
                    }
                  } 
                })
              break;
              case 'IndexAccess':
                if(id == node.expression.indexExpression.referencedDeclaration) {
                  if ((bindings instanceof VariableBinding)){
                    if(item.name.includes(bindings.node.name))
                     item.isSecret = bindings.isSecret
                  }
                } 
              break ;
              case 'MemberAccess':
                if(id == node.expression.referencedDeclaration) {
                  if ((bindings instanceof VariableBinding)){
                    if(item.name.includes(bindings.node.name))
                      item.isSecret = bindings.isSecret
                  }
                } 
              break; 
              default: 
                if( id == node.expression.referencedDeclaration){
                  if ((bindings instanceof VariableBinding)){
                    if(item.name == bindings.node.name)
                     item.isSecret = bindings.isSecret
                   }
                } 
                break ;
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
      newNode.id = node.id;
      node._newASTPointer = newNode;
      path.inList ? parent._newASTPointer.push(newNode) : parent._newASTPointer[path.containerName] = newNode;
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
       indicator = scope.getReferencedIndicator(lhs, true);

        const name = indicator.isMapping
          ? indicator.name
              .replace('[', '_')
              .replace(']', '')
              .replace('.sender', 'Sender')
              .replace('.value', 'Value')
              .replace('.', 'dot')
          : indicator.name;

        if (indicator.isMapping && lhs.baseExpression) {
          lhs = lhs.baseExpression;
        } else if (lhs.nodeType === 'MemberAccess') {
          lhs = lhs.expression;
          if (lhs.baseExpression) lhs = lhs.baseExpression;
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
          (!indicator.isStruct && indicator.modifyingPaths[0]?.node.id === lhs?.id && indicator.isSecret && indicator.isWhole) ||
          (indicator.isStruct && indicator instanceof MappingKey && indicator.container.modifyingPaths[0]?.node.id === lhs?.id && indicator.isSecret && indicator.isWhole);

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
                name: indicator.isStruct && !indicator.isMapping ? lhs.name : name,
                isAccessed: accessed,
                isSecret: indicator.isSecret,
              }),
            ],
            interactsWithSecret: true,
          });
          if (indicator.isStruct) newNode.declarations[0].isStruct = true;

          if (accessedBeforeModification || path.isInSubScope()) {
            // we need to initialise an accessed state
            // or declare it outside of this subscope e.g. if statement
            const fnDefNode = path.getAncestorOfType('FunctionDefinition')?.node;
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
          interactsWithSecret: interactsWithSecret || indicator?.interactsWithSecret,
          oldASTId: node.id,
        });

        node._newASTPointer = newNode;
        if (Array.isArray(parent._newASTPointer) || (!path.isInSubScope() && Array.isArray(parent._newASTPointer[path.containerName]))) {
          parent._newASTPointer.push(newNode);
        } else if (Array.isArray(parent._newASTPointer[path.containerName])) {
          parent._newASTPointer[path.containerName].push(newNode);
        } else {
          parent._newASTPointer[path.containerName] = newNode;
        }
      }
    },

    exit(path: NodePath, state: any) {
      const { node, scope } = path;
      const { leftHandSide: lhs } = node.expression;
      const indicator = scope.getReferencedIndicator(lhs, true);
      const name = indicator?.isMapping
        ? indicator.name
            .replace('[', '_')
            .replace(']', '')
             .replace('.sender', 'Sender')
             .replace('.value', 'Value')
            .replace('.', 'dot')
        : indicator?.name || lhs?.name;
      // reset
      delete state.interactsWithSecret;
      if (node._newASTPointer?.incrementsSecretState && indicator) {
        const increments = collectIncrements(indicator).incrementsString;
        path.node._newASTPointer.increments = increments;
      } else if (indicator?.isWhole && node._newASTPointer) {
        // we add a general number statement after each whole state edit
        if (node._newASTPointer.interactsWithSecret) path.getAncestorOfType('FunctionDefinition')?.node._newASTPointer.body.statements.push(
          buildNode('Assignment', {
              leftHandSide: buildNode('Identifier', { name }),
              operator: '=',
              rightHandSide: buildNode('Identifier', { name, subType: 'generalNumber' })
            }
          )
        );
      }

      if (node._newASTPointer?.interactsWithSecret && path.getAncestorOfType('ForStatement'))  {
        path.getAncestorOfType('ForStatement').node._newASTPointer.interactsWithSecret = true;
        if(indicator){
          path.getAncestorOfType('Block')?.node._newASTPointer.push(
            buildNode('Assignment', {
              leftHandSide: buildNode('Identifier', { name }),
              operator: '=',
              rightHandSide: buildNode('Identifier', {  name, subType: 'generalNumber'})
            })
          );
        }
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
      if(!!path.getAncestorOfType('EventDefinition')) return;
      if(!!path.getAncestorOfType('EmitStatement')) return;
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
      let interactsWithSecret = false;

      if (scope.bindings[node.id].referencingPaths.some(refPath => refPath.node.interactsWithSecret))
        interactsWithSecret = true;

      if (
        parent.nodeType === 'VariableDeclarationStatement' &&
        interactsWithSecret
      )
        parent._newASTPointer.interactsWithSecret = interactsWithSecret;

      let declarationType: string = ``;
      if (path.isLocalStackVariableDeclaration())
        declarationType = 'localStack';
      if (path.isFunctionParameterDeclaration()) declarationType = 'parameter';

      // if it's not declaration of a state variable, it's (probably) declaration of a new function parameter. We _do_ want to add this to the newAST if its secret or interact with secrets.
      // if(!node.stateVariable && (!node.isSecret || node.interactsWithSecret))
      const newNode = buildNode(node.nodeType, {
        name: node.name,
        isSecret: node.isSecret || false,
        oldASTId: node.id,
        interactsWithSecret,
        declarationType,
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
     enter(path: NodePath, state: any) {
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

  ArrayTypeName: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const newNode = buildNode('ElementaryTypeName', {
        name: `[${node.length.value || node.length.name}]`
      });
      const dec = path.getAncestorOfType('VariableDeclaration').node;
      if (node.length.value && (path.isLocalStackVariable(dec) || path.isFunctionParameter(dec))) newNode.isConstantArray = true;

      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
      state.skipSubNodes = true;
    }
  },

  ElementaryTypeName: {
    enter(path: NodePath) {
      const { node, parent } = path;
      if(!!path.getAncestorOfType('EventDefinition')) return;
      if(!!path.getAncestorOfType('EmitStatement')) return;
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
      let name = getIndexAccessName(node);
      if (path.isConstantArray(node) && (path.isLocalStackVariable(node) || path.isFunctionParameter(node))) name = `${node.baseExpression.name}[${path.scope.getMappingKeyName(node)}]`;
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
      } else if (path.isMsgValue()) {
        const newNode = buildNode('MsgValue');
        state.skipSubNodes = true;
        parent._newASTPointer[path.containerName] = newNode;
        return;
      }
      const name = node.expression.name || getIndexAccessName(node.expression);
      const newNode = buildNode('MemberAccess', { name, memberName: node.memberName, subType: node.typeDescriptions.typeString });
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
    enter(path: NodePath , state: any) {
      const { node, parent, } = path;
      if(!node.containsSecret) {
        state.skipSubNodes = true;
        return;
      }
      const newNode = buildNode(node.nodeType);
      newNode.interactsWithSecret = true;
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },
  },

  Conditional: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType);
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },
  },

  ForStatement: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      if(!node.containsSecret) {
        state.skipSubNodes = true;
        return;
      }
      const newNode = buildNode(node.nodeType, {
        interactsWithSecret: node.containsSecret
      });
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },

    exit(path: NodePath) {
      const { node } = path;
      const newNode = node._newASTPointer;
      if (newNode.body.statements.some(n => n.interactsWithSecret)) {
        newNode.initializationExpression.interactsWithSecret = true;
        newNode.initializationExpression.isInitializationExpression = true;
        newNode.loopExpression.interactsWithSecret = true;
      }
    }
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
