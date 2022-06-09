import cloneDeep from 'lodash.clonedeep';
import NodePath from '../../traverse/NodePath.js';
import { FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import buildNode from '../../types/orchestration-types.js';
import { internalFunctionCallVisitor } from './common.js';

function merge(array1, array2, index=0) {
return array1.slice(0, index).concat(array2, array1.slice(index));
}

let oldStateArray : string[];

const internalCallVisitor = {
  ContractDefinition: {
    exit(path: NodePath, state: any) {
      const { node } = path;
      let generateProofNode: any;
      let writePreimageNode : any ;
      let sendTransactionNode : any;
      let newdecrementedSecretStates = [];
      node._newASTPointer.forEach(file => {
       state.internalFncName?.forEach( name => {
         if(file.fileName === name && file.nodeType === 'File') {
           let index = state.internalFncName.indexOf(name);
           if(state.circuitImport[index]==='true') {
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
          if(state.circuitImport[index] === 'false') {
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
                          if(list.nodeType === 'Assignment')
                          childNode.body.statements?.splice(childNode.body.statements.indexOf(node)+1, 0, list);
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
FunctionCall: {
  enter(path: NodePath, state: any) {
    const { node, parent, scope } = path;
    if(path.isInternalFunctionCall()) {
      const args = node.arguments;
      let isCircuit = false;
      state.newStateArray =  args.map(arg => (arg.name));
      let internalFunctionInteractsWithSecret = false;
      const newState: any = {};
      oldStateArray = internalFunctionCallVisitor(path, newState)
      internalFunctionInteractsWithSecret ||= newState.internalFunctionInteractsWithSecret;
      state.internalFncName ??= [];
      state.internalFncName.push(node.expression.name);
     if(internalFunctionInteractsWithSecret === true) {
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
                 state.circuitImport ??= [];
                 state.circuitImport.push('false');
                 isCircuit = false;
                }
                state.circuitImport ??= [];
                state.circuitImport.push('true');
                isCircuit = true;
              }
            }
           if(callingfnDefIndicators[node.id] && internalfnDefIndicators[node.id] && internalfnDefIndicators[node.id].isModified){
             if(callingfnDefIndicators[node.id].isModified)
                 isCircuit = false;
             else
                 isCircuit = true;
            }
            else
                isCircuit = true;
              state.circuitImport ??= [];
              if(isCircuit)
              state.circuitImport.push('true');
              else
              state.circuitImport.push('false');
          }
        });
        const newNode = buildNode('InternalFunctionCall', {
          name: node.expression.name,
          internalFunctionInteractsWithSecret: internalFunctionInteractsWithSecret,
        });
        node._newASTPointer = newNode ;
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

  },
},
}
export default internalCallVisitor;
