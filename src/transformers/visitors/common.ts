import NodePath from '../../traverse/NodePath.js';
import { FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import explode from './explode.js';
import { traversePathsFast } from '../../traverse/traverse.js';

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

 export function transformation1(type:string , oldAST: any , state: any , visitor: any) {
  const newAST = {
    nodeType: 'Folder',
    files: [],
  };

  let path = oldAST;

  if(type !== 'orchestration')
  { 
    const dummyParent = {
      ast: oldAST,
    };
   path = new NodePath({
    parentPath: null,
    parent: dummyParent,
    key: 'ast', // since parent.ast = node
    container: oldAST,
    index: null,
    node: oldAST,
  }); // This won't actually get initialised with the info we're providing if the `node` already exists in the NodePath cache. That's ok, as long as all transformers use the same dummyParent layout.
  }
  // Delete (reset) the `._newASTPointer` subobject of each node (which collectively represent the new AST). It's important to do this if we want to start transforming to a new AST.
  traversePathsFast(path, (p: typeof path) => delete p.node._newASTPointer);

  if(type !== 'contract') {
  path.parent._newASTPointer = newAST;
  path.node._newASTPointer = newAST.files;
  }
  else
  path.parent._newASTPointer = newAST.files;

  // We'll start by calling the traverser function with our ast and a visitor.
  // The newAST will be mutated through this traversal process.
  path.traverse(explode(visitor), state);

  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return newAST;
}

