/* eslint-disable no-param-reassign, no-shadow */

 import logger from '../../utils/logger.js';
import cloneDeep from 'lodash.clonedeep';
import { buildNode } from '../../types/solidity-types.js';
import { traverseNodesFast } from '../../traverse/traverse.js';
import NodePath from '../../traverse/NodePath.js';
import { VariableBinding } from '../../traverse/Binding.js';
import { ContractDefinitionIndicator,FunctionDefinitionIndicator } from '../../traverse/Indicator.js';
import { interactsWithSecretVisitor, parentnewASTPointer, internalFunctionCallVisitor } from './common.js';
import { param } from 'express/lib/request.js';

// here we find any public state variables which interact with secret states
// and hence need to be included in the verification calculation
const findCustomInputsVisitor = (thisPath: NodePath, thisState: any) => {
  if (thisPath.nodeType !== 'Identifier' && thisPath.nodeType !== 'Return') return;

  const binding = thisPath.getReferencedBinding(thisPath.node);
  const indicator = thisPath.scope.getReferencedIndicator(thisPath.node, true);
  const isCondition = !!thisPath.getAncestorContainedWithin('condition') && thisPath.getAncestorOfType('IfStatement')?.containsSecret;
  const isForCondition = !!thisPath.getAncestorContainedWithin('condition') && thisPath.getAncestorOfType('ForStatement')?.containsSecret;
  const isInitializationExpression = !!thisPath.getAncestorContainedWithin('initializationExpression') && thisPath.getAncestorOfType('ForStatement')?.containsSecret;
  const isLoopExpression = !!thisPath.getAncestorContainedWithin('loopExpression') && thisPath.getAncestorOfType('ForStatement')?.containsSecret;

  if(thisPath.nodeType === 'Return') {
    thisPath.container.forEach(item => {
      if(item.nodeType === 'Return'){
        if(item.expression.components) {
          item.expression.components.forEach(element => {
            if(element.kind === 'bool'){
              thisState.customInputs ??= [];
              thisState.customInputs.push({name: '1', typeName: {name: 'bool'}, isReturn: true});
            }
          });
        } else {
          if(item.expression.kind === 'bool'){
            thisState.customInputs ??= [];
            thisState.customInputs.push({name: '1', typeName: {name: 'bool'}, isReturn: true});
          }
        }
      }
    });
  }
  if(thisPath.getAncestorOfType('Return') && binding instanceof VariableBinding && binding.isSecret){
   thisState.customInputs ??= [];
   if(thisState.variableName.includes(indicator.node.name))
    thisState.customInputs.push({name: 'newCommitments['+(thisState.variableName.indexOf(indicator.node.name))+']', typeName: {name: 'uint256'}, isReturn: true, isCommitment: true});
  }
  // for some reason, node.interactsWithSecret has disappeared here but not in toCircuit
  // below: we have a public state variable we need as a public input to the circuit
  // local variable decs and parameters are dealt with elsewhere
  // secret state vars are input via commitment values
  if (
    binding instanceof VariableBinding &&
    (indicator?.interactsWithSecret || isCondition || isForCondition || isInitializationExpression || isLoopExpression) &&
    binding.stateVariable && !binding.isSecret &&
    // if the node is the indexExpression, we dont need its value in the circuit
    !(thisPath.containerName === 'indexExpression'&& !(thisPath.parentPath.isSecret|| thisPath.parent.containsSecret))
  ) {
    thisState.customInputs ??= [];
    const type = binding.node.typeName.nodeType === 'Mapping' ? binding.node.typeName.valueType.name : binding.node.typeName.name;
    if (!thisState.customInputs.some((input: any) => input.name === indicator?.name))
      thisState.customInputs.push({name: indicator?.name, typeName: {name: type}, isConstantArray: thisPath.isConstantArray() ? thisPath.node.typeName.length.value : false, inCircuit: true, isReturn: false });
  }
};


let internalFuncInteractsWithSecret = false;
let interactsWithSecret = false;

/**
 * @desc:
 * Visitor transforms a `.zol` AST into a `.sol` AST (for a 'shield' contract)
 * NB: the resulting `.sol` AST is custom, and can only be reliably interpreted * by this repo's code generator. Other software might not be able to interpret * this AST.
 */

export default {
  SourceUnit: {
    enter(path: NodePath) {
      const { node, parent } = path;

      // Figure out a sensible fileName:
      const contractNames = [];
      const subState = { contractNames, skipSubNodes: false };
      const getContractNamesVisitor = (node: any, state: any) => {
        if (node.nodeType === 'ContractDefinition') {
          state.contractNames.push(node.name);
          state.skipSubNodes = true;
        }
      };

      traverseNodesFast(node, getContractNamesVisitor, subState);
      if (!contractNames) throw new Error('No contracts in AST');
      if (contractNames.length > 1)
        throw new Error(
          'Only 1 contract per solidity file is currently supported',
        );

      // Create a 'SourceUnit' node.
      const newNode = buildNode('SourceUnit', {
        name: contractNames[0],
        license: node.license,
      });

      parent._newASTPointer.push(newNode);
      node._newASTPointer = parent._newASTPointer;

    },

  },

  PragmaDirective: {
    // TODO: We should probably check that the `.zol` Pragma is 'supported'. The output Solidity's pragma will be limited to the latest-supported boilerplate code.
    // However, for now, we'll just inherit the Pragma of the original and hope.
    enter(path: NodePath) {
      const { node, parent } = path;
      const { literals } = node;

      // parent._newASTPointer[0] is the SourceUnit created earlier by this visitor module.
      parent._newASTPointer[0].nodes.push(
        buildNode('PragmaDirective', { literals }),
      );
      // node._newASTPointer = ?; - a pragmaDirective is a leaf, so no need to set where we'd next push to.
    },
  },

  ImportDirective: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { file } = node;

      // parent._newASTPointer[0] is the SourceUnit created earlier by this visitor module.
      parent._newASTPointer[0].nodes.push(
        buildNode('ImportDirective', { file }),
      );
      // node._newASTPointer = ?; - a pragmaDirective is a leaf, so no need to set where we'd next push to.
    },
  },

  ContractDefinition: {
    enter(path: NodePath) {
      const { node, parent, scope } = path;
      const isShieldContract = scope.indicators.zkSnarkVerificationRequired;
      const newNode = buildNode('ContractDefinition', {
        name: node.name,
        isShieldContract,
      });
      node._newASTPointer = newNode.nodes;
      // parent._newASTPointer[0] is the SourceUnit created earlier by this visitor module.
      parent._newASTPointer[0].nodes.push(newNode);


    },
    exit(path: NodePath, state: any) {
          const { node, parent, scope } = path;
          const sourceUnitNodes = parent._newASTPointer[0].nodes;
          const contractNodes = node._newASTPointer;
          let parameterList: any = {};
          let functionName: string;
          let returnParameterList: any = {};
          let returnfunctionName: string;
          for ([functionName, parameterList] of Object.entries(state.circuitParams)) {
            if(state.returnpara){
             for ([returnfunctionName, returnParameterList] of Object.entries(state.returnpara)){
               if(functionName === returnfunctionName ){
                 parameterList = parameterList && returnParameterList ? {... parameterList, ... returnParameterList} : parameterList;
                 state.circuitParams[ functionName ] = parameterList;
                }
              }
            }
          }


          const contractIndex = sourceUnitNodes.findIndex(
            (n: any) => n.name === node.name,
          );
          sourceUnitNodes[contractIndex].baseContracts.push(
            buildNode('InheritanceSpecifier', {
              nodeType: 'UserDefinedTypeName',
              name: 'MerkleTree',
            }),
          );

          sourceUnitNodes.splice(
            1,
            0,
            ...buildNode('ContractBoilerplate', {
              bpSection: 'importStatements',
              scope,
            }),
          );

          // unshift in reverse order from how we want them to appear
          contractNodes.unshift(
            ...buildNode('ContractBoilerplate', {
              bpSection: 'verify',
              scope,
              circuitParams: state.circuitParams,
            })
          );
          contractNodes.unshift(
            ...buildNode('ContractBoilerplate', {
              bpSection: 'registerZKPPublicKey',
              scope,
            }),
          );
          contractNodes.unshift(
            ...buildNode('ContractBoilerplate', {
              bpSection: 'constructor',
              scope,
            }),
          );
          contractNodes.unshift(
            ...buildNode('ContractBoilerplate', {
              bpSection: 'stateVariableDeclarations',
              scope,
            }),
          );
          if (state.mainPrivateFunctionName) {
            parent._newASTPointer[0].mainPrivateFunctionName =
              state.mainPrivateFunctionName; // TODO fix bodge
            parent._newASTPointer[0].nodes.forEach((node: any) => {
              if (node.nodeType === 'ContractDefinition')
                node.mainPrivateFunctionName = state.mainPrivateFunctionName;
            });
          }

          node._newASTPointer.forEach(node => {

            if(node.nodeType === 'FunctionDefinition' && node.kind === 'function'){
              state.internalFncName?.forEach( (name, index) => {
                if(node.name === name) {
                  node.msgSigRequired = true;
                 state.postStatements ??= [];
                 state.postStatements = cloneDeep(node.body.postStatements);
                }
                if(node.name === state.callingFncName[index]){
                 node.body.postStatements.forEach( childNode => {
                   state.postStatements?.forEach(node => {
                     if(!childNode.nullifiersRequired && node.nullifiersRequired)
                       childNode.nullifiersRequired = node.nullifiersRequired;
                     if(!childNode.oldCommitmentAccessRequired && node.oldCommitmentAccessRequired)
                       childNode.oldCommitmentAccessRequired = node.oldCommitmentAccessRequired;
                     if(!childNode.newCommitmentsRequired && node.newCommitmentsRequired)
                       childNode.newCommitmentsRequired = node.newCommitmentsRequired;
                      if(!childNode.encryptionRequired && node.encryptionRequired)
                      childNode.encryptionRequired = node.encryptionRequired; 
                    })
                  })
                  node.parameters.parameters.forEach( childNode => {

                    state.postStatements?.forEach(node => {
                      if(!childNode.nullifiersRequired && node.nullifiersRequired)
                       childNode.nullifiersRequired = node.nullifiersRequired;
                      if(!childNode.oldCommitmentAccessRequired && node.oldCommitmentAccessRequired)
                       childNode.oldCommitmentAccessRequired = node.oldCommitmentAccessRequired;
                      if(!childNode.newCommitmentsRequired && node.newCommitmentsRequired)
                      childNode.newCommitmentsRequired = node.newCommitmentsRequired;
                      if(!childNode.encryptionRequired && node.encryptionRequired)
                      childNode.encryptionRequired = node.encryptionRequired; 
                    })
                  })
                }
              });
            }
          })
        },
      },

  FunctionDefinition: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const isConstructor = node.kind === 'constructor';
      state.msgSigRequired = false;
      if(node.kind === 'fallback' || node.kind === 'receive')
      {
        node.fileName = node.kind;
        state.functionName = node.kind;
      }
      else
      state.functionName = path.getUniqueFunctionName();

      const newNode = buildNode('FunctionDefinition', {
        name: node.fileName || state.functionName,
        id: node.id,
        kind: node.kind,
        stateMutability: node.stateMutability === 'payable'? node.stateMutability : '',
        visibility: node.kind ==='function' ? 'public' : node.kind === 'constructor'? '': 'external',
        isConstructor,
        msgSigRequired: state.msgSigRequired,
      });

      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
      if (!path.containsSecret && !path.scope.indicators.internalFunctionInteractsWithSecret) return;
      const file = state.circuitAST.files.find((n: any) => n.fileId === node.id);
      const circuitParams = file.nodes.find((n: any) => n.nodeType === node.nodeType).parameters.parameters;

      state.circuitParams ??= {};
      state.circuitParams[path.getUniqueFunctionName()] ??= {};
      state.circuitParams[path.getUniqueFunctionName()].parameters = circuitParams;
      // Delete repeated circuit parameters
      let deletedIndexes = [];
      state.circuitParams[path.getUniqueFunctionName()].parameters.forEach((circParam1, index1) => {
        state.circuitParams[path.getUniqueFunctionName()].parameters.forEach((circParam2, index2) => {
          if (circParam1.bpType === 'nullification' && circParam2.bpType === 'nullification' && circParam1.name === circParam2.name && index1 > index2) {
            deletedIndexes.push(index1);
          }
          if (circParam1.bpType === 'newCommitment' && circParam2.bpType === 'newCommitment' && circParam1.name === circParam2.name && index1 > index2) {
            deletedIndexes.push(index1);
          }
        });
      });
      deletedIndexes = [...new Set(deletedIndexes)];
      deletedIndexes.sort((a, b) => b - a);
      deletedIndexes.forEach(index => {
        state.circuitParams[path.getUniqueFunctionName()].parameters.splice(index, 1);
      });
    },

    exit(path: NodePath, state: any) {
      // We populate the entire shield contract upon exit, having populated the FunctionDefinition's scope by this point.
      const { node, scope } = path;
  
      const newFunctionDefinitionNode = node._newASTPointer;
 
      // Let's populate the `parameters` and `body`:
      const { parameters } = newFunctionDefinitionNode.parameters;
      const { postStatements, preStatements } = newFunctionDefinitionNode.body;
     

      // if contract is entirely public, we don't want zkp related boilerplate
      if (!path.scope.containsSecret && !path.scope.indicators.internalFunctionInteractsWithSecret && !(node.kind === 'constructor')) return;

      parameters.push(
        ...buildNode('FunctionBoilerplate', {
          bpSection: 'parameters',
          scope,
        }),
      );
      if (node.kind === 'constructor')
        preStatements.push(
          ...buildNode('FunctionBoilerplate', {
            bpSection: 'preStatements',
            scope,
            customInputs: state.customInputs,
          }),
        );
      if (path.scope.containsSecret || path.scope.indicators.internalFunctionInteractsWithSecret)
        postStatements.push(
          ...buildNode('FunctionBoilerplate', {
            bpSection: 'postStatements',
            scope,
            customInputs: state.customInputs,
           
          }),
        );
      delete state?.customInputs;
    },
  },

  ParameterList: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      let returnName : string[] =[];
       if(path.key === 'parameters'){
      const newNode = buildNode('ParameterList');
      node._newASTPointer = newNode.parameters;
      parent._newASTPointer[path.containerName] = newNode;
    } else if(path.key === 'returnParameters'){
       parent.body.statements.forEach(node => {
        if(node.nodeType === 'Return'){
          if(node.expression.nodeType === 'TupleExpression'){
           node.expression.components.forEach(component => {
             if(component.name){
              returnName?.push(component.name);
            }
             else
             returnName?.push(component.value);
           });
         } else{
           if(node.expression.name)
            returnName?.push(node.expression.name);
           else
           returnName?.push(node.expression.value);
        }
        }
      });

    node.parameters.forEach((node, index) => {
      if(node.nodeType === 'VariableDeclaration'){
        node.name = returnName[index];
      }
    });

    const newNode = buildNode('ParameterList');
    node._newASTPointer = newNode.parameters;
    parent._newASTPointer[path.containerName] = newNode;
    }
  },
  exit(path: NodePath, state: any){
    const { node, parent, scope } = path;
    if(path.key === 'returnParameters'){
      node._newASTPointer.forEach(item =>{
      parent.body.statements.forEach( node => {
        if(node.nodeType === 'Return'){
          for(const [ id , bindings ] of Object.entries(scope.referencedBindings)){
            if(node.expression.nodeType === 'TupleExpression'){
            node.expression.components.forEach(component => {
              if(id == component.referencedDeclaration) {
                if ((bindings instanceof VariableBinding)) {
                  if(component.name === item.name)
                  item.isSecret = bindings.isSecret
                }
              }
            })
          } else {
            if( id == node.expression.referencedDeclaration) {
              if ((bindings instanceof VariableBinding)){
               if(node.name === item.name)
               item.isSecret = bindings.isSecret
              }
            }
           }
          }
        }
      })
    })
    }
  },
  },

  Block: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('Block');
      node._newASTPointer = newNode;
      parent._newASTPointer.body = newNode;
    },
  },
  Return: {
     enter(path: NodePath, state: any) {
       const { node, parent } = path;
       path.traversePathsFast(findCustomInputsVisitor, state);
       state.returnpara ??= {};
       state.returnpara[state.functionName] ??= {};
       state.returnpara[state.functionName].returnParameters = state.customInputs?.filter(n => n.isReturn).map(n => n.name );
       const newNode = buildNode(
       node.nodeType,
       { value: node.expression.value });
       node._newASTPointer = newNode;
       if (Array.isArray(parent._newASTPointer)) {
         parent._newASTPointer.push(newNode);
       } else {
         parent._newASTPointer[path.containerName].push(newNode);
       }
     },
   },

  IfStatement: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      if (node.containsSecret) {
        path.traversePathsFast(findCustomInputsVisitor, state);
        state.skipSubNodes=true;
        return;
      }
      const newNode = buildNode(node.nodeType, {
        condition: node.condition,
        trueBody: node.trueBody,
        falseBody: node.falseBody
      });
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode, parent._newASTPointer[path.containerName]);
    },
  },

  ForStatement: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      if (node.containsSecret) {
        path.traversePathsFast(findCustomInputsVisitor, state);
        if(node.containsPublic){
          const newNode = buildNode(node.nodeType , {
            nodeType: node.nodeType,
            condition: node.condition,
            initializationExpression: node.initializationExpression,
            loopExpression: node.loopExpression,
            body: node.body,
          });
          node._newASTPointer = newNode;
          parentnewASTPointer(parent, path, newNode, parent._newASTPointer[path.containerName]);
          return;
        }
        state.skipSubNodes=true;
        return;
      }
      const newNode = buildNode(node.nodeType , {
        nodeType: node.nodeType,
        condition: node.condition,
        initializationExpression: node.initializationExpression,
        loopExpression: node.loopExpression,
        body: node.body,
      });
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode, parent._newASTPointer[path.containerName]);
    },
  },

  VariableDeclarationStatement: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      if (node.stateVariable) {
        throw new Error(
          `TODO: VariableDeclarationStatements of secret state variables are tricky to initialise because they're assigned-to outside of a function. Future enhancement.`,
        );
      }
      // HACK: for now, we assume all local stack variables will be picked up in Solidity. A future enhancement will be to only include local stack variables which interact solely with non-secret states. Local stack variabels which _do_ interact with secret states will probably be brought into the circuit eventually.
      // PARTIAL SOLN: below
      // TODO interacts with secret AND public
      const subState = { interactsWithSecret: false };
      path.traversePathsFast(interactsWithSecretVisitor, subState);
      if (subState.interactsWithSecret) {
        state.skipSubNodes = true;
        return;
      }


      const newNode = buildNode('VariableDeclarationStatement');
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode, parent._newASTPointer[path.containerName]);
    },
  },

  BinaryOperation: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { operator } = node;

      const newNode = buildNode('BinaryOperation', { operator });
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
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
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
    }
  },

  Assignment: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;

      if (path.containsSecret && !path.containsPublic) {
        // Don't copy over code which should be secret! It shouldn't appear in a public shield contract; only in the circuit! So skip subnodes.
        state.skipSubNodes = true;
        return;
      } else if (path.containsSecret) {
        path.traversePathsFast(findCustomInputsVisitor, state);
        state.skipSubNodes = true;
        return;
      }
      const { operator } = node;
      const newNode = buildNode('Assignment', { operator });
      node._newASTPointer = newNode;
      parent._newASTPointer.expression = newNode;
    },
  },

  ExpressionStatement: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('ExpressionStatement');
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
    },
  },

  EventDefinition: {
    enter(path: NodePath , state:any) {
        const { node, parent } = path;
        state.functionName = path.getUniqueFunctionName()
        const newNode = buildNode('EventDefinition', {
          name: node.fileName || state.functionName,
          id: node.id,
        });
        node._newASTPointer = newNode;
        parent._newASTPointer.push(newNode);
    },
},

EmitStatement: {
  enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('EmitStatement');
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
  },
},

WhileStatement: {
  enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('WhileStatement');
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
  },
},

DoWhileStatement: {
  enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('DoWhileStatement');
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
  },
},

  VariableDeclaration: {
    enter(path: NodePath, state : any) {
      const { node, parent, scope } = path;
      
      if(node.typeName.name === 'uint')
      logger.warn(
        `VariableDeclarations is uint, please specify the size (from 8 to 256 bits, in steps of 8) of declared variable ${node.name}.`,
      );
//
      if (path.isFunctionReturnParameterDeclaration())
        throw new Error(
          `TODO: VariableDeclarations of return parameters are tricky to initialise because we might rearrange things so they become _input_ parameters to the circuit. Future enhancement.`,
        );

      let declarationType: string = ``;
      // TODO: `memery` declarations and `returnParameter` declarations
      if (node.stateVariable) {
        declarationType = 'state'; // not really needed, since we already have 'stateVariable'
        state.variableName ??= [];
        state.variableName.push(node.name);
      } else if (path.isLocalStackVariableDeclaration()) {
        declarationType = 'localStack';
      } else if (path.isFunctionParameterDeclaration() || path.isEventParameterDeclaration()) {
        declarationType = 'parameter';
      }
      scope.bindings[node.id].referencingPaths.forEach(refPath => {
        const newState: any = {};
        refPath.parentPath.traversePathsFast(
          interactsWithSecretVisitor,
          newState,
        );
        interactsWithSecret ||= newState.interactsWithSecret || refPath.node.interactsWithSecret;

        // check for internal function call if the parameter passed in the function call interacts with secret or not
        if(refPath.parentPath.isInternalFunctionCall()){
          refPath.parentPath.node.arguments?.forEach((element, index) => {
            if(node.id === element.referencedDeclaration) {
              let key = (Object.keys(refPath.parentPath.getReferencedPath(refPath.parentPath.node?.expression)?.scope.bindings || {})[index]);
              interactsWithSecret ||= refPath.parentPath.getReferencedPath(refPath.parentPath.node?.expression)?.scope.indicators[key]?.interactsWithSecret
            }
          })
        }
      });


      if (
        parent.nodeType === 'VariableDeclarationStatement' &&
        interactsWithSecret
      )
        parent._newASTPointer.interactsWithSecret = interactsWithSecret;
        node.interactsWithSecret = interactsWithSecret;
      // If it's not declaration of a state variable, it's either a function parameter or a local stack variable declaration. We _do_ want to add this to the newAST.
      const newNode = buildNode('VariableDeclaration', {
        name: node.name,
        isSecret: node.isSecret,
        declarationType,
        interactsWithSecret:interactsWithSecret,
        typeString: node.typeDescriptions?.typeString,
        visibility: node.visibility,
        storageLocation: node.storageLocation,
      });
      if (newNode.isSecret === undefined ){
        newNode.isSecret = scope.getIndicatorByName(node.name)?.isSecret;
      }
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName].push(newNode);
      }
      interactsWithSecret = false;
    },
  },

  StructDefinition: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const newNode = buildNode(node.nodeType, { name: node.name });
      node._newASTPointer = newNode;

      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName].push(newNode);
      }
    }
  },

  ArrayTypeName: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('ElementaryTypeNameExpression');

      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }

    }
  },

  ElementaryTypeName: {
    enter(path: NodePath) {
      const { node, parent } = path;

      const newNode = buildNode(
        'ElementaryTypeName',
        {
          typeDescriptions: {
            typeString: node.typeDescriptions.typeString || node.name,
          },
        },
      );
      // no pointer needed, because this is a leaf, so we won't be recursing any further.
      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
    },
  },

  // e.g. for the statement `address(this)`, `address()` is an ElementaryTypeNameExpression for the ElementaryTypeName `address`
  ElementaryTypeNameExpression: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('ElementaryTypeNameExpression');

      node._newASTPointer = newNode;
      parent._newASTPointer[path.containerName] = newNode;
    },
  },

  Identifier: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { name } = node;

      const newNode = buildNode('Identifier', { name });

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
    },
  },

  Literal: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { value, kind } = node;

      if (!['number', 'bool', 'string'].includes(kind))
        throw new Error(
          `Only literals of kind "number" or "bool" are currently supported. Found literal of kind ${node.kind}. Please open an issue.`,
        );

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.

      const newNode = buildNode('Literal', { value, kind });
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
    },
  },

  MemberAccess: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;

      let newNode: any;

      if (path.isMsgSender()) {
        newNode = buildNode('MsgSender');
        // node._newASTPointer = // no pointer needed in this case, because this is effectively leaf, so we won't be recursing any further.
        state.skipSubNodes = true;
      } else if (path.isMsgValue()) {
        newNode = buildNode('MsgValue');
        // node._newASTPointer = // no pointer needed in this case, because this is effectively leaf, so we won't be recursing any further.
        state.skipSubNodes = true;
      } else {
        newNode = buildNode('MemberAccess', { memberName: node.memberName });
        node._newASTPointer = newNode;
      }
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
    },
  },

  IndexAccess: {
    enter(path: NodePath) {
      const { node, parent } = path;

      const newNode = buildNode('IndexAccess');
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
    },
  },

  Mapping: {
    enter(path: NodePath) {
      const { node, parent } = path;

      const newNode = buildNode('Mapping');
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
    },
  },

  FunctionCall: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;
      let newNode: any;

      // If this node is a require statement, it might include arguments which themselves are expressions which need to be traversed. So rather than build a corresponding 'assert' node upon entry, we'll first traverse into the arguments, build their nodes, and then upon _exit_ build the assert node.
      if (path.isRequireStatement() || path.isRevertStatement() || (node.expression.memberName && node.expression.memberName === 'push')) {
        // If the 'require' statement contains secret state variables, we'll presume the circuit will perform that logic, so we'll do nothing in the contract.
        const subState = { interactsWithSecret: false };
        path.traversePathsFast(interactsWithSecretVisitor, subState);
        if (subState.interactsWithSecret) {
          if (path.isRequireStatement()){
            NodePath.getPath(node.arguments[0]).traversePathsFast(findCustomInputsVisitor, state);
          }
          state.skipSubNodes = true;
          return;
        }

        // HACK: eventually we'll need to 'copy over' (into the circuit) require statements which have arguments which have interacted with secret states elsewhere in the function (at least).
        // For now, we'll copy these into Solidity:
        newNode = buildNode('FunctionCall');
        node._newASTPointer = newNode;
        parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
        return;
      }
      // Like External function calls ,it's easiest (from the pov of writing this transpiler) if Event calls appear at the very start or very end of a function.
      // TODO: need a warning message to this effect ^^^
      if (parent.nodeType === 'EmitStatement') {
      newNode = buildNode('FunctionCall');
      node._newASTPointer = newNode;
      parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
      return;
    }

      if (path.isExternalFunctionCall()) {
        // External function calls are the fiddliest of things, because they must be retained in the Solidity contract, rather than brought into the circuit. With this in mind, it's easiest (from the pov of writing this transpiler) if External function calls appear at the very start or very end of a function. If they appear interspersed around the middle, we'd either need multiple circuits per Zolidity function, or we'd need a set of circuit parameters (non-secret params / return-params) per external function call, and both options are too painful for now.
        // TODO: need a warning message to this effect ^^^
        newNode = buildNode('FunctionCall');
        node._newASTPointer = newNode;
        parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
        return;
      }
      if (path.isInternalFunctionCall()) {
       // External function calls are the fiddliest of things, because they must be retained in the Solidity contract, rather than brought into the circuit. With this in mind, it's easiest (from the pov of writing this transpiler) if External function calls appear at the very start or very end of a function. If they appear interspersed around the middle, we'd either need multiple circuits per Zolidity function, or we'd need a set of circuit parameters (non-secret params / return-params) per external function call, and both options are too painful for now.
       // TODO: need a warning message to this effect ^^^

      const functionReferncedNode = scope.getReferencedNode(node.expression);
      const params = functionReferncedNode.parameters.parameters;
      state.pubparams = [];
      if((params.length !== 0) && (params.some(node => node.isSecret || node._newASTPointer?.interactsWithSecret )))
      {
        state.internalFunctionInteractsWithSecret = true;
    } else
      state.internalFunctionInteractsWithSecret = false;
    if((params.length !== 0)) {
      params.forEach((node, index) => {
        if (!(node.isSecret)){
          state.pubparams ??= [];
          state.pubparams.push(index);
        }
      });
    }

       if(state.internalFunctionInteractsWithSecret){
         state.internalFncName ??= [];
         state.internalFncName.push(node.expression.name);
         const functionReferncedNode = scope.getReferencedPath(node.expression);
         const internalfnDefIndicators = functionReferncedNode?.scope.indicators;
         const fnDefNode = path.getAncestorOfType('FunctionDefinition');
         state.callingFncName ??= [];
         state.callingFncName.push(fnDefNode?.node.name);
         state.fnParameters = [];
         const args = node.arguments.map(arg =>  arg.name)
         state.pubparams.forEach(index => {
           state.fnParameters ??= [];
           state.fnParameters.push(args[index]);

         });
         const params = [
               `inputs, proof, BackupData`,
         ]
         state.fnParameters = state.fnParameters.concat(params);
         newNode = buildNode('InternalFunctionCall', {
         name: node.expression.name,
         internalFunctionInteractsWithSecret: state.internalFunctionInteractsWithSecret,
         parameters: state.fnParameters,
        });
        newNode.encryptionRequired = internalfnDefIndicators.encryptionRequired;
        node._newASTPointer = newNode;
        parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
        return;
      } else if(!state.internalFunctionInteractsWithSecret){
        state.internalFncName ??= [];
        state.internalFncName.push(node.expression.name);
        const fnDefNode = path.getAncestorOfType('FunctionDefinition');
        state.callingFncName ??= [];
        state.callingFncName.push(fnDefNode?.node.name);
        newNode = buildNode('InternalFunctionCall', {
        name: node.expression.name,
        internalFunctionInteractsWithSecret: state.internalFunctionInteractsWithSecret,
        parameters: node.arguments,
       });
       node._newASTPointer = newNode;
       parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
       return;
      }

       newNode = buildNode('FunctionCall');
       node._newASTPointer = newNode;
       parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
     }
      if (node.kind !== 'typeConversion') {
        newNode = buildNode('FunctionCall');
        node._newASTPointer = newNode;
        parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
        state.skipSubNodes = true;
        return;
      }
      newNode = buildNode('TypeConversion', {
        type: node.typeDescriptions.typeString,
      });
     node._newASTPointer = newNode;
     parentnewASTPointer(parent, path, newNode , parent._newASTPointer[path.containerName]);
    },
  },
}
