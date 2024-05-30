
import cloneDeep from 'lodash.clonedeep';
import NodePath from '../../traverse/NodePath.js';
import { FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import buildNode from '../../types/orchestration-types.js'

// We need to ensure that parameters appear in the same order as in the .mjs file if the same state variables are used in multiple function calls.
// All parameters relating to the same state variable should be grouped together.
const reorderParameters = (parameterList: any) => {
  parameterList.forEach((param, index) => {
    parameterList.forEach((newParam, newIndex) => {
      if (param.name === newParam.name && param.bpType === 'nullification' && newParam.bpType === 'nullification') {
        if (newIndex > index && param.isAccessed && !param.isNullified && (newParam.isNullified || !newParam.isAccessed) ){
          parameterList[index] = newParam;
        }
      } 
      if (param.name === newParam.name && param.bpType === 'oldCommitmentExistence' && newParam.bpType === 'oldCommitmentExistence') {
        if (newIndex > index && (!param.isWhole || !param.initialisationRequired) && (newParam.isWhole && newParam.initialisationRequired) ){
          parameterList[index] = newParam;
        }
      }
    });
  });
  let newBPName: string;
  let currentIndex: number;
  let newCommitment = {};
  parameterList.forEach((param, index) => {
    if (param.name != newBPName && param.bpType){
      newBPName = param.name;
      currentIndex = index;
      newCommitment[newBPName] = newCommitment[newBPName] ? newCommitment[newBPName] : [];
      newCommitment[newBPName].push({"firstIndex": currentIndex, "isNewCommitment": false });
    }
    if (param.bpType === 'newCommitment'){
      newCommitment[newBPName][newCommitment[newBPName].length -1].isNewCommitment = true;
      newCommitment[newBPName][newCommitment[newBPName].length -1].newCommitmentIndex = index;
    }
    if (param.bpType === 'mapping'){
      newCommitment[newBPName][newCommitment[newBPName].length -1].mappingIndex = index;
    }
    if (param.bpType === 'oldCommitmentExistence'){
      newCommitment[newBPName][newCommitment[newBPName].length -1].oldCommitmentIndex = index;
    }
  });
  let elementsToAdd = [];
  Object.keys(newCommitment).forEach((varName) => {
    if (newCommitment[varName][0].isNewCommitment === false && newCommitment[varName].length > 1){
      let isSwapped = false;
      newCommitment[varName].forEach((element) => {
        if (element.isNewCommitment === true && !isSwapped){
          let newIndex = newCommitment[varName][0].oldCommitmentIndex +1 || newCommitment[varName][0].mappingIndex+1 || newCommitment[varName][0].firstIndex +1;
          let oldIndex = element.newCommitmentIndex;
          elementsToAdd.push({"element": parameterList[oldIndex], "NewIndex": newIndex});
        }
      });
    }
  });
  elementsToAdd.sort((a, b) => b.NewIndex - a.NewIndex );
  elementsToAdd.forEach((element) => {
    parameterList.splice(element.NewIndex, 0, element.element);
  });
}


// We need to ensure that preStatments and postStatements are in the right order.
const reorderBoilerPlate = (bpStatementList: any) => {
  let order = ['mapping','PoKoSK', 'nullification', 'oldCommitmentPreimage', 'oldCommitmentExistence', 'newCommitment', 'encryption'];
  bpStatementList.sort((a, b) => {
    if (a.name === b.name) {
      return order.indexOf(a.bpType) - order.indexOf(b.bpType);
    } else {
      return 0;
    }
  });
}

// let interactsWithSecret = false; // Added globaly as two objects are accesing it

const internalCallVisitor = {
 ContractDefinition: {
 // We Add the InternalFunctionCall nodes at the exit node so that all others gets build we need to access
   exit(path: NodePath, state: any) {

     // Find the Internal Function Node,
     const { node, parent } = path;
     state.intFnindex = {}; 
      state.internalFncName?.forEach( (name,index) => {
        if (!state.intFnindex[name]) state.intFnindex[name] = {};
        let callingFncName = state.callingFncName[index].name;
         node._newASTPointer.forEach(file => {
        if(file.fileName === name) {
            file.nodes.forEach(childNode => {
              if(childNode.nodeType === 'FunctionDefinition'){
                state.newParameterList = cloneDeep(childNode.parameters.parameters);
                state.newReturnParameterList = cloneDeep(childNode.returnParameters.parameters);
                state.newPreStatementList = cloneDeep(childNode.body.preStatements);
                state.newPostStatementList = cloneDeep(childNode.body.postStatements);
                
                 state.newParameterList.forEach((node, nodeIndex) => {
                  if(node.nodeType === 'Boilerplate') {
                    for(const [id, oldStateName] of  state.oldStateArray[name].entries()) {
                      node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[name][id].name)
                      if(node.newCommitmentValue === oldStateName)
                       node.newCommitmentValue = node.newCommitmentValue.replace(oldStateName, state.newStateArray[name][id].name)
                      if(node.mappingKeyName === oldStateName)
                       node.mappingKeyName = node.mappingKeyName.replace(oldStateName, state.newStateArray[name][id].name)
                     }
                   }
                   if(node.nodeType === 'VariableDeclaration'){
                     for(const [id, oldStateName] of state.oldStateArray[name].entries()) {
                       if(oldStateName !== state.newStateArray[name][id].name)
                       node.name = state.newStateArray[name][id].name;
                       node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[name][id].name)
                       if(state.newStateArray[name][id].memberName)
                       state.newParameterList.splice(nodeIndex,1);
                     }
                   }
                 })
                 state.newReturnParameterList.forEach((node,nodeIndex) => {
                  for(const [id, oldStateName] of state.oldStateArray[name].entries()) {
                    if(oldStateName !== state.newStateArray[name][id].name)
                    node.name = state.newStateArray[name][id].name;
                 node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[name][id].name)
                 if(state.newStateArray[name][id].memberName)
                    state.state.newReturnParameterList.splice(nodeIndex,1);
                  }
                 })
               } else if (childNode.nodeType === 'ImportStatementList'){
                state.newImportStatementList = cloneDeep(childNode.imports);            
               }
             })
            if(state.circuitImport[index].isImported ==='true') {
// Collect the internal call ParameterList
            let internalFncParameters: string[] = [];
            state.newParameterList.forEach(node => {
              if(node.nodeType === 'VariableDeclaration'){
                internalFncParameters.push(node.name);
              }
             switch(node.bpType) {
                 case 'PoKoSK' :{
                   internalFncParameters.push(`${node.name}_oldCommitment_owner_secretKey`)
                   break;
                 };
                 case 'nullification' : {
                  internalFncParameters.push(`${node.name}_oldCommitment_owner_secretKey`) ;
                  internalFncParameters.push(`nullifierRoot`);
                  if (!(node.isAccessed && !node.isNullified)) internalFncParameters.push(`newNullifierRoot`);
                  if (!(node.isAccessed && !node.isNullified)) internalFncParameters.push(`${node.name}_oldCommitment_nullifier`);
                  internalFncParameters.push(`${node.name}_nullifier_nonmembershipWitness_siblingPath`);
                  if (!(node.isAccessed && !node.isNullified)) internalFncParameters.push(`${node.name}_nullifier_nonmembershipWitness_newsiblingPath`);
                  break;
                 };
                 case 'oldCommitmentPreimage' : {
                  internalFncParameters.push(`${node.name}_oldCommitment_value`) ;
                  internalFncParameters.push(`${node.name}_oldCommitment_salt`);
                  break;
                 };
                case 'oldCommitmentExistence' :{
                  if (node.isWhole && !(node.isAccessed && !node.isNullified))
                  internalFncParameters.push(`${node.name}_oldCommitment_isDummy`);
                  internalFncParameters.push(`commitmentRoot`) ;
                  internalFncParameters.push(`${node.name}_oldCommitment_membershipWitness_index`) ;
                  internalFncParameters.push(`${node.name}_oldCommitment_membershipWitness_siblingPath`);
                  break;
                 };
                case 'newCommitment' : {
                  state.isEncrypted ? ' ': internalFncParameters.push(`${node.name}_newCommitment_owner_publicKey`) ;
                  internalFncParameters.push(`${node.name}_newCommitment_salt`) ;
                  internalFncParameters.push(`${node.name}_newCommitment_commitment`);
                  break;
                 };
                case 'mapping' :
                  internalFncParameters.push(`${node.mappingKeyName}`);
                 break;
                case 'encryption' :
                  internalFncParameters.push(`${node.name}_newCommitment_ephSecretKey`);
                  internalFncParameters.push(`${node.name}_newCommitment_owner_publicKey_point`);
               }
             })

            // to remove duplicates from the parameters
            internalFncParameters.forEach(param => {
              if (!state.circuitArguments?.includes(param)) {
                state.circuitArguments ??= [];
                state.circuitArguments.push(param);
               }
             });
            }

            node._newASTPointer.forEach(file => {
              if(file.fileName === callingFncName){
                file.nodes.forEach(childNode => {
                  if(childNode.nodeType === 'StructDefinition' && !state.isAddStructDefinition && state.circuitImport[index].isImported === 'true')
                   file.nodes.splice(file.nodes.indexOf(childNode),1);
                })
                file.nodes.forEach(childNode => {
                  if(childNode.nodeType === 'FunctionDefinition'){
                    childNode.parameters.parameters = [...new Set([...childNode.parameters.parameters, ...state.newParameterList])];
                    reorderParameters(childNode.parameters.parameters);
                    childNode.returnParameters.parameters = [...new Set([...childNode.returnParameters.parameters, ...state.newReturnParameterList])];
                    if(childNode.nodeType === 'FunctionDefinition' && state.callingFncName[index].parent === 'FunctionDefinition' && state.circuitImport[index].isImported === 'true'){
                      childNode.body.statements.forEach(node => {
                      if(node.nodeType === 'ExpressionStatement') {
                        if(node.expression.nodeType === 'InternalFunctionCall' && node.expression.name === name){
                          node.expression.CircuitArguments = node.expression.CircuitArguments.concat(state.circuitArguments);
                          state.circuitArguments = [];
                          node.expression.CircuitReturn = node.expression.CircuitReturn.concat(state.newReturnParameterList);
                         }
                       }
                     })
                   } else if (state.circuitImport[index].isImported === 'true') {
                        childNode.body.statements.forEach(node => {
                          if(node.nodeType === state.callingFncName[index].parent){
                            node.body.statements.forEach(kidNode => {
                              if(kidNode.nodeType === 'ExpressionStatement') {
                                if(kidNode.expression.nodeType === 'InternalFunctionCall' && kidNode.expression.name === name){
                                  kidNode.expression.CircuitArguments = kidNode.expression.CircuitArguments.concat(state.circuitArguments);
                                  state.circuitArguments = [];
                                  kidNode.expression.CircuitReturn = kidNode.expression.CircuitReturn.concat(state.newReturnParameterList);
                                 }
                               }
                             })
                          }
                        })
                   }
                 }
                 })
               }

             })

          if(state.circuitImport[index].isImported === 'false'){
            let newExpressionList = [];
            let isPartitioned = false
            let internalFncbpType: string;
            let callingFncbpType: string;
            let commitmentValue: string;
            file.nodes.forEach(childNode => {
              if(childNode.nodeType === 'FunctionDefinition'){
                childNode.body.statements.forEach(node => {
                  if(node.isPartitioned) {
                    isPartitioned = true;
                    internalFncbpType = node.bpType;
                  }
                  if(node.nodeType === 'ExpressionStatement') {
                    if(node.expression.nodeType === 'Assignment') {
                      let  expressionList = cloneDeep(node);
                      for(const [id, oldStateName] of  state.oldStateArray[name].entries()) {
                          if(state.newStateArray[name][id].memberName ){
                            if(node.expression.rightHandSide.rightExpression.name === oldStateName)
                             expressionList.expression.rightHandSide.rightExpression.name = expressionList.expression.rightHandSide.rightExpression.name.replace(oldStateName, state.newStateArray[name][id].name+'.'+state.newStateArray[name][id].memberName)
                            if(expressionList.expression.rightHandSide.rightExpression.leftExpression){
                             expressionList.expression.rightHandSide.rightExpression.leftExpression.name = expressionList.expression.rightHandSide.rightExpression.leftExpression.name?.replace(oldStateName, state.newStateArray[name][id].name+'.'+state.newStateArray[name][id].memberName)
                             expressionList.expression.rightHandSide.rightExpression.rightExpression.name = expressionList.expression.rightHandSide.rightExpression.rightExpression.name?.replace(oldStateName, state.newStateArray[name][id].name+'.'+state.newStateArray[name][id].memberName)
                           }
                         }
                          else{
                            if(node.expression.rightHandSide.rightExpression.name === oldStateName)
                             expressionList.expression.rightHandSide.rightExpression.name = expressionList.expression.rightHandSide.rightExpression.name.replace(oldStateName, state.newStateArray[name][id].name)
                            if(expressionList.expression.rightHandSide.rightExpression.leftExpression){
                             expressionList.expression.rightHandSide.rightExpression.leftExpression.name = expressionList.expression.rightHandSide.rightExpression.leftExpression.name?.replace(oldStateName, state.newStateArray[name][id].name)
                             expressionList.expression.rightHandSide.rightExpression.rightExpression.name = expressionList.expression.rightHandSide.rightExpression.rightExpression.name?.replace(oldStateName, state.newStateArray[name][id].name)
                           }
                          }
                        if(node.expression.leftHandSide.name === oldStateName)
                         expressionList.expression.leftHandSide.name = expressionList.expression.leftHandSide.name.replace(oldStateName, state.newStateArray[name][id].name)
                       }
                      newExpressionList = newExpressionList.concat(expressionList);
                     }
                   }
                 });
                 childNode.body.preStatements.forEach(node => {
                   if(node.isPartitioned){
                     commitmentValue = node.newCommitmentValue;
                     for(const [id, oldStateName] of  state.oldStateArray[name].entries()) {
                       if(commitmentValue.includes(oldStateName)){
                         if(state.newStateArray[name][id].memberName)
                           commitmentValue = commitmentValue.replace(oldStateName,state.newStateArray[name][id].name+'.'+state.newStateArray[name][id].memberName);
                         else
                          commitmentValue = commitmentValue.replace(oldStateName,state.newStateArray[name][id].name);
                       }
                     }
                   }
                 })
               }
             })
             node._newASTPointer.forEach(file => {
              if(file.fileName === callingFncName) {
                file.nodes.forEach(childNode => {
                  if(childNode.nodeType === 'FunctionDefinition') {
                    childNode.body.statements.forEach(node => {
                      if(node.nodeType==='BoilerplateStatement'){
                        callingFncbpType = node.bpType;
                      }
                    })
                    let oldIndex = state.intFnindex[name][callingFncName] ? state.intFnindex[name][callingFncName] : -1;
                    if(state.callingFncName[index].parent === 'FunctionDefinition'){
                      // When merging the statements, we need to ensure that the new statements are added after the InternalFunctionCall statement.
                      state.intFnindex[name][callingFncName] = childNode.body.statements.findIndex((statement, stIndex) => statement.expression?.nodeType === 'InternalFunctionCall' && statement.expression?.name === name && stIndex > oldIndex);
                      childNode.body.statements.splice(state.intFnindex[name][callingFncName] +1, 0, ...newExpressionList);
                    }
                    else{
                      childNode.body.statements.forEach(node => {
                        if(node.nodeType === state.callingFncName[index].parent){
                          state.intFnindex[name][callingFncName] = node.body.statements.findIndex((statement, stIndex) => statement.expression?.nodeType === 'InternalFunctionCall' && statement.expression?.name === name && stIndex > oldIndex);
                          node.body.statements.splice(state.intFnindex[name][callingFncName] +1, 0, ...newExpressionList);
                        }
                      })
                    }
                    childNode.body.preStatements.forEach( node => {
                      if(isPartitioned){
                      if((internalFncbpType === callingFncbpType))
                       node.newCommitmentValue = node.newCommitmentValue+' + ('+commitmentValue+')';
                      else
                       node.newCommitmentValue = node.newCommitmentValue+' - ('+commitmentValue+')';
                     }
                    });
                    // We need to merge the pre-statments and post-statements of the internal function with the calling function.
                    childNode.body.preStatements.forEach(node => {
                      switch(node.bpType) {
                        case 'PoKoSK' : {
                         state.newPreStatementList.forEach(statenode => {
                           if(statenode.bpType === 'PoKoSK' && statenode.name === node.name){
                            statenode.isNullified = statenode.isNullified || node.isNullified;
                            node = Object.assign(node,statenode);
                          }
                         });
                         break;
                        }
                        case 'nullification' : {
                          state.newPreStatementList.forEach(statenode => {
                            if(statenode.bpType === 'nullification' && statenode.name === node.name){
                             statenode.isNullified = statenode.isNullified || node.isNullified;
                             node = Object.assign(node,statenode);
                           }
                          });
                          break;
                          }
                        case 'oldCommitmentPreimage' : {
                          state.newPreStatementList.forEach(statenode => {
                            if(statenode.bpType === 'oldCommitmentPreimage' && statenode.name === node.name){
                              statenode.isNullified = statenode.isNullified || node.isNullified;
                              node = Object.assign(node,statenode);
                            }
                          });
                          break;
                          }  
                        case 'oldCommitmentExistence' : {
                          state.newPreStatementList.forEach(statenode => {
                            if(statenode.bpType === 'oldCommitmentExistence' && statenode.name === node.name){
                              statenode.isNullified = statenode.isNullified || node.isNullified;
                              node = Object.assign(node,statenode);
                            }
                          });
                          break;
                          }
                        case 'newCommitment' : {
                          state.newPreStatementList.forEach(statenode => {
                            if(statenode.bpType === 'newCommitment' && statenode.name === node.name){
                              statenode.isNullified = statenode.isNullified || node.isNullified;
                              node = Object.assign(node,statenode);
                            }
                          });
                          break;
                          }  
                        default :
                        break;
                      }
                     });
                    let nonDuplicatePreStatements = [];
                    state.newPreStatementList.forEach(stateNode => {
                      let isDuplicate = false;
                      let dupIndex =0;
                      childNode.body.preStatements.forEach((existingNode, exIndex) => {
                        if(existingNode.bpType === stateNode.bpType && existingNode.name === stateNode.name){
                          isDuplicate = true;
                        }
                        if (existingNode.name === stateNode.name) {
                          dupIndex = exIndex;
                        }
                      });
                      if (!isDuplicate) nonDuplicatePreStatements.push({node: stateNode, index: dupIndex });
                    });
                    nonDuplicatePreStatements.forEach(dupNode => {
                      childNode.body.preStatements.splice(dupNode.index +1, 0, dupNode.node);
                    });
                    reorderBoilerPlate(childNode.body.preStatements);
                    childNode.body.postStatements.forEach( node => {
                      if(isPartitioned){
                      if(internalFncbpType === callingFncbpType)
                       node.newCommitmentValue = node.newCommitmentValue+' + ('+commitmentValue+')';
                      else
                       node.newCommitmentValue = node.newCommitmentValue+' - ('+commitmentValue+')';
                     }
                    })
                    childNode.body.postStatements.forEach(node => {
                      switch(node.bpType) {
                        case 'PoKoSK' : {
                         state.newPostStatementList.forEach(statenode => {
                           if(statenode.bpType === 'PoKoSK' && statenode.name === node.name){
                            statenode.isNullified = statenode.isNullified || node.isNullified;
                            node = Object.assign(node,statenode);
                          }
                         });
                         break;
                        }
                        case 'nullification' : {
                          state.newPostStatementList.forEach(statenode => {
                            if(statenode.bpType === 'nullification' && statenode.name === node.name){
                             statenode.isNullified = statenode.isNullified || node.isNullified;
                             node = Object.assign(node,statenode);
                           }
                          });
                          break;
                          }
                        case 'oldCommitmentPreimage' : {
                          state.newPostStatementList.forEach(statenode => {
                            if(statenode.bpType === 'oldCommitmentPreimage' && statenode.name === node.name){
                              statenode.isNullified = statenode.isNullified || node.isNullified;
                              node = Object.assign(node,statenode);
                            }
                          });
                          break;
                          }  
                        case 'oldCommitmentExistence' : {
                          state.newPostStatementList.forEach(statenode => {
                            if(statenode.bpType === 'oldCommitmentExistence' && statenode.name === node.name){
                              statenode.isNullified = statenode.isNullified || node.isNullified;
                              node = Object.assign(node,statenode);
                            }
                          });
                          break;
                          }
                        case 'newCommitment' : {
                          state.newPostStatementList.forEach(statenode => {
                            if(statenode.bpType === 'newCommitment' && statenode.name === node.name){
                              statenode.isNullified = statenode.isNullified || node.isNullified;
                              node = Object.assign(node,statenode);
                            }
                          });
                          break;
                          }  
                        default :
                        break;
                      }
                     });
                    let nonDuplicatePostStatements = [];
                    state.newPostStatementList.forEach(stateNode => {
                       let isDuplicate = false;
                       let dupIndex = undefined;
                       childNode.body.postStatements.forEach((existingNode, exIndex) => {
                         if(existingNode.bpType === stateNode.bpType && existingNode.name === stateNode.name){
                           isDuplicate = true;
                         }
                         if (existingNode.name === stateNode.name) {
                           dupIndex = exIndex;
                         }
                       });
                       if (!isDuplicate) nonDuplicatePostStatements.push({node: stateNode, index: dupIndex });
                    });
                    nonDuplicatePostStatements.forEach(dupNode => {
                       childNode.body.postStatements.splice(!dupNode.index ? 0 : dupNode.index +1, 0, dupNode.node);
                    });
                    reorderBoilerPlate(childNode.body.postStatements);
                  } else if (childNode.nodeType === 'ImportStatementList'){
                    childNode.imports = [...new Set([...childNode.imports, ...state.newImportStatementList])];
                  }

                 })
               }
             })
           }
         }
       })
     });
     
   },
 },


 };

 export default internalCallVisitor;
