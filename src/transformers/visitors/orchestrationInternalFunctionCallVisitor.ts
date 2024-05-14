import cloneDeep from 'lodash.clonedeep';
import NodePath from '../../traverse/NodePath.js';
import { FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import  buildNode  from '../../types/orchestration-types.js';
import { internalFunctionCallVisitor } from './common.js';

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
       state.internalFncName?.forEach( (name, index)=> {
         if(file.fileName === name && file.nodeType === 'File') {
           if(state.circuitImport[index]==='true') {
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
               state.newStatementList.forEach(node => {
                 if(node.nodeType === 'VariableDeclarationStatement'){
                   node.declarations.forEach(node => {
                     for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                       node.name = node.name.replace('_'+oldStateName, '_'+ state.newStateArray[name][index]);
                      }
                    });
                   for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                     node.initialValue.leftHandSide.name = node.initialValue.leftHandSide.name.replace('_'+oldStateName, '_'+ state.newStateArray[name][index]);
                     if (node.initialValue.rightHandSide.name) node.initialValue.rightHandSide.name = node.initialValue.rightHandSide.name.replace(oldStateName,  state.newStateArray[name][index]);
                    }
                  }
                  if(node.nodeType === 'Assignment'){
                    for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                      node.leftHandSide.name = node.leftHandSide.name.replace('_'+oldStateName, '_'+ state.newStateArray[name][index]);
                      if (node.rightHandSide.name) node.rightHandSide.name = node.rightHandSide.name.replace('_'+oldStateName, '_'+ state.newStateArray[name][index]);
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
            })
            node._newASTPointer.forEach(file => {
             if(file.fileName === state.callingFncName[index].name) {
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
                             node.privateStates = Object.assign(node.privateStates,statenode.privateStates)
                            }
                         });
                         break;
                        }
                        case 'ReadPreimage': {
                          state.newPreStatementList.forEach(statenode => {
                            if(statenode.nodeType === 'ReadPreimage'){
                              node.privateStates = Object.assign(node.privateStates,statenode.privateStates)
                             }
                          });
                          break;
                          }
                          case 'MembershipWitness': {
                            state.newPreStatementList.forEach(statenode => {
                              if(statenode.nodeType === 'MembershipWitness'){
                                node.privateStates = Object.assign(node.privateStates,statenode.privateStates)
                               }
                            });
                            break;
                          }
                          default :
                          break;
                        }
                     });
                     let dupNode;
                     let dupIndex;
                     let dupAssignNode;
                     if(state.callingFncName[index].parent === 'FunctionDefinition'){
                       childNode.body.statements.forEach((node, index)=> {
                         if(node.nodeType === 'VariableDeclarationStatement'){
                           state.newStatementList.some((statenode, id ) => {
                             if(statenode.nodeType === 'VariableDeclarationStatement' && (node.declarations[0].name === statenode.declarations[0].name)){
                               dupNode = statenode;
                               dupIndex = index;
                               dupAssignNode = state.newStatementList[id+1];

                             }
                           })
                         }
                       })
                       if(dupNode){
                         childNode.body.statements.splice(dupIndex+2, 0, dupNode.initialValue);
                         childNode.body.statements.splice(dupIndex+3, 0, dupAssignNode);
                       }
                       else
                       childNode.body.statements = [...new Set([...childNode.body.statements, ...state.newStatementList])]
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
                     })
                     childNode.body.statements[id-1].initialValue ={};
                   }
                 }
                  })

            })

                   }

                   childNode.body.postStatements.forEach(node => {
                     switch(node.nodeType) {
                       case 'CalculateNullifier' : {
                        state.newPostStatementList.forEach(statenode => {
                          if(statenode.nodeType === 'CalculateNullifier'){
                            node.privateStates = Object.assign(node.privateStates,statenode.privateStates)
                           }
                        });
                        break;
                       }
                       case 'CalculateCommitment': {
                         state.newPostStatementList.forEach(statenode => {
                           if(statenode.nodeType === 'CalculateCommitment'){
                             node.privateStates = Object.assign(node.privateStates,statenode.privateStates)
                            }
                         });
                         break;
                         }
                        case 'GenerateProof': {
                          node.privateStates = Object.assign(node.privateStates,generateProofNode.privateStates)
                          node.parameters = [...new Set([...node.parameters ,...generateProofNode.parameters])];
                          break;
                        }
                        case 'SendTransaction': {
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
          if(state.circuitImport[index] === 'false') {
           file.nodes.forEach(childNode => {
             if(childNode.nodeType === 'FunctionDefinition'){
               state.newStatementList = cloneDeep(childNode.body.statements);
               state.newStatementList.forEach(node => {
                 if(node.nodeType === 'VariableDeclarationStatement') {
                   for(const [index, oldStateName] of  state.oldStateArray[name].entries()) {
                     node.initialValue.leftHandSide.name = node.initialValue.leftHandSide.name?.replace('_'+oldStateName, '_'+ state.newStateArray[name][index]);
                     node.initialValue.rightHandSide.name = node.initialValue.rightHandSide.name?.replace(oldStateName,  state.newStateArray[name][index]);
                    }
                  }
                })
              }
            })

            node._newASTPointer.forEach(file => {
             if(file.fileName === state.callingFncName[index].name) {
               file.nodes.forEach(childNode => {
                 if(childNode.nodeType === 'FunctionDefinition') {
                   if(state.callingFncName[index].parent === 'FunctionDefinition'){
                     state.statementnode = childNode;
                   } else{
                     childNode.body.statements.forEach(kidNode => {
                       if(kidNode.nodeType === state.callingFncName[index].parent)
                         state.statementnode = kidNode;
                   })
                 }
                   state.statementnode.body.statements.forEach(node => {
                     if(node.nodeType === 'ExpressionStatement'&& node.expression.name === state.internalFncName[index]) {
                       state.newStatementList.forEach(list => {
                         if(list.nodeType === 'VariableDeclarationStatement')
                          node.expression = Object.assign(node.expression,list.initialValue);
                          if(list.nodeType === 'Assignment')
                          state.statementnode.body.statements?.splice(state.statementnode.body.statements.indexOf(node)+1, 0, list);
                        })
                      }
                      if(node.nodeType === 'VariableDeclarationStatement' && state.statementnode.body.statements.indexOf(node) != 0){
                        state.statementnode.body.statements.splice(0, 0, state.statementnode.body.statements.splice(state.statementnode.body.statements.indexOf(node)+1, 1)[0]);
                        state.statementnode.body.statements.splice(0, 0, state.statementnode.body.statements.splice(state.statementnode.body.statements.indexOf(node), 1)[0]);
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
       const startNodePath = path.getAncestorOfType('ContractDefinition')
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
