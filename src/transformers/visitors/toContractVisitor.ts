/* eslint-disable no-param-reassign, no-shadow */

// import logger from '../../utils/logger.mjs';
import { buildNode } from '../../types/solidity-types.js';
import { traverseNodesFast } from '../../traverse/traverse.js';
import NodePath from '../../traverse/NodePath.js';

/**
 * @desc:
 * Visitor transforms a `.zol` AST into a `.sol` AST (for a 'shield' contract)
 * NB: the resulting `.sol` AST is custom, and can only be reliably interpreted * by this repo's code generator. Other software might not be able to interpret * this AST.
 */

export default {
  SourceUnit: {
    enter(path: NodePath, state: any) {
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

    exit(path: NodePath, state: any) {},
  },

  PragmaDirective: {
    // TODO: We should probably check that the `.zol` Pragma is 'supported'. The output Solidity's pragma will be limited to the latest-supported boilerplate code.
    // However, for now, we'll just inherit the Pragma of the original and hope.
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const { literals } = node;

      // parent._newASTPointer[0] is the SourceUnit created earlier by this visitor module.
      parent._newASTPointer[0].nodes.push(
        buildNode('PragmaDirective', { literals }),
      );
      // node._newASTPointer = ?; - a pragmaDirective is a leaf, so no need to set where we'd next push to.
    },
    exit(path: NodePath, state: any) {},
  },

  ImportDirective: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const { file } = node;

      // parent._newASTPointer[0] is the SourceUnit created earlier by this visitor module.
      parent._newASTPointer[0].nodes.push(
        buildNode('ImportDirective', { file }),
      );
      // node._newASTPointer = ?; - a pragmaDirective is a leaf, so no need to set where we'd next push to.
    },
    exit(path: NodePath, state: any) {},
  },

  ContractDefinition: {
    enter(path: NodePath, state: any) {
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

      // base contracts (`contract MyContract is BaseContract`)
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
        }),
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
        parent._newASTPointer[0].nodes.forEach(node => {
          if (node.nodeType === 'ContractDefinition')
            node.mainPrivateFunctionName = state.mainPrivateFunctionName;
        });
      }
    },
  },

  FunctionDefinition: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      const isConstructor = node.kind === 'constructor';
      const newNode = buildNode('FunctionDefinition', {
        name: node.name,
        visibility: isConstructor ? '' : 'external',
        isConstructor,
      });

      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },

    exit(path: NodePath, state: any) {
      // We populate the entire shield contract upon exit, having populated the FunctionDefinition's scope by this point.
      const { node, scope } = path;

      const newFunctionDefinitionNode = node._newASTPointer;

      // Let's populate the `parameters` and `body`:
      const { parameters } = newFunctionDefinitionNode.parameters;
      const { postStatements } = newFunctionDefinitionNode.body;

      parameters.push(
        ...buildNode('FunctionBoilerplate', {
          bpSection: 'parameters',
          scope,
        }),
      );

      postStatements.push(
        ...buildNode('FunctionBoilerplate', {
          bpSection: 'postStatements',
          scope,
        }),
      );
    },
  },

  ParameterList: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('ParameterList');
      node._newASTPointer = newNode.parameters;
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path: NodePath) {},
  },

  Block: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('Block');
      node._newASTPointer = newNode.statements;
      parent._newASTPointer.body = newNode;
    },

    exit(path: NodePath) {},
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

      const newNode = buildNode('VariableDeclarationStatement');
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },

    exit(path: NodePath) {},
  },

  BinaryOperation: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { operator } = node;

      const newNode = buildNode('BinaryOperation', { operator });
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer[path.containerName])) {
        parent._newASTPointer[path.containerName].push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
    },

    exit(path: NodePath) {},
  },

  Assignment: {
    enter(path: NodePath, state: any) {
      const { node, parent, scope } = path;

      const binding = scope.getReferencedBinding(node.leftHandSide); // HACK - only works for one very specific example. We should instead create an `interactsWithSecret` indicator and attach it to any node with a child (or grandchild etc) which isSecret. That way, we could just do node.interactsWithSecret() within this function (and others), which would be clean.

      if (binding?.isSecret) {
        // Don't copy over code which should be secret! It shouldn't appear in a public shield contract; only in the circuit! So skip subnodes.
        state.skipSubNodes = true;
        return;
      }
      const { operator } = node;
      const newNode = buildNode('Assignment', { operator });
      node._newASTPointer = newNode;
      parent._newASTPointer.expression = newNode;
    },

    exit(path: NodePath, state: any) {},
  },

  ExpressionStatement: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;

      const newNode = buildNode('ExpressionStatement');
      node._newASTPointer = newNode;
      parent._newASTPointer.push(newNode);
    },

    exit(path: NodePath, parent: any) {},
  },

  VariableDeclaration: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;

      if (path.isFunctionReturnParameterDeclaration())
        throw new Error(
          `TODO: VariableDeclarations of return parameters are tricky to initialise because we might rearrange things so they become _input_ parameters to the circuit. Future enhancement.`,
        );

      let declarationType: string;
      // TODO: `memery` declarations and `returnParameter` declarations
      if (node.stateVariable) {
        declarationType = 'state'; // not really needed, since we already have 'stateVariable'
      } else if (path.isLocalStackVariableDeclaration()) {
        declarationType = 'localStack';
      } else if (path.isFunctionParameterDeclaration()) {
        declarationType = 'parameter';
      }

      // If it's not declaration of a state variable, it's either a function parameter or a local stack variable declaration. We _do_ want to add this to the newAST.
      const newNode = buildNode('VariableDeclaration', {
        name: node.name,
        isSecret: node.isSecret,
        declarationType,
        typeString: node.typeDescriptions?.typeString,
        visibility: node.visibility,
      });
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer)) {
        parent._newASTPointer.push(newNode);
      } else {
        parent._newASTPointer[path.containerName].push(newNode);
      }
    },

    exit(path: NodePath) {},
  },

  ElementaryTypeName: {
    enter(path: NodePath) {
      const { node, parent } = path;

      // no pointer needed, because this is a leaf, so we won't be recursing any further.
      parent._newASTPointer[path.containerName] = buildNode(
        'ElementaryTypeName',
        {
          typeDescriptions: {
            typeString: node.typeDescriptions.typeString || node.name,
          },
        },
      );
    },

    exit(path: NodePath) {},
  },

  // e.g. for the statement `address(this)`, `address()` is an ElementaryTypeNameExpression for the ElementaryTypeName `address`
  ElementaryTypeNameExpression: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const newNode = buildNode('ElementaryTypeNameExpression');

      node._newASTPointer = newNode;
      parent._newASTPointer[path.containerName] = newNode;
    },

    exit(path: NodePath) {},
  },

  Identifier: {
    enter(path: NodePath) {
      const { node, parent } = path;
      const { name } = node;

      const newNode = buildNode('Identifier', { name });

      // node._newASTPointer = // no pointer needed, because this is a leaf, so we won't be recursing any further.
      if (Array.isArray(parent._newASTPointer[path.containerName])) {
        parent._newASTPointer[path.containerName].push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
    },

    exit(path: NodePath) {},
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

      if (Array.isArray(parent._newASTPointer[path.containerName])) {
        parent._newASTPointer[path.containerName].push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
    },

    exit(path: NodePath) {},
  },

  MemberAccess: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;

      let newNode: any;

      if (path.isMsgSender()) {
        newNode = buildNode('MsgSender');
        // node._newASTPointer = // no pointer needed in this case, because this is effectively leaf, so we won't be recursing any further.
        state.skipSubNodes = true;
      } else {
        newNode = buildNode('MemberAccess', { memberName: node.memberName });
        node._newASTPointer = newNode;
      }

      if (Array.isArray(parent._newASTPointer[path.containerName])) {
        parent._newASTPointer[path.containerName].push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
    },
  },

  IndexAccess: {
    enter(path: NodePath) {
      const { node, parent } = path;

      const newNode = buildNode('IndexAccess');
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer[path.containerName])) {
        parent._newASTPointer[path.containerName].push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
    },
  },

  Mapping: {
    enter(path: NodePath) {
      const { node, parent } = path;

      const newNode = buildNode('Mapping');
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer[path.containerName])) {
        parent._newASTPointer[path.containerName].push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
    },
  },

  FunctionCall: {
    enter(path: NodePath, state: any) {
      const { node, parent } = path;
      let newNode: any;

      // If this node is a require statement, it might include arguments which themselves are expressions which need to be traversed. So rather than build a corresponding 'assert' node upon entry, we'll first traverse into the arguments, build their nodes, and then upon _exit_ build the assert node.

      if (path.isRequireStatement()) {
        // If the 'require' statement contains secret state variables, we'll presume the circuit will perform that logic, so we'll do nothing in the contract.
        const findSecretSubnode = (p, state) => {
          const isSecret = p.getReferencedNode()?.isSecret;

          if (isSecret) {
            state.secretFound = true;
          }
        };
        const subState = { secretFound: false };
        path.traversePathsFast(findSecretSubnode, subState);
        if (subState.secretFound) {
          state.skipSubNodes = true;
          return;
        }

        // HACK: eventually we'll need to 'copy over' (into the circuit) require statements which have arguments which have interacted with secret states elsewhere in the function (at least).
        // For now, we'll copy these into Solidity:
        newNode = buildNode('FunctionCall');
        node._newASTPointer = newNode;
        if (Array.isArray(parent._newASTPointer[path.containerName])) {
          parent._newASTPointer[path.containerName].push(newNode);
        } else {
          parent._newASTPointer[path.containerName] = newNode;
        }
        return;
      }

      if (path.isExternalFunctionCall()) {
        // External function calls are the fiddliest of things, because they must be retained in the Solidity contract, rather than brought into the circuit. With this in mind, it's easiest (from the pov of writing this transpiler) if External function calls appear at the very start or very end of a function. If they appear interspersed around the middle, we'd either need multiple circuits per Zolidity function, or we'd need a set of circuit parameters (non-secret params / return-params) per external function call, and both options are too painful for now.
        // TODO: need a warning message to this effect ^^^

        newNode = buildNode('FunctionCall');
        node._newASTPointer = newNode;

        if (Array.isArray(parent._newASTPointer[path.containerName])) {
          parent._newASTPointer[path.containerName].push(newNode);
        } else {
          parent._newASTPointer[path.containerName] = newNode;
        }
        return;
      }

      newNode = buildNode('FunctionCall');
      node._newASTPointer = newNode;
      if (Array.isArray(parent._newASTPointer[path.containerName])) {
        parent._newASTPointer[path.containerName].push(newNode);
      } else {
        parent._newASTPointer[path.containerName] = newNode;
      }
    },
  },
};
