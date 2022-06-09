import cloneDeep from 'lodash.clonedeep';
import NodePath from '../../traverse/NodePath.js';
import { StateVariableIndicator, FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import { VariableBinding } from '../../traverse/Binding.js';
import MappingKey from '../../traverse/MappingKey.js'
import buildNode from '../../types/orchestration-types.js';
import { buildPrivateStateNode } from '../../boilerplate/orchestration/javascript/nodes/boilerplate-generator.js';
import explode from './explode.js';
import internalCallVisitor from './orchestrationInternalFunctionCallVisitor.js';
// below stub will only work with a small subtree - passing a whole AST will always give true!
// useful for subtrees like ExpressionStatements

export const interactsWithSecretVisitor = (thisPath: NodePath, thisState: any) => {
  if (thisPath.scope.getReferencedBinding(thisPath.node)?.isSecret)
    thisState.interactsWithSecret = true;
};

export const internalFunctionCallVisitor = (thisPath: NodePath, thisState: any) => {
  const { node, scope } = thisPath;
   const args = node.arguments;
   let parametercheck = true ;
   let isSecretArray : string[];
   let oldStateArray : string[];
   for (const arg of args) {
     if (arg.nodeType !== 'Identifier') continue;
   isSecretArray = args.map(arg => scope.getReferencedBinding(arg).isSecret);
 }
 if(node.expression.nodeType === 'Identifier') {
  const functionReferncedNode = scope.getReferencedNode(node.expression);
  const params = functionReferncedNode.parameters.parameters;
  oldStateArray = params.map(param => (param.name) );
  for (const [index, param] of params.entries()) {
    if(isSecretArray[index] !== param.isSecret)
    parametercheck = false;
    break;
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
 return oldStateArray;
 };

