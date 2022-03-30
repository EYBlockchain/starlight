/* eslint-disable no-param-reassign, no-shadow, no-continue */

import cloneDeep from 'lodash.clonedeep';
import { buildNode } from '../../types/zokrates-types.js';
import { TODOError } from '../../error/errors.js';
import { traversePathsFast } from '../../traverse/traverse.js';
import NodePath from '../../traverse/NodePath.js';
//import getAllPrevSiblingNodes from '../../traverse/NodePath.js';
import { VariableBinding } from '../../traverse/Binding.js';
import { StateVariableIndicator,FunctionDefinitionIndicator } from '../../traverse/Indicator.js';

// below stub will only work with a small subtree - passing a whole AST will always give true!
// useful for subtrees like ExpressionStatements
const publicInputsVisitor = (thisPath: NodePath, thisState: any) => {
  const { node } = thisPath;
  if (!['Identifier', 'IndexAccess'].includes(thisPath.nodeType)) return;
  // even if the indexAccessNode is not a public input, we don't want to check its base and index expression nodes
  thisState.skipSubNodes = true;
  let { name } = thisPath.scope.getReferencedIndicator(node, true);
  const binding = thisPath.getReferencedBinding(node);
  // below: we have a public state variable we need as a public input to the circuit
  // local variable decs and parameters are dealt with elsewhere
  // secret state vars are input via commitment values
  if (
    binding instanceof VariableBinding &&
    (node.interactsWithSecret || node.baseExpression?.interactsWithSecret) &&
    (node.interactsWithPublic || node.baseExpression?.interactsWithPublic) &&
    binding.stateVariable && !binding.isSecret &&
    // if the node is the indexExpression, we dont need its value in the circuit
    !(thisPath.containerName === 'indexExpression')
  ) {
    // TODO other types
    if (thisPath.isMapping)
      name = name.replace('[', '_').replace(']', '').replace('.sender', '');
    const parameterNode = buildNode('VariableDeclaration', { name, type: 'field', isSecret: false, declarationType: 'parameter'});
    const fnDefNode = thisPath.getAncestorOfType('FunctionDefinition').node;
    fnDefNode._newASTPointer.parameters.parameters.push(parameterNode);
  }
};




/**
 * @desc:
 * Visitor transforms a `.zol` AST into a `.zok` AST
 * NB: the resulting `.zok` AST is custom, and can only be interpreted by this
 * repo's code generator. ZoKrates itself will not be able to interpret this
 * AST.
 */
 let interactsWithSecret = false; // Added globaly as two objects are accesing it
 let oldStateArray : string[];
 let newStateArray : string [];
 let internalFncName : string;
 let callingFncName : string;
 let newParameterList = [];
 let internalFncParameters = [];
 let circuitArguments = [];
// to remove duplicates

 // Collect the internal call ParameterList
 // getInternalCallParameters(parameterList = []) {
 //  let parameters : String [];
 // newParameterList.forEach(node => {
 //  switch(node.bpType) {
 //     case 'PoKoSK' :
 //       parameters.push(node.name+'_oldCommitment_owner_secretKey') ;
 //
 //     case 'nullification' :
 //       parameters.push(node.name+'_oldCommitment_owner_secretKey') ;
 //       parameters.push(node.name+'_oldCommitment_nullifier');
 //
 //     case 'oldCommitmentPreimage' :
 //       parameters.push(node.name+'_oldCommitment_value') ;
 //       parameters.push(node.name+'_oldCommitment_salt');
 //
 //     case 'oldCommitmentExistence' :
 //       parameters.push('commitmentRoot') ;
 //       parameters.push(node.name+'_oldCommitment_membershipWitness_index') ;
 //       parameters.push(node.name+'_oldCommitment_membershipWitness_siblingPath');
 //         if (node.isWhole && !(node.isAccessed && !node.isNullified))
 //       parameters.push(node.name+'_oldCommitment_isDummy');
 //
 //     case 'newCommitment' :
 //     parameters.push(node.name+'_newCommitment_owner_publicKey') ;
 //     parameters.push(node.name+'_newCommitment_salt') ;
 //     parameters.push(node.name+'_newCommitment_commitment');
 //
 //     case 'mapping' :
 //     parameters.push(node.mappingKeyName);
 //     }
 // }
 // return parameters;
 // console.log(parameters);
 // }

 // to match the parameters and if they don't match, we throw an error
 const interactsWithSecretVisitor = (thisPath: NodePath, thisState: any) => {
   if (thisPath.scope.getReferencedBinding(thisPath.node)?.isSecret)
     thisState.interactsWithSecret = true;
 };

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
}
};


const visitor = {
  ContractDefinition: {
    enter(path: NodePath) {
      const { node, parent } = path;
      node._newASTPointer = parent._newASTPointer;
    },
  // We Add the InternalFunctionCall nodes at the exit node so that all others gets build we need to access
    exit(path: NodePath) {
      // Find the Internal Function Node,
      const { node, parent } = path;

      node._newASTPointer.forEach(file => {
        if (file.fileName === internalFncName) {
               file.nodes.forEach(childNode => {
               if(childNode.nodeType === 'FunctionDefinition'){
             newParameterList = cloneDeep(childNode.parameters.parameters);
           newParameterList.forEach(node => {
             if(node.nodeType === 'Boilerplate')
             {
               for(const [index, oldStateName] of  oldStateArray.entries()) {
                 node.name = node.name.replace('_'+oldStateName+'_', '_'+newStateArray[index]+'_')
              if(node.newCommitmentValue === oldStateName)
              node.newCommitmentValue = node.newCommitmentValue.replace(oldStateName, newStateArray[index])
              if(node.mappingKeyName === oldStateName)
              node.mappingKeyName = node.mappingKeyName.replace(oldStateName, newStateArray[index])
               }
             }
             if(node.nodeType === 'VariableDeclaration')
             {
               for(const [index, oldStateName] of  oldStateArray.entries()) {
                 node.name = node.name.replace(oldStateName, newStateArray[index])
               }
             }
           })
       }
               })


// Collect the internal call ParameterList

     newParameterList.forEach(node => {

      switch(node.bpType) {
         case 'PoKoSK' :{
           internalFncParameters.push(`${node.name}_oldCommitment_owner_secretKey`)
         break;
       };

         case 'nullification' :
          { internalFncParameters.push(`${node.name}_oldCommitment_owner_secretKey`) ;
           internalFncParameters.push(`${node.name}_oldCommitment_nullifier`);
        break;
         };

         case 'oldCommitmentPreimage' :
          { internalFncParameters.push(`${node.name}_oldCommitment_value`) ;
           internalFncParameters.push(`${node.name}_oldCommitment_salt`);
        break;
         };

         case 'oldCommitmentExistence' :
           { internalFncParameters.push(`commitmentRoot`) ;
           internalFncParameters.push(`${node.name}_oldCommitment_membershipWitness_index`) ;
           internalFncParameters.push(`${node.name}_oldCommitment_membershipWitness_siblingPath`);
             if (node.isWhole && !(node.isAccessed && !node.isNullified))
           internalFncParameters.push(`${node.name}_oldCommitment_isDummy`);
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
     internalFncParameters =  newStateArray.concat(internalFncParameters);
     // to remove duplicates from the parameters
     internalFncParameters.forEach(param => {
         if (!circuitArguments.includes(param)) {
             circuitArguments.push(param);
         }
     });
     console.log(circuitArguments);
   }
if(file.fileName === callingFncName)
{
  file.nodes.forEach(childNode => {
  if(childNode.nodeType === 'FunctionDefinition'){
    //childNode.parameters.parameters = childNode.parameters.parameters.concat(newParameterList);
  childNode.parameters.parameters = [...new Set([...childNode.parameters.parameters, ...newParameterList])]
  }
})

      }

    })
  }

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
    // parent._newASTPointer location is Folder.files[].
    enter(path: NodePath, state: any) {

      const { node, parent, scope } = path;
      if (node.kind === 'constructor') {
        // We currently treat all constructors as publicly executed functions.
        state.skipSubNodes = true;
        return;
      }

      // Check the function for modifications to any stateVariables.
      // We'll need to create a new circuit file if we find a modification.
      // TODO: will we also need a new circuit file even if we're merely 'referring to' a secret state (because then a nullifier might be needed?)
      if (scope.modifiesSecretState()) {
        // Let's create a new circuit File to represent this function.
        // We'll add a new 'File' node to our newAST:

        const newFunctionDefinitionNode = buildNode('FunctionDefinition', {
          name: 'main',
        });
        const newImportStatementListNode = buildNode('ImportStatementList');

        const { indicators } = scope;

        newImportStatementListNode.imports.push(
          ...buildNode('Boilerplate', {
            bpSection: 'importStatements',
            indicators,
          }),
        );


        // before creating a function node we check for functions with same name
        const fnName = path.getUniqueFunctionName();
        node.fileName = fnName;


        // After getting an appropriate Name , we build the node
        const newNode = buildNode('File', {
         fileName: fnName,
          fileId: node.id,
          nodes: [newImportStatementListNode, newFunctionDefinitionNode],
        });

        node._newASTPointer = newFunctionDefinitionNode; // TODO: we might want to make this point to newNode (the 'File') rather than newNode.nodes[1] (the 'FunctionDefinition'), so that in future we can more easily access the ImportStatements.

        const files = parent._newASTPointer;
        files.push(newNode);
      } else {
        // a non secret function - we skip it for circuits
        state.skipSubNodes = true;
      }
    },

    exit(path: NodePath, state: any) {
      const { node, scope } = path;
      const { indicators } = scope;
      const newFunctionDefinitionNode = node._newASTPointer;

      // We populate the boilerplate for the function
      newFunctionDefinitionNode.parameters.parameters.push(
        ...buildNode('Boilerplate', {
          bpSection: 'parameters',
          indicators,
        }),
      );

      newFunctionDefinitionNode.body.preStatements.push(
        ...buildNode('Boilerplate', {
          bpSection: 'preStatements',
          indicators,
        }),
      );

      newFunctionDefinitionNode.body.postStatements.push(
        ...buildNode('Boilerplate', {
          bpSection: 'postStatements',
          indicators,
        }),
      );

      if (indicators.msgSenderParam) {
        node._newASTPointer.parameters.parameters.unshift(
          buildNode('VariableDeclaration', {
            name: 'msg',
            declarationType: 'parameter',
            type: 'field',
          }),
        ); // insert a msgSender parameter, because we've found msg.sender in the body of this function.
      }
//       const fnDefNode = path.getAncestorOfType('FunctionDefinition');
//       console.log(fnDefNode.parent._newASTPointer);
//       console.log(internalFncName);
//       fnDefNode.parent._newASTPointer.forEach(file => {
//       if (file.fileName === internalFncName) {
//         file.nodes.forEach(childNode => {
//         if(childNode.nodeType === 'FunctionDefinition'){
//       node._newASTPointer = childNode.parameters.;
//     node._newASTPointer.forEach(node => {
//       if(node.nodeType === 'Boilerplate')
//       {
//         console.log(node.name);
//       }
//     })
//
// }
//         })
//       }
//     })

    },
  },

  ParameterList: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('ParameterList');
      node._newASTPointer = newNode.parameters;
      parent._newASTPointer[path.containerName] = newNode;
    },
  },

  Block: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('Block');
      node._newASTPointer = newNode.statements;
      parent._newASTPointer.body = newNode;
    },
  },

  VariableDeclarationStatement: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      if (node.stateVariable) {
        throw new Error(
          `TODO: VariableDeclarationStatements of secret state variables are tricky to initialise because they're assigned-to outside of a function. Future enhancement.`,
        );
      }

      let declarationType: string;
      if (path.isLocalStackVariableDeclaration())
        declarationType = 'localStack';
      if (path.isFunctionParameterDeclaration()) declarationType = 'parameter';

      if (
        declarationType === 'localStack' &&
        !node.isSecret &&
        !scope.getReferencedIndicator(node).interactsWithSecret
      ) {
        // we don't want to add non secret local vars
        node._newASTPointer = parent._newASTPointer;
        state.skipSubNodes = true;
        return;
      }

      const newNode = buildNode('VariableDeclarationStatement');
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },
  },

  BinaryOperation: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { operator } = node;

      const newNode = buildNode('BinaryOperation', { operator });
      node._newASTPointer = newNode;
      path.inList ? parent._newASTPointer.push(newNode) : parent._newASTPointer[path.containerName] = newNode;
    },
  },

  Assignment: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { operator } = node;
      const newNode = buildNode('Assignment', { operator });
      node._newASTPointer = newNode;
      parent._newASTPointer.expression = newNode;
    },

    exit(path: NodePath) {
      // Convert 'a += b' into 'a = a + b' for all operators, because zokrates doesn't support the shortened syntax.
      // We do this on exit, so that the child nodes of this assignment get transformed into the correct zokrates nodeTypes (otherwise they might get missed).
      const expandAssignment = (node: any) => {
        const { operator, leftHandSide, rightHandSide } = node;
        const expandableOps = ['+=', '-=', '*=', '/=', '%=', '|=', '&=', '^='];
        if (!expandableOps.includes(operator)) return node;
        const op = operator.charAt(0);
        const binOpNode = buildNode('BinaryOperation', {
          operator: op,
          leftExpression: leftHandSide,
          rightExpression: rightHandSide,
        });
        const assNode = buildNode('Assignment', {
          operator: '=',
          leftHandSide,
          rightHandSide: binOpNode,
        });
        return assNode;
      };

      const { parent } = path;
      const circuitNode = parent._newASTPointer.expression;
      const newNode = expandAssignment(circuitNode);
      // node._newASTPointer = newNode; // no need to ascribe the node._newASTPointer, because we're exiting.
      parent._newASTPointer.expression = newNode;
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
      const { node, parent, scope } = path;
      const { expression } = node;
      // TODO: make sure isDecremented / isIncremented are also ascribed to UnaryOperation node (not just Assignment nodes).
      // TODO: what other expressions are there?
      // NOTE: THIS IS A TEMP BODGE - we need non-secrets when they interact with secrets later, add a check for local vars
      if (!node.containsSecret) {
        state.skipSubNodes = true;
        return;
      }
      const { isIncremented, isDecremented } = expression;
      let newNode: any;

      // TODO: tidy this up...
      if (isIncremented || isDecremented) {
        switch (expression.nodeType) {
          case 'Assignment': {
            const { leftHandSide: lhs, rightHandSide: rhs } = expression;
            const lhsIndicator = scope.getReferencedIndicator(lhs);

            if (!lhsIndicator.isPartitioned) break;

            const rhsPath = NodePath.getPath(rhs);
            // We need to _clone_ the path, because we want to temporarily modify some of its properties for this traversal. For future AST transformations, we'll want to revert to the original path.
            const tempRHSPath = cloneDeep(rhsPath);
            const tempRHSParent = tempRHSPath.parent;

            if (isDecremented) {
              newNode = buildNode('BoilerplateStatement', {
                bpType: 'decrementation',
                indicators: lhsIndicator,
                subtrahendId: rhs.id,
                ...(lhsIndicator.isMapping && {
                  mappingKeyName:
                    lhs.indexExpression?.name ||
                    lhs.indexExpression.expression.name,
                }), // TODO: tidy this
              });
              tempRHSPath.containerName = 'subtrahend'; // a dangerous bodge that works
              node._newASTPointer = newNode.subtrahend;
            } else {
              // isIncremented
              newNode = buildNode('BoilerplateStatement', {
                bpType: 'incrementation',
                indicators: lhsIndicator,
                addendId: rhs.id,
                ...(lhsIndicator.isMapping && {
                  mappingKeyName:
                    lhs.indexExpression?.name ||
                    lhs.indexExpression.expression.name,
                }), // TODO: tidy this
              });
              tempRHSPath.containerName = 'addend'; // a dangerous bodge that works
              node._newASTPointer = newNode.addend;
            }

            // The child of this 'ExpressionStatement' node is an 'Assignment' node. But we've built a newNode to replace the 'Assignment' node of the original tree. The child of this newNode will be the RHS of the original 'Assignment' node. We discard the LHS, so we need to 'skip' the traversal of the 'Assignment' (using skipSubNodes = true), and instead traverse directly into the RHS node.

            tempRHSParent._newASTPointer = newNode;
            // we don't want to add public inputs twice:
            tempRHSPath.traverse(visitor, { skipPublicInputs: true });
            rhsPath.traversePathsFast(publicInputsVisitor, {});
            state.skipSubNodes = true;
            parent._newASTPointer.push(newNode);
            return;
          }
          default:
            throw Error(
              `Expressions of nodeType ${expression.nodeType} are not yet supported. Please open a new issue in github (if none exists).`,
            );
        }
      }

      // Otherwise, copy this ExpressionStatement into the circuit's language.

      // But, let's check to see if this ExpressionStatement is an Assignment to a state variable. If it's the _first_ such assignment, we'll need to mutate this ExpressionStatement node into a VariableDeclarationStatement.

      let isVarDec: boolean = false;
      if (
        node.expression.nodeType === 'Assignment' &&
        node.expression.operator === '='
      ) {
        const assignmentNode = node.expression;
        const { leftHandSide: lhs } = assignmentNode;
        const referencedIndicator = scope.getReferencedIndicator(lhs);
        if (referencedIndicator instanceof StateVariableIndicator &&
          (lhs.id === referencedIndicator.referencingPaths[0].node.id ||
            lhs.id === referencedIndicator.referencingPaths[0].parent.id) && // the parent logic captures IndexAccess nodes whose IndexAccess.baseExpression was actually the referencingPath
          !(
            referencedIndicator.isWhole &&
            referencedIndicator.oldCommitmentAccessRequired
          ) // FIX - sometimes a variable will be declared twice when we insert oldCommitmentPreimage preStatements before an overwrite - we check here
        ) {
          isVarDec = true;
        }
      }

      newNode = buildNode('ExpressionStatement', { isVarDec });
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },
  },

  VariableDeclaration: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      if (node.stateVariable) {
        // Then the node represents assignment of a state variable.
        // State variables don't get declared within a circuit;
        // their old/new values are passed in as parameters.
        node._newASTPointer = parent._newASTPointer;
        state.skipSubNodes = true;
        return;
      }
      if (path.isFunctionReturnParameterDeclaration())
        throw new Error(
          `TODO: VariableDeclarations of return parameters are tricky to initialise because we might rearrange things so they become _input_ parameters to the circuit. Future enhancement.`,
        );

      let declarationType: string;
      // TODO: `memery` declarations and `returnParameter` declarations
      if (path.isLocalStackVariableDeclaration())
        declarationType = 'localStack';
      if (path.isFunctionParameterDeclaration()) declarationType = 'parameter';

      if (
        declarationType === 'localStack' &&
        !node.isSecret &&
        !scope.getReferencedIndicator(node).interactsWithSecret
      ) {
        // we don't want to add non secret local vars
        node._newASTPointer = parent._newASTPointer;
        state.skipSubNodes = true;
        return;
      }


      scope.bindings[node.id].referencingPaths.forEach(refPath => {
        const newState: any = {};
        refPath.parentPath.traversePathsFast(
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

      //If it's not declaration of a state variable, it's either a function parameter or a local stack variable declaration. We _do_ want to add this to the newAST.
      const newNode = buildNode('VariableDeclaration', {
        name: node.name,
        isSecret: node.isSecret,
        interactsWithSecret,
        declarationType,
      });
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName].push(newNode);
      }
    },
  },

  ElementaryTypeNameExpression: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode(
        'ElementaryTypeName',
        {
          name: node.name === 'bool' ? 'bool' : 'field', // convert uint & address types to 'field', for now.
        },
      );
      state.skipSubNodes = true;
    },
  },

  ElementaryTypeName: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const supportedTypes = ['uint', 'uint256', 'address', 'bool'];
      if (!supportedTypes.includes(node.name))
        throw new Error(
          `Currently, only transpilation of types "${supportedTypes}" is supported. Got ${node.name} type.`,
        );

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode(
        'ElementaryTypeName',
        {
          name: node.name === 'bool' ? 'bool' : 'field', // convert uint & address types to 'field', for now.
        },
      );
    },
  },

  Identifier: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const { name } = node;
      // const binding = path.getReferencedBinding(node);
      // below: we have a public state variable we need as a public input to the circuit
      // local variable decs and parameters are dealt with elsewhere
      // secret state vars are input via commitment values
      if (!state.skipPublicInputs) path.traversePathsFast(publicInputsVisitor, {});

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      const newNode = buildNode('Identifier', {
        name,
      });
      if (Array.isArray(parent._newASTPointer[path.containerName])) {
       parent._newASTPointer[path.containerName].push(newNode);
     } else {
       parent._newASTPointer[path.containerName] = newNode; }
    }  // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
  },

  Literal: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { value } = node;

      if (node.kind !== 'number')
        throw new Error(
          `Only literals of kind "number" are currently supported. Found literal of kind '${node.kind}'. Please open an issue.`,
        );

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode('Literal', {
        value,
      });
    },
  },

  MemberAccess: {
    enter(path: NodePath, state: any) {
      const { parent } = path;

      if (!path.isMsgSender())
        throw new Error(`Struct property access isn't yet supported.`);

      // What follows assumes this node represents msg.sender:
      const newNode = buildNode('MsgSender');

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = newNode;
      state.skipSubNodes = true;
    },
  },

  IndexAccess: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;

      if (!state.skipPublicInputs) path.traversePathsFast(publicInputsVisitor, {});

      const newNode = buildNode('IndexAccess');
      node._newASTPointer = newNode;
      parent._newASTPointer[path.containerName] = newNode;
    },
  },

  FunctionCall: {
    enter(path: NodePath, state: any) {
      const { parent, node } = path;


      // If this node is a require statement, it might include arguments which themselves are expressions which need to be traversed. So rather than build a corresponding 'assert' node upon entry, we'll first traverse into the arguments, build their nodes, and then upon _exit_ build the assert node.

      if (path.isRequireStatement() && !node.requireStatementPrivate) {
        // HACK: eventually we'll need to 'copy over' (into the circuit) require statements which have arguments which have interacted with secret states elsewhere in the function (at least)
        state.skipSubNodes = true;
        return;

        // newNode = buildNode('Assert', { arguments: node.arguments });
        //
        // node._newASTPointer = newNode;
        // parent._newASTPointer[path.containerName] = newNode;
        // return;
      }
      if (node.requireStatementPrivate) {
        throw new TODOError('Secret assert statements', node);
      }

      if (path.isExternalFunctionCall() || path.isExportedSymbol()) {
        // External function calls are the fiddliest of things, because they must be retained in the Solidity contract, rather than brought into the circuit. With this in mind, it's easiest (from the pov of writing this transpiler) if External function calls appear at the very start or very end of a function. If they appear interspersed around the middle, we'd either need multiple circuits per Zolidity function, or we'd need a set of circuit parameters (non-secret params / return-params) per external function call, and both options are too painful for now.

        // ignore external function calls; they'll be retained in Solidity, so won't be copied over to a circuit.
        state.skipSubNodes = true;
      }
      if(path.isInternalFunctionCall()) {
        const args = node.arguments;
        newStateArray =  args.map(arg => (arg.name));
        let internalFunctionInteractsWithSecret = false;
        const newState: any = {};
        internalFunctionCallVisitor(path, newState)
        internalFunctionInteractsWithSecret ||= newState.internalFunctionInteractsWithSecret;
        internalFncName = node.expression.name;
     if(internalFunctionInteractsWithSecret === true && interactsWithSecret === true)
     {
        const newNode = buildNode('InternalFunctionCall', {
        name: node.expression.name,
        internalFunctionInteractsWithSecret: internalFunctionInteractsWithSecret,
        oldStateName: oldStateArray,
        newStateName: newStateArray,
        CircuitArguments: circuitArguments,
       });

        node._newASTPointer = newNode ;
        if (Array.isArray(parent._newASTPointer[path.containerName])) {
         parent._newASTPointer[path.containerName].push(newNode);
       } else {
         parent._newASTPointer[path.containerName] = newNode;
       }

       const fnNode = buildNode('InternalFunctionBoilerplate', {
                       name: node.expression.name,
                       internalFunctionInteractsWithSecret: internalFunctionInteractsWithSecret,

                     });

       const fnDefNode = path.getAncestorOfType('FunctionDefinition');
       callingFncName = fnDefNode.node.name;
       fnDefNode.parent._newASTPointer.forEach(file => {
       if (file.fileName === fnDefNode.node.name) {
         file.nodes.forEach(childNode => {
           if (childNode.nodeType === 'ImportStatementList')
           childNode.imports.push(fnNode);
         })
       }
     })
}
}

      if (path.isZero()) {
        // The path represents 0. E.g. "address(0)", so we don't need to traverse further into it.
        state.skipSubNodes = true;

        // Let's replace this thing with a '0' in the new AST:
        const newNode = buildNode('Literal', { value: 0 });
        parent._newASTPointer[path.containerName] = newNode;
      }
    },
  },
};

export default visitor;
