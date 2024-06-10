import NodePath from '../../traverse/NodePath.js';
import { FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import explode from './explode.js';
import buildNode from '../../types/orchestration-types.js';
import { traversePathsFast } from '../../traverse/traverse.js';


// 1 - InitialisePreimage - whole states - per state
// 2 - ReadPreimage - oldCommitmentAccessRequired - per state
// 3 - MembershipWitness - nullifiersRequired - per state
// 4 - CalculateNullifier - nullifiersRequired - per state
// 5 - CalculateCommitment - newCommitmentsRequired - per state
// 6 - GenerateProof - all - per function
// 7 - EncryptBackupPreimage -newCommitmentsRequired - per state
// 8 - SendTransaction - all - per function
// 9 - WritePreimage - all - per state

export const initialiseOrchestrationBoilerplateNodes = (fnIndicator: FunctionDefinitionIndicator, path: NodePath) => {
  const { node, parent } = path;
  const newNodes: any = {};
  const contractName = `${parent.name}Shield`;
  newNodes.InitialiseKeysNode = buildNode('InitialiseKeys', {
    contractName,
    onChainKeyRegistry: fnIndicator.onChainKeyRegistry,
  });
  if (fnIndicator.oldCommitmentAccessRequired || fnIndicator.internalFunctionoldCommitmentAccessRequired)
    newNodes.initialisePreimageNode = buildNode('InitialisePreimage');
  newNodes.readPreimageNode = buildNode('ReadPreimage', {
    contractName,
  });
  if (fnIndicator.nullifiersRequired || fnIndicator.containsAccessedOnlyState || fnIndicator.internalFunctionInteractsWithSecret) {
    newNodes.membershipWitnessNode = buildNode('MembershipWitness', {
      contractName,
    });
    newNodes.calculateNullifierNode = buildNode('CalculateNullifier');
  }
  if (fnIndicator.newCommitmentsRequired || fnIndicator.internalFunctionInteractsWithSecret)
    newNodes.calculateCommitmentNode = buildNode('CalculateCommitment');
  newNodes.generateProofNode = buildNode('GenerateProof', {
    circuitName: node.fileName,
  });
  if (fnIndicator.newCommitmentsRequired || fnIndicator.internalFunctionInteractsWithSecret)
    newNodes.encryptBackupPreimageNode = buildNode('EncryptBackupPreimage');
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

export const interactsWithSecretVisitor = (thisPath: NodePath, thisState: any) => {
  if (thisPath.scope.getReferencedBinding(thisPath.node)?.isSecret)
    thisState.interactsWithSecret = true;
};

export const getIndexAccessName = (node: any) => {
  if (node.nodeType == 'MemberAccess') return `${node.expression.name}.${node.memberName}`;
  if (node.nodeType == 'IndexAccess') {
    const mappingKeyName = NodePath.getPath(node).scope.getMappingKeyName(node);
    if(mappingKeyName == 'msg')
      return `${node.baseExpression.name}_${(mappingKeyName).replaceAll('.', 'dot').replace('[', '_').replace(']', '')}${node.indexExpression.memberName.replace('sender','Sender').replace('value','Value')}`;
    return `${node.baseExpression.name}_${(mappingKeyName).replaceAll('.', 'dot').replace('[', '_').replace(']', '')}`;
  }
  return null;
}

export const internalFunctionCallVisitor = (thisPath: NodePath, thisState: any) => {
  const { node, scope } = thisPath;
   const args = node.arguments;
   let parametercheck = true ;
   let isSecretArray : string[] = [];
   let oldStateArray : string[] = [];
   for (const arg of args) {
     if (arg.nodeType !== 'Identifier' && !arg.expression.typeDescriptions.typeIdentifier.includes('_struct')) continue;
     isSecretArray = args.map(arg => scope.getReferencedBinding(arg)?.isSecret);
 }
 if(node.expression.nodeType === 'Identifier') {
  const functionReferncedNode = scope.getReferencedPath(node.expression);
  const params = functionReferncedNode?.node.parameters.parameters;
  thisPath.scope.indicators.internalFunctionoldCommitmentAccessRequired = functionReferncedNode?.scope.indicators.oldCommitmentAccessRequired;
  if((params.length !== 0) && (params.some(node => (node.isSecret || node._newASTPointer?.interactsWithSecret))))
  {
    thisState.internalFunctionInteractsWithSecret = true;
    thisPath.scope.indicators.internalFunctionInteractsWithSecret = true;
} else
thisState.internalFunctionInteractsWithSecret = false;
  oldStateArray = params.map(param => (param.name) );
  for (const [index, param] of params.entries()) {
    if(isSecretArray[index] !== param.isSecret)
    parametercheck = false;
    break;
  }
  if(parametercheck && thisState.internalFunctionInteractsWithSecret){
  thisState.isInternalFunctionCallValid = true;
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

export function parentnewASTPointer(parent:any , path:any , newNode:any, type:any){
  if (Array.isArray(type)) {
    type.push(newNode);
  } else {
    parent._newASTPointer[path.containerName] = newNode;
  }
}
