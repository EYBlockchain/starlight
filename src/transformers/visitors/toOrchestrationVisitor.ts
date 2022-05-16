/* eslint-disable no-param-reassign, no-shadow, no-unused-vars, no-continue */

// import logger from '../../utils/logger.js';
import cloneDeep from 'lodash.clonedeep';
import NodePath from '../../traverse/NodePath.js';
import { StateVariableIndicator, FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import { VariableBinding } from '../../traverse/Binding.js';
import MappingKey from '../../traverse/MappingKey.js'
import buildNode from '../../types/orchestration-types.js';
import { buildPrivateStateNode } from '../../boilerplate/orchestration/javascript/nodes/boilerplate-generator.js';

// below stub will only work with a small subtree - passing a whole AST will always give true!
// useful for subtrees like ExpressionStatements

const interactsWithSecretVisitor = (thisPath: NodePath, thisState: any) => {
  if (thisPath.scope.getReferencedBinding(thisPath.node)?.isSecret)
    thisState.interactsWithSecret = true;
};
// to merge the internal function BoilerplateStatement at correct index
function merge(array1, array2, index=0) {
return array1.slice(0, index).concat(array2, array1.slice(index));
}

const internalFunctionCallVisitor = (thisPath: NodePath, thisState: any) => {
    const { node, scope } = thisPath;
  const args = node.arguments;
  let parametercheck = true ;
  let isSecretArray : string[];
  for (const arg of args) {
    if (arg.nodeType !== 'Identifier') continue;
  isSecretArray = args.map(arg => scope.getReferencedBinding(arg).isSecret);
}
if(node.expression.nodeType === 'Identifier') {
 const functionReferncedNode = scope.getReferencedNode(node.expression);
 const params = functionReferncedNode.parameters.parameters;
 oldStateArray = params.map(param =>(param.name));
 for (const [index, param] of params.entries()) {
   if(isSecretArray[index] !== param.isSecret)
   parametercheck = false;
 }
 const fnIndicator : FunctionDefinitionIndicator = scope.indicators;
 if(parametercheck && fnIndicator.internalFunctionInteractsWithSecret){
 thisState.internalFunctionInteractsWithSecret = true;
  }
  if(!fnIndicator.internalFunctionInteractsWithSecret){
      if(params.some(node => node.isSecret))
      {
      thisState.internalFunctionInteractsWithSecret = true; }
  }

}
};

let oldStateArray : string[];
let circuitImport = [];
// collects increments and decrements into a string (for new commitment calculation) and array
// (for collecting zokrates inputs)
const collectIncrements = (stateVarIndicator: StateVariableIndicator | MappingKey) => {
  const incrementsArray = [];
  let incrementsString = '';
  // TODO sometimes decrements are added to .increments
  // current fix -  prevent duplicates
  for (const inc of stateVarIndicator.increments) {

    if (inc.nodeType === 'IndexAccess') inc.name = getIndexAccessName(inc);
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
  const isCondition = !!path.getAncestorContainedWithin('condition') && path.getAncestorOfType('IfStatement').containsSecret;

  // below: we have a public state variable we need as a public input to the circuit
  // local variable decs and parameters are dealt with elsewhere
  // secret state vars are input via commitment values
  if (
    binding instanceof VariableBinding &&
    (node.interactsWithSecret || node.baseExpression?.interactsWithSecret || isCondition) &&
    (node.interactsWithPublic || node.baseExpression?.interactsWithPublic || isCondition) &&
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
    // check we haven't already imported this node
    if (fnDefNode.node._newASTPointer.body.preStatements.some((n: any) => n.nodeType === 'VariableDeclarationStatement' && n.declarations[0]?.name === name)) return;

    fnDefNode.node._newASTPointer.body.preStatements.unshift(
      newNode,
    );
    // if the node is the indexExpression, we dont need its value in the circuit
    state.publicInputs ??= [];
    if (!(path.containerName === 'indexExpression')) state.publicInputs.push(node);

    if (['Identifier', 'IndexAccess'].includes(node.indexExpression?.nodeType)) addPublicInput(NodePath.getPath(node.indexExpression), state);
  }
}

const getIndexAccessName = (node: any) => {
  if (node.nodeType !== 'IndexAccess') return null;
  return `${node.baseExpression.name}_${NodePath.getPath(node).scope.getMappingKeyName(node)}`;
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
        }
        if (file.nodes?.[0].nodeType === 'IntegrationTestBoilerplate') {
          file.nodes[0].constructorParams = state.constructorParams;
          file.nodes[0].contractImports = state.contractImports;
        }
      }
      let generateProofNode: any;
      let writePreimageNode : any ;
      let sendTransactionNode : any;
      let newdecrementedSecretStates = [];
      node._newASTPointer.forEach(file => {
       state.internalFncName?.forEach( name => {
         if(file.fileName === name && file.nodeType === 'File') {
           let index = state.internalFncName.indexOf(name);
           if(circuitImport[index]==='true') {
             file.nodes.forEach(childNode => {
               if(childNode.nodeType === 'FunctionDefinition'){
                 state.newParametersList = cloneDeep(childNode.parameters.modifiedStateVariables);
                 state.newParametersList.forEach(node => {
                   for(const [index, oldStateName] of  oldStateArray.entries()) {
                     node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[index])
                    }
                  })
                if(childNode.decrementedSecretStates){
                 newdecrementedSecretStates = cloneDeep(childNode.decrementedSecretStates);
                 for(const [index, oldStateName] of  oldStateArray.entries()) {
                   node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[index])
                  }
                }
                state.newPreStatementList = cloneDeep(childNode.body.preStatements);
                state.newPreStatementList.forEach(node => {
                 if(node.nodeType === 'InitialisePreimage'){
                     let stateName: string;
                     let stateNode: any;
                     let newstateName: string;
                     for( [stateName, stateNode] of Object.entries(node.privateStates)){
                       for(const [index, oldStateName] of  oldStateArray.entries()) {
                         newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                         if(newstateName != stateName ){
                           node.privateStates[ newstateName ] = node.privateStates[stateName];
                           delete(node.privateStates[ stateName ]);
                          }
                         stateNode.privateStateName = stateNode.privateStateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                         if(stateNode.mappingKey === oldStateName)
                           stateNode.mappingKey = stateNode.mappingKey.replace(oldStateName, state.newStateArray[index])
                         if(stateNode.stateVarId[1] === oldStateName)
                           stateNode.stateVarId[1] = stateNode.stateVarId[1].replace(oldStateName, state.newStateArray[index])
                        }
                      }
                    }
                  if(node.nodeType === 'ReadPreimage'){
                     let stateName: string;
                     let stateNode: any;
                     let newstateName: string;
                     for( [stateName, stateNode] of Object.entries(node.privateStates)){
                       for(const [index, oldStateName] of  oldStateArray.entries()) {
                         newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                          if(newstateName != stateName ){
                            node.privateStates[ newstateName ] = node.privateStates[stateName];
                            delete(node.privateStates[ stateName ]);
                          }
                          stateNode.increment = stateNode.increment.replace(oldStateName+'.', state.newStateArray[index]+'.')
                          if(stateNode.mappingKey === oldStateName)
                           stateNode.mappingKey = stateNode.mappingKey.replace(oldStateName, state.newStateArray[index])
                          if(stateNode.stateVarId[1] === oldStateName)
                           stateNode.stateVarId[1] = stateNode.stateVarId[1].replace(oldStateName, state.newStateArray[index])
                        }
                      }
                    }
                 if(node.nodeType === 'MembershipWitness'){
                   let stateName: string;
                   let stateNode: any;
                   let newstateName: string;
                   for( [stateName, stateNode] of Object.entries(node.privateStates)){
                     for(const [index, oldStateName] of  oldStateArray.entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                       if(newstateName != stateName ){
                         node.privateStates[ newstateName ] = node.privateStates[stateName];
                         delete(node.privateStates[ stateName ]);
                        }
                       stateNode.privateStateName = stateNode.privateStateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                      }
                    }
                  }
                })
               state.newPreStatementList.splice(0,1);
               state.newStatementList = cloneDeep(childNode.body.statements);
               state.newStatementList.forEach(node => {
                 if(node.nodeType === 'VariableDeclarationStatement'){
                   node.declarations.forEach(node => {
                     for(const [index, oldStateName] of  oldStateArray.entries()) {
                       node.name = node.name.replace('_'+oldStateName, '_'+ state.newStateArray[index]);
                      }
                    });
                   for(const [index, oldStateName] of  oldStateArray.entries()) {
                     node.initialValue.leftHandSide.name = node.initialValue.leftHandSide.name.replace('_'+oldStateName, '_'+ state.newStateArray[index]);
                     node.initialValue.rightHandSide.name = node.initialValue.rightHandSide.name.replace(oldStateName,  state.newStateArray[index]);
                    }
                  }
                  if(node.nodeType === 'Assignment'){
                    for(const [index, oldStateName] of  oldStateArray.entries()) {
                      node.leftHandSide.name = node.leftHandSide.name.replace('_'+oldStateName, '_'+ state.newStateArray[index]);
                      node.rightHandSide.name = node.rightHandSide.name.replace('_'+oldStateName, '_'+ state.newStateArray[index]);
                    }
                  }
                })
                state.newPostStatementList = cloneDeep(childNode.body.postStatements);
                state.newPostStatementList.forEach(node => {
                 if(node.nodeType === 'CalculateNullifier'){
                   let stateName: string;
                   let stateNode: any;
                   let newstateName: string;
                   for( [stateName, stateNode] of Object.entries(node.privateStates)){
                     for(const [index, oldStateName] of  oldStateArray.entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                       if(newstateName != stateName ){
                         node.privateStates[ newstateName ] = node.privateStates[stateName];
                         delete(node.privateStates[ stateName ]);
                        }
                      }
                    }
                  }
                 if(node.nodeType === 'CalculateCommitment'){
                   let stateName: string;
                   let stateNode: any;
                   let newstateName: string;
                   for( [stateName, stateNode] of Object.entries(node.privateStates)){
                     for(const [index, oldStateName] of  oldStateArray.entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                       if(newstateName != stateName ){
                         node.privateStates[ newstateName ] = node.privateStates[stateName];
                         delete(node.privateStates[ stateName ]);
                        }
                       if(stateNode.privateStateName === oldStateName )
                        stateNode.privateStateName = stateNode.privateStateName.replace(oldStateName,  state.newStateArray[index])
                       else
                        stateNode.privateStateName = stateNode.privateStateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                       if(stateNode.stateVarId[1] === oldStateName)
                        stateNode.stateVarId[1] = stateNode.stateVarId[1].replace(oldStateName, state.newStateArray[index])
                      }
                    }
                  }
                 if(node.nodeType === 'GenerateProof'){
                   generateProofNode = cloneDeep(node);
                   let stateName: string;
                   let newstateName: string;
                   for( stateName of Object.keys(generateProofNode.privateStates)) {
                     for(const [index, oldStateName] of  oldStateArray.entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[index])
                       if(newstateName != stateName ){
                         generateProofNode.privateStates[ newstateName ] = generateProofNode.privateStates[stateName];
                         delete(generateProofNode.privateStates[ stateName ]);
                        }
                      }
                    }
                   generateProofNode.parameters = [];
                  }
                 if(node.nodeType === 'SendTransaction'){
                    sendTransactionNode = cloneDeep(node);
                    let stateName: string;
                    let stateNode: any;
                    let newstateName: string;
                    for( [stateName, stateNode] of Object.entries(sendTransactionNode.privateStates)){
                      for(const [index, oldStateName] of  oldStateArray.entries()) {
                        newstateName = stateName.replace('_'+oldStateName, '_'+state.newStateArray[index])
                        if(newstateName != stateName ){
                         sendTransactionNode.privateStates[ newstateName ] = sendTransactionNode.privateStates[stateName];
                         delete(sendTransactionNode.privateStates[ stateName ]);
                        }
                      }
                    }
                  }
                  if(node.nodeType === 'WritePreimage'){
                    writePreimageNode = cloneDeep(node);
                    let stateName: string;
                    let stateNode: any;
                    let newstateName: string;
                    for( [stateName, stateNode] of Object.entries(writePreimageNode.privateStates)){
                      for(const [index, oldStateName] of  oldStateArray.entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+state.newStateArray[index])
                       if(newstateName != stateName ){
                         writePreimageNode.privateStates[ newstateName ] = writePreimageNode.privateStates[stateName];
                         delete(writePreimageNode.privateStates[ stateName ]);
                        }
                        if(stateNode.mappingKey)
                        stateNode.mappingKey =  stateNode.mappingKey.replace(oldStateName, state.newStateArray[index])
                      }
                    }
                  }
                })
                state.newPostStatementList.splice(- 3);
              }
            })
            node._newASTPointer.forEach(file => {
             if(file.fileName === state.callingFncName[index]) {
                file.nodes.forEach(childNode => {
                 if(childNode.nodeType === 'FunctionDefinition') {
                   childNode.parameters.modifiedStateVariables = [...new Set([...childNode.parameters.modifiedStateVariables, ...state.newParametersList])];
                   if(childNode.decrementedSecretStates)
                    childNode.decrementedSecretStates = [...new Set([...childNode.decrementedSecretStates, ...newdecrementedSecretStates])];
                   childNode.body.preStatements = [...new Set([...childNode.body.preStatements, ...state.newPreStatementList])]
                   childNode.body.statements = [...new Set([...childNode.body.statements, ...state.newStatementList])]
                   const index = childNode.body.postStatements.findIndex((node) => (node.nodeType=== 'CalculateCommitment'));
                   childNode.body.postStatements = merge(childNode.body.postStatements, state.newPostStatementList , index+1);
                   childNode.body.postStatements.forEach(node => {
                     if(node.nodeType === 'GenerateProof'){
                       node.privateStates = Object.assign(node.privateStates,generateProofNode.privateStates)
                       node.parameters = [...new Set([...node.parameters ,...generateProofNode.parameters])];
                      }

                      if(node.nodeType === 'SendTransaction')
                       node.privateStates = Object.assign(node.privateStates,sendTransactionNode.privateStates)

                      if(node.nodeType === 'WritePreimage')
                       node.privateStates = Object.assign(node.privateStates,writePreimageNode.privateStates)

                    })

                  }
                })
              }
            })
          }
          if(circuitImport[index] === 'false') {
           file.nodes.forEach(childNode => {
             if(childNode.nodeType === 'FunctionDefinition'){
               state.newStatementList = cloneDeep(childNode.body.statements);
               state.newStatementList.forEach(node => {
                 if(node.nodeType === 'VariableDeclarationStatement') {
                   for(const [index, oldStateName] of  oldStateArray.entries()) {
                     node.initialValue.leftHandSide.name = node.initialValue.leftHandSide.name.replace('_'+oldStateName, '_'+ state.newStateArray[index]);
                     node.initialValue.rightHandSide.name = node.initialValue.rightHandSide.name.replace(oldStateName,  state.newStateArray[index]);
                    }
                  }
                })
              }
            })
            node._newASTPointer.forEach(file => {
             if(file.fileName === state.callingFncName[index]) {
               file.nodes.forEach(childNode => {
                 if(childNode.nodeType === 'FunctionDefinition') {
                   childNode.body.statements.forEach(node => {
                     if(node.nodeType === 'ExpressionStatement' && node.expression.name === state.internalFncName[index]) {
                       state.newStatementList.forEach(list => {
                         if(list.nodeType === 'VariableDeclarationStatement')
                          node.expression = Object.assign(node.expression,list.initialValue);
                        })
                      }
                    });
                  }
                })
              }
            })
          }
        }
      })
    })
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
      const initialiseOrchestrationBoilerplateNodes = (fnIndicator) => {
        const newNodes: any = {};
        const contractName = `${parent.name}Shield`;
        newNodes.InitialiseKeysNode = buildNode('InitialiseKeys', {
          contractName,
          onChainKeyRegistry: fnIndicator.onChainKeyRegistry,
        });
        if (fnIndicator.oldCommitmentAccessRequired)
          newNodes.initialisePreimageNode = buildNode('InitialisePreimage');
        newNodes.readPreimageNode = buildNode('ReadPreimage');
        if (fnIndicator.nullifiersRequired || fnIndicator.containsAccessedOnlyState) {
          newNodes.membershipWitnessNode = buildNode('MembershipWitness', {
            contractName,
          });
          newNodes.calculateNullifierNode = buildNode('CalculateNullifier');
        }
        if (fnIndicator.newCommitmentsRequired)
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
        scope.modifiesSecretState()) || functionIndicator.internalFunctionInteractsWithSecret
      ) {
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
            id = [id, stateVarIndicator.referencedKeyName];
            name = name
              .replace('[', '_')
              .replace(']', '')
              .replace('.sender', '');
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
            id = [id, stateVarIndicator.referencedKeyName];
            name = name
              .replace('[', '_')
              .replace(']', '')
              .replace('.sender', '');
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
          if (param.isPrivate || param.isSecret || param.interactsWithSecret)
            newNodes.generateProofNode.parameters.push(param.name);
        }
        if (state.publicInputs) {
          state.publicInputs.forEach((input: any) => {
            newNodes.generateProofNode.parameters.push(input.name);
          })

          delete state.publicInputs; // reset
        }
        if (state.constructorStatements && state.constructorStatements[0] && node.kind === 'constructor') newFunctionDefinitionNode.body.statements.unshift(...state.constructorStatements);
        // this adds other values we need in the tx
        for (const param of node.parameters.parameters) {
          if (!param.isSecret)
            newNodes.sendTransactionNode.publicInputs.push(param.name);
        }

        // the newNodes array is already ordered, however we need the initialisePreimageNode & InitialiseKeysNode before any copied over statements
        if (newNodes.initialisePreimageNode)
          newFunctionDefinitionNode.body.preStatements.splice(
            0,
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
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType);
      node._newASTPointer = newNode.parameters;
      parent._newASTPointer[path.containerName] = newNode;
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
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType);
      node._newASTPointer = newNode.components;
      parent._newASTPointer[path.containerName] = newNode;
    },
  },

  UnaryOperation: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { operator, prefix, subExpression } = node;
      const newNode = buildNode(node.nodeType, { operator, prefix, subExpression });
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer[path.containerName])) {
        parent._newASTPointer[path.containerName].push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
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
      if (node.expression.nodeType === 'Assignment') {
        let { leftHandSide: lhs } = node.expression;
        indicator = scope.getReferencedIndicator(lhs, true);

        if (indicator.isMapping) {
          lhs = lhs.baseExpression;
        }

        name = indicator.isMapping
          ? indicator.name
              .replace('[', '_')
              .replace(']', '')
              .replace('.sender', '')
          : indicator.name;

        const requiresConstructorInit = state.constructorStatements?.some((node: any) => node.declarations[0].name === indicator.name) && scope.scopeName === '';

        // We should only replace the _first_ assignment to this node. Let's look at the scope's modifiedBindings for any prior modifications to this binding:
        // if its secret and this is the first assigment, we add a vardec
        if (
          indicator.modifyingPaths[0].node.id === lhs.id &&
          indicator.isSecret &&
          indicator.isWhole &&
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
            declarations: [
              buildNode('VariableDeclaration', {
                name,
                isAccessed: accessed,
                isSecret: true,
              }),
            ],
            interactsWithSecret: true,
          });

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
      // if (node.expression.nodeType !== 'FunctionCall') {
        const newNode = buildNode(node.nodeType, {
          interactsWithSecret,
        });
        node._newASTPointer = newNode;
        parent._newASTPointer.push(newNode);

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
        path.getAncestorOfType('FunctionDefinition').node._newASTPointer.body.statements.push(
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

  ElementaryTypeName: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType, { name: node.name });

      parent._newASTPointer[path.containerName] = newNode;
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
      const newNode = buildNode(node.nodeType, {
        name: node.name,
        subType: node.typeDescriptions.typeString,
      });

      if (Array.isArray(parent._newASTPointer[path.containerName])) {
       parent._newASTPointer[path.containerName].push(newNode);
     } else {
       parent._newASTPointer[path.containerName] = newNode; }

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
      const newNode = buildNode(node.nodeType, { name: node.memberName });
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
  FunctionCall: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      if(path.isInternalFunctionCall()) {
        const args = node.arguments;
        let isCircuit = false;
        state.newStateArray =  args.map(arg => (arg.name));
        let internalFunctionInteractsWithSecret = false;
        const newState: any = {};
        internalFunctionCallVisitor(path, newState)
        internalFunctionInteractsWithSecret ||= newState.internalFunctionInteractsWithSecret;
        state.internalFncName ??= [];
        state.internalFncName.push(node.expression.name);
       if(internalFunctionInteractsWithSecret === true){
         const callingfnDefPath = path.getFunctionDefinition();
         const callingfnDefIndicators = callingfnDefPath.scope.indicators;
         const functionReferncedNode = scope.getReferencedPath(node.expression);
         const internalfnDefIndicators = functionReferncedNode.scope.indicators;
         const startNodePath = path.getAncestorOfType('ContractDefinition')
         startNodePath.node.nodes.forEach(node => {
           if(node.nodeType === 'VariableDeclaration'){
             if(node.typeName.nodeType === 'Mapping') {
               for(const [index, oldStateName] of  oldStateArray.entries()) {
                 if(oldStateName === state.newStateArray[index]) {
                   circuitImport.push('false');
                   isCircuit = false;
                  }
                  circuitImport.push('true');
                  isCircuit = true;
                }
              }
             if(callingfnDefIndicators[node.id]){
               if(callingfnDefIndicators[node.id].isModified){
                 if(internalfnDefIndicators[node.id] && internalfnDefIndicators[node.id].isModified) {
                   circuitImport.push('false');
                   isCircuit = false;
                  }
                }
               if(!callingfnDefIndicators[node.id].isModified) {
                 if(internalfnDefIndicators[node.id] && internalfnDefIndicators[node.id].isModified){
                   circuitImport.push('true');
                   isCircuit = true;
                  }
                }
              }
              if(!callingfnDefIndicators[node.id] ){
                if(internalfnDefIndicators[node.id] && internalfnDefIndicators[node.id].isModified) {
                  circuitImport.push('true');
                  isCircuit = true;
                }
              }
            }
          });
          const newNode = buildNode('InternalFunctionCall', {
            name: node.expression.name,
            internalFunctionInteractsWithSecret: internalFunctionInteractsWithSecret,
          });
          node._newASTPointer = newNode ;
        // parent._newASTPointer[path.containerName] = newNode;
          if (Array.isArray(parent._newASTPointer[path.containerName])) {
            parent._newASTPointer[path.containerName].push(newNode);
          } else {
          parent._newASTPointer[path.containerName] = newNode;
          }
        }
       const fnDefNode = path.getAncestorOfType('FunctionDefinition');
       state.callingFncName ??= [];
       state.callingFncName.push(fnDefNode.node.name);
      }
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
