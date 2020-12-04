/* eslint-disable no-param-reassign, no-shadow */

import logger from '../../utils/logger.mjs';
import { buildNode } from '../../types/solidity-types.mjs';
import { traverseNodesFast } from '../../traverse/traverse.mjs';

export default {
  SourceUnit: {
    enter(path, state) {
      const { node, parent } = path;

      // Figure out a sensible fileName:
      const contractNames = [];
      const subState = { contractNames, skipSubNodes: false };
      const getContractNamesVisitor = (node, state) => {
        if (node.nodeType === 'ContractDefinition') {
          state.contractNames.push(node.name);
          state.skipSubNodes = true;
        }
      };
      traverseNodesFast(node, getContractNamesVisitor, subState);
      if (!contractNames) throw new Error('No contracts in AST');
      if (contractNames.length > 1)
        throw new Error('Only 1 contract per solidity file is currently supported');

      // Create a 'File' node and a 'SourceUnit' subNode.
      // NODEBUILDING
      const newNode = {
        name: contractNames[0],
        nodeType: 'SourceUnit',
        license: node.license,
        nodes: [],
      };

      node._newASTPointer = parent._newASTPointer;
      parent._newASTPointer.push(newNode);
    },

    exit(path, state) {},
  },

  PragmaDirective: {
    // TODO: We should probably check that the `.zsol` Pragma is 'supported'. The output Solidity's pragma will be limited to the latest-supported boilerplate code.
    // However, for now, we'll just inherit the Pragma of the original and hope.
    enter(path, state) {
      const { node, parent } = path;
      const { literals } = node;
      // const newNode = {
      //   literals: node.literals,
      //   nodeType: node.nodeType, // 'PragmaDirective'
      // };
      parent._newASTPointer[0].nodes.push(buildNode('PragmaDirective', { literals }));
      // node._newASTPointer = parent._newASTPointer; - a pragmaDirective is a leaf, so no need to set where we'd next push to.
    },
    exit(path, state) {},
  },

  ContractDefinition: {
    enter(path, state) {
      const { node, parent } = path;
      const isShieldContract = true; // TODO: infer this by traversing for 'secret' keyword, or upon exit by querying 'secret' in scope.bindings? OR, just throw an error when _no_ special syntax is used, and tell the user it's just a regular contract?
      const newNode = buildNode('ContractDefinition', {
        name: node.name,
        isShieldContract,
      });
      node._newASTPointer = newNode.nodes;
      parent._newASTPointer[0].nodes.push(newNode);
    },

    exit(path, state) {
      // We populate much of the contractDefinition upon exit, having populated the ContractDefinition's scope by this point.
      const { node, parent } = path;
      const sourceUnitNodes = parent._newASTPointer[0].nodes;
      const contractNodes = node._newASTPointer;

      const {
        zkSnarkVerificationRequired,
        oldCommitmentReferencesRequired,
        nullifiersRequired,
        commitmentsRequired,
      } = path.scope.indicators;

      // base contracts (`contract MyContract is BaseContract`)
      // NODEBUILDING
      sourceUnitNodes[1].baseContracts.push({
        nodeType: 'InheritanceSpecifier',
        baseName: {
          nodeType: 'UserDefinedTypeName',
          name: 'MerkleTree',
        },
      }); // TODO: other things might have been pushed / spliced into the containing array that is 'parent._newASTPointer', so we might need a more intelligent lookup to ensure we're editing the correct array index. For now, we'll assume the ContractDefinition node is still at index 1.

      // Imports
      // TODO: probably need more intelligent insertions of nodes than splicing / unshifting into fixed positions. This looks over-fitted to the October example-case.
      // NODEBUILDING
      if (zkSnarkVerificationRequired)
        sourceUnitNodes.splice(
          1,
          0,
          buildNode('ImportDirective', { file: './verify/Verifier_Interface.sol' }),
        );
      if (commitmentsRequired)
        sourceUnitNodes.splice(
          1,
          0,
          buildNode('ImportDirective', { file: './merkle-tree/MerkleTree.sol' }),
        );

      // VariableDeclarations:
      if (zkSnarkVerificationRequired)
        contractNodes.unshift(buildNode('ShieldContractConstructorBoilerplate'));
      if (nullifiersRequired)
        contractNodes.unshift(
          buildNode('MappingDeclaration', {
            name: 'nullifiers',
            fromType: 'uint256',
            toType: 'uint256',
          }),
        );
      if (oldCommitmentReferencesRequired) {
        contractNodes.unshift(
          buildNode('VariableDeclaration', {
            name: 'latestRoot',
            type: 'uint256',
            visibility: 'public',
          }),
        );
        contractNodes.unshift(
          buildNode('MappingDeclaration', {
            name: 'commitmentRoots',
            fromType: 'uint256',
            toType: 'uint256',
          }),
        );
      }
      if (zkSnarkVerificationRequired) {
        contractNodes.unshift(
          buildNode('MappingDeclaration', {
            name: 'vks',
            fromType: 'uint256',
            toType: 'uint256[]',
          }),
        );
        contractNodes.unshift(buildNode('ShieldContractVerifierInterfaceBoilerplate'));
      }

      if (state.mainPrivateFunctionName) {
        parent._newASTPointer[0].mainPrivateFunctionName = state.mainPrivateFunctionName; // TODO fix bodge
        parent._newASTPointer[0].nodes.forEach(node => {
          if (node.nodeType === 'ContractDefinition')
            node.mainPrivateFunctionName = state.mainPrivateFunctionName;
        });
      }
    },
  },

  FunctionDefinition: {
    enter(path, state) {},

    exit(path, state) {
      // We populate the entire shield contract upon exit, having populated the FunctionDefinition's scope by this point.
      const { node, parent, scope } = path;

      const newNode = buildNode('FunctionDefinition', { name: node.name, visibility: 'external' });
      // const newNode = {
      //   // insert this FunctionDefinition node into our ContractDefinition node.
      //   // NODEBUILDING
      //   nodeType: node.nodeType, // FunctionDefinition
      //   name: node.name,
      //   visibility: 'external',
      //   body: {
      //     nodeType: 'Block',
      //     statements: [],
      //   },
      //   parameters: {
      //     nodeType: 'ParameterList',
      //     parameters: [],
      //   },
      //   // no returnParameters
      // };
      // Let's populate the `parameters` and `body`:
      const { parameters } = newNode.parameters;
      const { statements } = newNode.body;

      // TODO: in cases where there are duplicate names (from different scopes), we'll need to assign unique names to them.
      // const uniqueNames = [];
      // const countNames = (arr, name) =>
      //   arr.reduce((acc, cur, i, src) => {
      //     if (cur === name) ++acc;
      //     return acc;
      //   }, 0);
      // OR... don't do things by name? Use id?

      const contractDefScope = scope.getAncestorOfScopeType('ContractDefinition');
      const { zkSnarkVerificationRequired } = contractDefScope.indicators;
      const oldCommitmentReferencesRequired = scope.someIndicators(
        i => i.oldCommitmentReferenceRequired,
      );
      const nullifiersRequired = scope.someIndicators(i => i.nullifierRequired);
      const newCommitmentsRequired = scope.someIndicators(i => i.newCommitmentRequired);
      // For the 'toContract' transformation, we don't need to consider the initialisationRequired indicator; although it's important in the other transformations.

      // Parameters:
      // NODEBUILDING
      if (zkSnarkVerificationRequired)
        parameters.push(
          buildNode('VariableDeclaration', {
            name: 'proof',
            type: 'uint256[]',
            storageLocation: 'calldata',
          }),
        );
      if (oldCommitmentReferencesRequired)
        parameters.push(
          buildNode('VariableDeclaration', {
            name: 'commitmentRoot',
            type: 'uint256',
          }),
        );
      if (nullifiersRequired)
        parameters.push(
          buildNode('VariableDeclaration', {
            name: 'newNullifiers',
            type: 'uint256[]',
            storageLocation: 'calldata',
          }),
        );
      if (newCommitmentsRequired) {
        parameters.push(
          buildNode('VariableDeclaration', {
            name: 'newCommitments',
            type: 'uint256[]',
            storageLocation: 'calldata',
          }),
        );
        state.mainPrivateFunctionName = node.name; // TODO fix bodge
      }
      // body:
      if (nullifiersRequired)
        statements.push(buildNode('requireNewNullifiersNotInNullifiersThenAddThemBoilerplate'));
      if (oldCommitmentReferencesRequired)
        statements.push(buildNode('requireCommitmentRootInCommitmentRootsBoilerplate'));
      if (zkSnarkVerificationRequired) {
        statements.push({
          nodeType: 'InputsVariableDeclarationStatementBoilerplate',
          oldCommitmentReferencesRequired,
          nullifiersRequired,
          newCommitmentsRequired,
        });
        statements.push(buildNode('verifyBoilerplate'));
      }
      if (newCommitmentsRequired) statements.push(buildNode('insertLeavesBoilerplate'));

      // no node._newASTPointer assignment yet, because we're not yet considering public smart contract code that might need to be 'copied over' to the shield contract's AST.
      parent._newASTPointer.push(newNode);
    },
  },

  ParameterList: {
    enter(path) {},

    exit(path) {},
  },

  Block: {
    enter(path) {},

    exit(path) {},
  },

  VariableDeclarationStatement: {
    enter(path) {},

    exit(path) {},
  },

  BinaryOperation: {
    enter(path) {},

    exit(path) {},
  },

  Assignment: {
    enter(path, state) {},

    exit(path, state) {},
  },

  ExpressionStatement: {
    enter(path, state) {},

    exit(path, parent) {},
  },

  VariableDeclaration: {
    enter(path, state) {},

    exit(path) {},
  },

  ElementaryTypeName: {
    enter(path) {},

    exit(path) {},
  },

  Identifier: {
    enter(path) {},

    exit(path) {},
  },

  Literal: {
    enter(path) {},

    exit(path) {},
  },
};
