
import cloneDeep from 'lodash.clonedeep';
import NodePath from '../../traverse/NodePath.js';
import { FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import buildNode from '../../types/orchestration-types.js'




// let interactsWithSecret = false; // Added globaly as two objects are accesing it

const internalCallVisitor = {
 ContractDefinition: {
 // We Add the InternalFunctionCall nodes at the exit node so that all others gets build we need to access
   exit(path: NodePath, state: any) {

     // Find the Internal Function Node,
     const { node, parent } = path;
      state.internalFncName?.forEach( (name,index) => {
         node._newASTPointer.forEach(file => {
        if(file.fileName === name) {
          if(state.circuitImport[index]==='true') {
            file.nodes.forEach(childNode => {
              if(childNode.nodeType === 'FunctionDefinition'){
                state.newParameterList = cloneDeep(childNode.parameters.parameters);
                state.newReturnParameterList = cloneDeep(childNode.returnParameters.parameters);
                
                 state.newParameterList.forEach((node, nodeIndex) => {
                  if(node.nodeType === 'Boilerplate') {
                    for(const [id, oldStateName] of  state.oldStateArray.entries()) {
                      node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[name][id].name)
                      if(node.newCommitmentValue === oldStateName)
                       node.newCommitmentValue = node.newCommitmentValue.replace(oldStateName, state.newStateArray[name][id].name)
                      if(node.mappingKeyName === oldStateName)
                       node.mappingKeyName = node.mappingKeyName.replace(oldStateName, state.newStateArray[name][id].name)
                     }
                   }
                   if(node.nodeType === 'VariableDeclaration'){
                     for(const [id, oldStateName] of state.oldStateArray.entries()) {
                       if(oldStateName !== state.newStateArray[name][id].name)
                       node.name = state.newStateArray[name][id].name;
                       node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[name][id].name)
                       if(state.newStateArray[name][id].memberName)
                       state.newParameterList.splice(nodeIndex,1);
                     }
                   }
                 })
                 state.newReturnParameterList.forEach((node,nodeIndex) => {
                  for(const [id, oldStateName] of state.oldStateArray.entries()) {
                    if(oldStateName !== state.newStateArray[name][id].name)
                    node.name = state.newStateArray[name][id].name;
                 node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[name][id].name)
                 if(state.newStateArray[name][id].memberName)
                    state.state.newReturnParameterList.splice(nodeIndex,1);
                  }
                 })
               }
             })

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
                  internalFncParameters.push(`newNullifierRoot`);
                  internalFncParameters.push(`${node.name}_oldCommitment_nullifier`);
                  internalFncParameters.push(`${node.name}_nullifier_nonmembershipWitness_siblingPath`);
                  internalFncParameters.push(`${node.name}_nullifier_nonmembershipWitness_newsiblingPath`);
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

            node._newASTPointer.forEach(file => {
              if(file.fileName === state.callingFncName[index].name){
                file.nodes.forEach(childNode => {
                  if(childNode.nodeType === 'StructDefinition' && !state.isAddStructDefinition)
                   file.nodes.splice(file.nodes.indexOf(childNode),1);
                })
                file.nodes.forEach(childNode => {
                  if(childNode.nodeType === 'FunctionDefinition'){
                    childNode.parameters.parameters = [...new Set([...childNode.parameters.parameters, ...state.newParameterList])]
                    childNode.returnParameters.parameters = [...new Set([...childNode.returnParameters.parameters, ...state.newReturnParameterList])]
                    if(childNode.nodeType === 'FunctionDefinition' && state.callingFncName[index].parent === 'FunctionDefinition'){
                    childNode.body.statements.forEach(node => {
                      if(node.nodeType === 'ExpressionStatement') {
                        if(node.expression.nodeType === 'InternalFunctionCall' && node.expression.name === name){
                          node.expression.CircuitArguments = node.expression.CircuitArguments.concat(state.circuitArguments);
                          state.circuitArguments = [];
                          node.expression.CircuitReturn = node.expression.CircuitReturn.concat(state.newReturnParameterList);
                         }
                       }
                     })
                   } else {
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
           }

          else if(state.circuitImport[index] === 'false'){
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
                      for(const [id, oldStateName] of  state.oldStateArray.entries()) {
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
                     for(const [id, oldStateName] of  state.oldStateArray.entries()) {
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
              if(file.fileName === state.callingFncName[index].name) {
                file.nodes.forEach(childNode => {
                  if(childNode.nodeType === 'FunctionDefinition') {
                    childNode.body.statements.forEach(node => {
                      if(node.nodeType==='BoilerplateStatement'){
                        callingFncbpType = node.bpType;
                      }
                    })
                    if(childNode.nodeType === 'FunctionDefinition' && state.callingFncName[index].parent === 'FunctionDefinition')
                    childNode.body.statements = [...new Set([...childNode.body.statements, ...newExpressionList])];
                    else{
                      childNode.body.statements.forEach(node => {
                        if(node.nodeType === state.callingFncName[index].parent)
                          node.body.statements = [...new Set([...node.body.statements, ...newExpressionList])];
                           })
                    }
                    childNode.body.preStatements.forEach( node => {
                      if(isPartitioned){
                      if((internalFncbpType === callingFncbpType))
                       node.newCommitmentValue = node.newCommitmentValue+' + ('+commitmentValue+')';
                      else
                       node.newCommitmentValue = node.newCommitmentValue+' - ('+commitmentValue+')';
                     }
                    })

                    childNode.body.postStatements.forEach( node => {
                      if(isPartitioned){
                      if(internalFncbpType === callingFncbpType)
                       node.newCommitmentValue = node.newCommitmentValue+' + ('+commitmentValue+')';
                      else
                       node.newCommitmentValue = node.newCommitmentValue+' - ('+commitmentValue+')';
                     }
                    })
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


 };

 export default internalCallVisitor;
