import cloneDeep from 'lodash.clonedeep';
import NodePath from '../../traverse/NodePath.js';





// let interactsWithSecret = false; // Added globaly as two objects are accesing it
let oldStateArray : string[];
 let circuitImport = [];

const internalCallVisitor = {
 ContractDefinition: {
 // We Add the InternalFunctionCall nodes at the exit node so that all others gets build we need to access
   exit(path: NodePath, state: any) {

     // Find the Internal Function Node,
     const { node, parent } = path;
     node._newASTPointer.forEach(file => {
      state.internalFncName?.forEach( name => {
        if(file.fileName === name) {
          let index = state.internalFncName.indexOf(name);
          if(circuitImport[index]==='true') {
            file.nodes.forEach(childNode => {
              if(childNode.nodeType === 'FunctionDefinition'){
                state.newParameterList = cloneDeep(childNode.parameters.parameters);
                node._newASTPointer.forEach(file => {
                  if(file.fileName === state.callingFncName[index]){
                    file.nodes.forEach(childNode => {
                      if(childNode.nodeType === 'FunctionDefinition'){
                        let callParameterList = cloneDeep(childNode.parameters.parameters);
                       }
                     })
                   }
                 })
                 state.newParameterList.forEach(node => {
                  if(node.nodeType === 'Boilerplate') {
                    for(const [index, oldStateName] of  oldStateArray.entries()) {
                      node.name = node.name.replace('_'+oldStateName, '_'+state.newStateArray[index])
                      if(node.newCommitmentValue === oldStateName)
                       node.newCommitmentValue = node.newCommitmentValue.replace(oldStateName, state.newStateArray[index])
                      if(node.mappingKeyName === oldStateName)
                       node.mappingKeyName = node.mappingKeyName.replace(oldStateName, state.newStateArray[index])
                     }
                   }
                   if(node.nodeType === 'VariableDeclaration'){
                     for(const [index, oldStateName] of oldStateArray.entries()) {
                       node.name = node.name.replace(oldStateName, state.newStateArray[index])
                     }
                   }
                 })
               }
             })

// Collect the internal call ParameterList
            let internalFncParameters = [];
            state.newParameterList.forEach(node => {
              switch(node.bpType) {
                 case 'PoKoSK' :{
                   internalFncParameters.push(`${node.name}_oldCommitment_owner_secretKey`)
                   break;
                 };
                 case 'nullification' : {
                  internalFncParameters.push(`${node.name}_oldCommitment_owner_secretKey`) ;
                  internalFncParameters.push(`${node.name}_oldCommitment_nullifier`);
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
                  internalFncParameters.push(`${node.name}_newCommitment_owner_publicKey`) ;
                  internalFncParameters.push(`${node.name}_newCommitment_salt`) ;
                  internalFncParameters.push(`${node.name}_newCommitment_commitment`);
                  break;
                 };
                case 'mapping' :
                  internalFncParameters.push(`${node.mappingKeyName}`);
                 break;
               }
             })
            internalFncParameters =  state.newStateArray.concat(internalFncParameters);
            // to remove duplicates from the parameters
            internalFncParameters.forEach(param => {
              if (!state.circuitArguments?.includes(param)) {
                state.circuitArguments ??= [];
                state.circuitArguments.push(param);
               }
             });

            node._newASTPointer.forEach(file => {
              if(file.fileName === state.callingFncName[index]){
                file.nodes.forEach(childNode => {
                  if(childNode.nodeType === 'FunctionDefinition'){
                    childNode.parameters.parameters = [...new Set([...childNode.parameters.parameters, ...state.newParameterList])]
                    childNode.body.statements.forEach(node => {
                      if(node.nodeType === 'ExpressionStatement') {
                        if(node.expression.nodeType === 'InternalFunctionCall' && node.expression.name === name){
                          node.expression.CircuitArguments = node.expression.CircuitArguments.concat(state.circuitArguments);
                          state.circuitArguments = [];
                         }
                       }
                     })
                   }
                 })
                index++;
               }
             })
           }
          else if(circuitImport[index] === 'false'){
            let newExpressionList = [];
            file.nodes.forEach(childNode => {
              if(childNode.nodeType === 'FunctionDefinition'){
                childNode.body.statements.forEach(node => {
                  if(node.nodeType === 'ExpressionStatement') {
                    if(node.expression.nodeType === 'Assignment') {
                      let  expressionList = cloneDeep(node);
                      for(const [index, oldStateName] of  oldStateArray.entries()) {
                        if(node.expression.rightHandSide.rightExpression.name === oldStateName)
                         expressionList.expression.rightHandSide.rightExpression.name = expressionList.expression.rightHandSide.rightExpression.name.replace(oldStateName, state.newStateArray[index])
                        if(node.expression.leftHandSide.name === oldStateName)
                         expressionList.expression.leftHandSide.name = expressionList.expression.leftHandSide.name.replace(oldStateName, state.newStateArray[index])
                       }
                      newExpressionList = newExpressionList.concat(expressionList);
                     }
                   }
                 });
               }
             })
             node._newASTPointer.forEach(file => {
              if(file.fileName === state.callingFncName[index]) {
                file.nodes.forEach(childNode => {
                  if(childNode.nodeType === 'FunctionDefinition')
                   childNode.body.statements = [...new Set([...childNode.body.statements, ...newExpressionList])]
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
