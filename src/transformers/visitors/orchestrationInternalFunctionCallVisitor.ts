import cloneDeep from 'lodash.clonedeep';
import NodePath from '../../traverse/NodePath.js';
import { FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import  buildNode  from '../../types/orchestration-types.js';
import { internalFunctionCallVisitor } from './common.js';
import { traverseNodesFast } from '../../traverse/traverse.js';

function merge(array1, array2, index=0) {
return array1.slice(0, index).concat(array2, array1.slice(index));
}
function joinWithoutDupes(A, B) {
  const a = new Set(A.map(x => x.name))
  const b = new Set(B.map(x => x.name))
  return [...A, ...B.filter(x => !a.has(x.name))]
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
        state.intFnindex = {}; 
       state.internalFncName?.forEach( (name, index)=> {
        let callingFncName = state.callingFncName[index].name;
         if(file.fileName === name && file.nodeType === 'File') {
             file.nodes.forEach(childNode => {
               if(childNode.nodeType === 'FunctionDefinition'){
                 state.newParametersList = cloneDeep(childNode.parameters.modifiedStateVariables);
                 state.newParametersList.forEach(node => {
                   for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                     node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[name][index])
                    }
                  })
                if(childNode.decrementedSecretStates){
                 newdecrementedSecretStates = cloneDeep(childNode.decrementedSecretStates);
                 for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                   node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[name][index])
                  }
                }
                state.newPreStatementList = cloneDeep(childNode.body.preStatements);
                state.newPreStatementList.forEach(node => {
                    if(['InitialisePreimage','ReadPreimage','MembershipWitness'].includes(node.nodeType)) {
                    let stateName: string;
                    let stateNode: any;
                    let newstateName: string;
                    for( [stateName, stateNode] of Object.entries(node.privateStates)){
                      for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                        newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[name][index])
                        if(newstateName != stateName ){
                          node.privateStates[ newstateName ] = node.privateStates[stateName];
                          delete(node.privateStates[ stateName ]);
                         }

                         switch (node.nodeType)
                        {
                         case 'InitialisePreimage': {
                          stateNode.privateStateName = stateNode.privateStateName.replace('_'+oldStateName, '_'+ state.newStateArray[name][index])
                          if(stateNode.mappingKey === oldStateName)
                            stateNode.mappingKey = stateNode.mappingKey.replace(oldStateName, state.newStateArray[name][index])
                          if(stateNode.stateVarId[1] === oldStateName)
                            stateNode.stateVarId[1] = stateNode.stateVarId[1].replace(oldStateName, state.newStateArray[name][index])
                          break;
                          }
                          case 'ReadPreimage': {
                            if (stateNode.increment) stateNode.increment = stateNode.increment.replace(oldStateName+'.', state.newStateArray[name][index]+'.');
                            if(stateNode.mappingKey === oldStateName)
                            stateNode.mappingKey = stateNode.mappingKey.replace(oldStateName, state.newStateArray[name][index])
                            if(stateNode.stateVarId[1] === oldStateName)
                             stateNode.stateVarId[1] = stateNode.stateVarId[1].replace(oldStateName, state.newStateArray[name][index])
                            break;
                            }
                            case 'MembershipWitness': {
                              stateNode.privateStateName = stateNode.privateStateName.replace('_'+oldStateName, '_'+ state.newStateArray[name][index])
                              break;
                              }
                              default :
                              break;
                        }
                      }
                    }
                  }
                })
               state.newPreStatementList.splice(0,1);
               state.newStatementList = cloneDeep(childNode.body.statements);
               const adjustNamesVisitor = (thisNode: any, state: any) => {
                if (thisNode.nodeType === 'VariableDeclaration'){
                  thisNode.name = thisNode.name.replace(state.oldStateName, state.newStateArray[name][state.currentIndex]);
                }
                if (thisNode.nodeType === 'Identifier'){
                  thisNode.name = thisNode.name.replace(state.oldStateName, state.newStateArray[name][state.currentIndex]);
                }
              }
               state.newStatementList.forEach(node => {
                for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                  state.oldStateName = oldStateName;
                  state.currentIndex = index;
                  traverseNodesFast(node, adjustNamesVisitor,  state);
                }
                
              });
                state.newPostStatementList = cloneDeep(childNode.body.postStatements);
                state.newPostStatementList.forEach(node => {
                 if(node.nodeType === 'CalculateNullifier'){
                   let stateName: string;
                   let stateNode: any;
                   let newstateName: string;
                   for( [stateName, stateNode] of Object.entries(node.privateStates)){
                     for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[name][index])
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
                     for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+ state.newStateArray[name][index])
                       if(newstateName != stateName ){
                         node.privateStates[ newstateName ] = node.privateStates[stateName];
                         delete(node.privateStates[ stateName ]);
                        }
                       if(stateNode.privateStateName === oldStateName)
                        stateNode.privateStateName = stateNode.privateStateName.replace(oldStateName,  state.newStateArray[name][index])
                       else
                        stateNode.privateStateName = stateNode.privateStateName.replace('_'+oldStateName, '_'+state.newStateArray[name][index])
                       if(stateNode.stateVarId[1] === oldStateName)
                        stateNode.stateVarId[1] = stateNode.stateVarId[1].replace(oldStateName, state.newStateArray[name][index])
                      }
                    }
                  }
                 if(node.nodeType === 'GenerateProof'){
                   generateProofNode = cloneDeep(node);
                   let stateName: string;
                   let newstateName: string;
                   for( stateName of Object.keys(generateProofNode.privateStates)) {
                     for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+state.newStateArray[name][index])
                       if(newstateName != stateName ){
                         generateProofNode.privateStates[ newstateName ] = generateProofNode.privateStates[stateName];
                         delete(generateProofNode.privateStates[ stateName ]);
                         stateName = newstateName;
                        }
                        if (generateProofNode.privateStates[stateName].increment){
                          for( const [id, node] of Object.entries(generateProofNode.privateStates[stateName].increment) ){
                            if(generateProofNode.privateStates[stateName].increment[id].name === oldStateName)
                           generateProofNode.privateStates[stateName].increment[id].name = state.newStateArray[name][index];
                          }
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
                      for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                        newstateName = stateName.replace('_'+oldStateName, '_'+state.newStateArray[name][index])
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
                      for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                       newstateName = stateName.replace('_'+oldStateName, '_'+state.newStateArray[name][index])
                       if(newstateName != stateName ){
                         writePreimageNode.privateStates[ newstateName ] = writePreimageNode.privateStates[stateName];
                         delete(writePreimageNode.privateStates[ stateName ]);
                        }
                        if(stateNode.mappingKey)
                        stateNode.mappingKey =  stateNode.mappingKey.replace(oldStateName, state.newStateArray[name][index])
                      }
                    }
                  }
                })
                state.newPostStatementList.splice(- 3);
              }
            });
            node._newASTPointer.forEach(file => {
             if(file.fileName === callingFncName) {
                file.nodes.forEach(childNode => {
                 if(childNode.nodeType === 'FunctionDefinition') {
                   childNode.parameters.modifiedStateVariables = joinWithoutDupes(childNode.parameters.modifiedStateVariables, state.newParametersList);
                   if(childNode.decrementedSecretStates)
                    childNode.decrementedSecretStates = [...new Set([...childNode.decrementedSecretStates, ...newdecrementedSecretStates])];
                    childNode.body.preStatements.forEach(node => {
                      switch(node.nodeType) {
                        case 'InitialisePreimage' : {
                         state.newPreStatementList.forEach(statenode => {
                           if(statenode.nodeType === 'InitialisePreimage'){
                            Object.keys(node.privateStates).forEach(key => {
                              Object.keys(statenode.privateStates).forEach(newKey => {
                                if (key === newKey){
                                  statenode.privateStates[newKey].accessedOnly = statenode.privateStates[newKey].accessedOnly && node.privateStates[key].accessedOnly;
                                }
                              });  
                            });     
                             node.privateStates = Object.assign(node.privateStates,statenode.privateStates)
                            }
                         });
                         break;
                        }
                        case 'ReadPreimage': {
                          state.newPreStatementList.forEach(statenode => {
                            if(statenode.nodeType === 'ReadPreimage'){
                              Object.keys(node.privateStates).forEach(key => {
                                Object.keys(statenode.privateStates).forEach(newKey => {
                                  if (key === newKey){
                                    statenode.privateStates[newKey].accessedOnly = statenode.privateStates[newKey].accessedOnly && node.privateStates[key].accessedOnly;
                                    statenode.privateStates[newKey].nullifierRequired = statenode.privateStates[newKey].nullifierRequired || node.privateStates[key].nullifierRequired;
                                  }
                                });  
                              });     
                              node.privateStates = Object.assign(node.privateStates,statenode.privateStates)
                             }
                          });
                          break;
                          }
                          case 'MembershipWitness': {
                            state.newPreStatementList.forEach(statenode => {
                              if(statenode.nodeType === 'MembershipWitness'){
                                Object.keys(node.privateStates).forEach(key => {
                                  Object.keys(statenode.privateStates).forEach(newKey => {
                                    if (key === newKey){
                                      statenode.privateStates[newKey].accessedOnly = statenode.privateStates[newKey].accessedOnly && node.privateStates[key].accessedOnly;
                                      statenode.privateStates[newKey].nullifierRequired = statenode.privateStates[newKey].nullifierRequired || node.privateStates[key].nullifierRequired;
                                    }
                                  });  
                                });     
                                node.privateStates = Object.assign(node.privateStates,statenode.privateStates)
                               }
                            });
                            break;
                          }
                          default :
                          break;
                        }
                     });
                     if(state.callingFncName[index].parent === 'FunctionDefinition'){
                      let oldIndex = state.intFnindex[callingFncName] ? state.intFnindex[callingFncName] : -1;
                      state.intFnindex[callingFncName] = childNode.body.statements.findIndex((statement, stIndex) => statement.expression?.nodeType === 'InternalFunctionCall' && statement.expression?.name === name && stIndex > oldIndex);
                      childNode.body.statements.splice(state.intFnindex[callingFncName] +1, 0, ...state.newStatementList);
                      //insert extra var declarations if needed
                      const findVarVisitor = (thisNode: any, state: any) => {
                        if (thisNode.nodeType === 'Identifier'){
                          if (!state.varNames.includes(thisNode.name)) {
                            state.varNames.push(thisNode.name);
                          }
                        }
                      }
                      let newVarDecs = [];
                      childNode.body.statements.forEach((node1, index1)=> {
                        state.varNames = [];
                        if (!(node1.expression && node1.expression?.nodeType === 'InternalFunctionCall')){
                          traverseNodesFast(node1, findVarVisitor,  state);
                        } 
                        state.varNames.forEach((varName) => {
                          childNode.body.statements.forEach((node2, index2)=> {
                            if (index2 > index1 && node2.nodeType === 'VariableDeclarationStatement' && node2.declarations[0].name === varName){
                              newVarDecs.push({"index": index1, "VarDec": cloneDeep(node2)});
                            }
                          });
                        });
                      });
                      newVarDecs.sort((a, b) => b.index - a.index);
                      newVarDecs.forEach((varDec) => {
                        varDec.VarDec.initialValue = undefined;
                        childNode.body.statements.splice(varDec.index, 0, varDec.VarDec);
                      });
                      // remove multiple variable declarations
                      childNode.body.statements.forEach((node1, index1)=> {
                         let isDecDeleted = false;
                         if(node1.nodeType === 'VariableDeclarationStatement'){
                          childNode.body.statements.forEach((node2, index2)=> {
                            if(!isDecDeleted && index2 < index1 && node2 && node2.nodeType === 'VariableDeclarationStatement'){
                              if ((node1.declarations[0].name === node2.declarations[0].name)){
                                childNode.body.statements.splice(index1, 1, node1.initialValue);
                                isDecDeleted = true;
                              }
                            }
                          });
                        }
                      });
                      childNode.body.statements = childNode.body.statements.filter(item => item !== null && item !== undefined);
                     } else{
                       state.newStatementList.forEach((statenode, stateid) => {
                        childNode.body.statements.forEach((node, id)=> {
                         if(node.nodeType === state.callingFncName[index].parent){
                          if(statenode.nodeType === 'VariableDeclarationStatement'){
                            childNode.body.statements[id-1] = statenode;
                           node.body.statements.forEach(kidNode =>{
                            if(kidNode.nodeType === 'ExpressionStatement'&& kidNode.expression.name === state.internalFncName[index]) {
                               kidNode.expression = Object.assign(kidNode.expression,statenode.initialValue);
                               node.body.statements?.splice(node.body.statements.indexOf(kidNode)+1, 0, state.newStatementList[stateid+1]);
                            }
                           });
                          childNode.body.statements[id-1].initialValue =undefined;
                          }
                        }
                       });
                      });
                      // remove multiple variable declarations
                      childNode.body.statements.forEach((node1, index1)=> {
                        let isDecDeleted = false;
                        if(node1.nodeType === 'VariableDeclarationStatement'){
                         childNode.body.statements.forEach((node2, index2)=> {
                           if(!isDecDeleted && index2 < index1 && node2 && node2.nodeType === 'VariableDeclarationStatement'){
                             if ((node1.declarations[0].name === node2.declarations[0].name)){
                               childNode.body.statements.splice(index1, 1, node1.initialValue);
                               isDecDeleted = true;
                             }
                           }
                         });
                       }
                     });
                     childNode.body.statements = childNode.body.statements.filter(item => item !== null && item !== undefined );
                   }

                   childNode.body.postStatements.forEach(node => {
                     switch(node.nodeType) {
                       case 'CalculateNullifier' : {
                        state.newPostStatementList.forEach(statenode => {
                          if(statenode.nodeType === 'CalculateNullifier'){
                            Object.keys(node.privateStates).forEach(key => {
                              Object.keys(statenode.privateStates).forEach(newKey => {
                                if (key === newKey){
                                  statenode.privateStates[newKey].accessedOnly = statenode.privateStates[newKey].accessedOnly && node.privateStates[key].accessedOnly;
                                }
                              });  
                            });                    
                            node.privateStates = Object.assign(node.privateStates,statenode.privateStates);
                           }
                        });
                        break;
                       }
                       case 'CalculateCommitment': {
                         state.newPostStatementList.forEach(statenode => {
                           if(statenode.nodeType === 'CalculateCommitment'){    
                             node.privateStates = Object.assign(node.privateStates,statenode.privateStates);  
                            }
                         });
                         break;
                         }
                        case 'GenerateProof': {
                          Object.keys(node.privateStates).forEach(key => {
                            Object.keys(generateProofNode.privateStates).forEach(newKey => {
                              if (key === newKey){
                                generateProofNode.privateStates[newKey].accessedOnly = generateProofNode.privateStates[newKey].accessedOnly && node.privateStates[key].accessedOnly;
                                generateProofNode.privateStates[newKey].nullifierRequired = generateProofNode.privateStates[newKey].nullifierRequired || node.privateStates[key].nullifierRequired;
                                generateProofNode.privateStates[newKey].initialisationRequired = generateProofNode.privateStates[newKey].initialisationRequired || node.privateStates[key].initialisationRequired;
                              }
                            });  
                          });        
                          node.privateStates = Object.assign(node.privateStates,generateProofNode.privateStates);
                          node.parameters = [...new Set([...node.parameters ,...generateProofNode.parameters])];
                          break;
                        }
                        case 'SendTransaction': {
                          Object.keys(node.privateStates).forEach(key => {
                            Object.keys(sendTransactionNode.privateStates).forEach(newKey => {
                              if (key === newKey){
                                sendTransactionNode.privateStates[newKey].accessedOnly = sendTransactionNode.privateStates[newKey].accessedOnly && node.privateStates[key].accessedOnly;
                                sendTransactionNode.privateStates[newKey].nullifierRequired = sendTransactionNode.privateStates[newKey].nullifierRequired || node.privateStates[key].nullifierRequired;
                              }
                            });  
                          });      
                           node.privateStates = Object.assign(node.privateStates,sendTransactionNode.privateStates)
                          break;
                        }
                        case 'WritePreimage': {
                          node.privateStates = Object.assign(node.privateStates,writePreimageNode.privateStates)
                          break;
                        }
                         default :
                         break;
                       }
                    });
                  }
                })
              }
            })
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
      const fn_name = node.expression.name;
      state.newStateArray ??= {};
      state.newStateArray[fn_name] ??= [];
      for (const arg of args) {
      if(arg.expression?.typeDescriptions.typeIdentifier.includes('_struct'))
        state.newStateArray[fn_name] =  args.map(arg => (arg.expression.name+'.'+arg.memberName));
      else
       state.newStateArray[fn_name] =  args.map(arg => (arg.name));
      }
      let internalFunctionInteractsWithSecret = false;
      const newState: any = {};
      state.oldStateArray = state.oldStateArray ? state.oldStateArray : {};
      state.oldStateArray[fn_name] = internalFunctionCallVisitor(path, newState);
      internalFunctionInteractsWithSecret ||= newState.internalFunctionInteractsWithSecret;
      state.internalFncName ??= [];
      state.internalFncName.push(node.expression.name);
     if(internalFunctionInteractsWithSecret === true) {
       const callingfnDefPath = path.getFunctionDefinition();
       const callingfnDefIndicators = callingfnDefPath?.scope.indicators;
       const functionReferncedNode = scope.getReferencedPath(node.expression);
       const internalfnDefIndicators = functionReferncedNode?.scope.indicators;
       const startNodePath = path.getAncestorOfType('ContractDefinition');
       startNodePath?.node.nodes.forEach(node => {
         if(node.nodeType === 'VariableDeclaration' && !node.typeDescriptions.typeIdentifier.includes('_struct')){
           if(internalfnDefIndicators[node.id] && internalfnDefIndicators[node.id].isModified){
             if(callingfnDefIndicators[node.id]) {
             if(callingfnDefIndicators[node.id].isModified) {
               if(internalfnDefIndicators[node.id].isMapping){
                Object.keys(internalfnDefIndicators[node.id].mappingKeys).forEach(name => {
                  if(state.newStateArray[fn_name].some(statename => statename === name))
                   isCircuit = false;
                  else
                  isCircuit = true;
                })
              } else
              isCircuit = false;
             }
             }
             else
                 isCircuit = true;
            }
            }
        });
        state.circuitImport ??= [];
        if(isCircuit)
        state.circuitImport.push('true');
        else
        state.circuitImport.push('false');
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
      else if(!internalFunctionInteractsWithSecret){
      state.circuitImport ??= [];
      state.circuitImport.push('false');
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
     state.callingFncName.push({name: fnDefNode?.node.name, parent: path.parentPath.parentPath.parent.nodeType});
    }
  },
},
}
export default internalCallVisitor;
