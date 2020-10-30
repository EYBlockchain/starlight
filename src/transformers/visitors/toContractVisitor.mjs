/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../utils/logger.mjs';
import { getNodeLocation, findReferencedDeclaration } from '../../types/solidity-types.mjs';
import {
  collectAllStateVariableBindings,
  queryScopeAncestors,
  findReferencedBinding,
  getScopeAncestorOfType,
} from '../../traverse/scope.mjs';
import circuitTypes from '../../types/circuit-types.mjs';
import { traverse, traverseNodesFast } from '../../traverse/traverse.mjs';


export default {
  SourceUnit: {
    enter(path, state, scope) {
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
      const newNode = {
        name: contractNames[0],
        nodeType: 'SourceUnit',
        license: node.license,
        nodes: [],
      };
      node._context = parent._context;
      parent._context.push(newNode);
    },

    exit(path, state, scope) {},
  },

  PragmaDirective: {
    // TODO: We should probably check that the `.zsol` Pragma is 'supported'. The output Solidity's pragma will be limited to the latest-supported boilerplate code.
    // However, for now, we'll just inherit the Pragma of the original and hope.
    enter(path, state, scope) {
      const { node, parent } = path;
      const newNode = {
        literals: node.literals,
        nodeType: node.nodeType, // 'PragmaDirective'
      };
      parent._context[0].nodes.push(newNode);
      // node._context = parent._context; - a pragmaDirective is a leaf, so no need to set where we'd next push to.
    },
    exit(path, state, scope) {},
  },

  ContractDefinition: {
    enter(path, state, scope) {
      const { node, parent } = path;
      const newNode = {
        name: node.name,
        nodeType: node.nodeType, // 'ContractDefinition'
        isShieldContract: true, // TODO: infer this by traversing for 'secret' keyword, or upon exit by querying 'secret' in scope.bindings? OR, just throw an error when _no_ special syntax is used, and tell the user it's just a regular contract?
        baseContracts: [],
        nodes: [],
      };
      node._context = newNode.nodes;
      parent._context[0].nodes.push(newNode);
    },

    exit(path, state, scope) {
      // We populate much of the contractDefinition upon exit, having populated the ContractDefinition's scope by this point.
      const { node, parent } = path;
      const sourceUnitNodes = parent._context[0].nodes;
      const contractNodes = node._context;

      const {
        zkSnarkVerificationRequired,
        oldCommitmentReferencesRequired,
        nullifiersRequired,
        commitmentsRequired,
      } = scope.indicators;

      // base contracts (`contract MyContract is BaseContract`)
      sourceUnitNodes[1].baseContracts.push({
        nodeType: 'InheritanceSpecifier',
        baseName: {
          nodeType: 'UserDefinedTypeName',
          name: 'MerkleTree',
        },
      }); // TODO: other things might have been pushed / spliced into the containing array that is 'parent._context', so we might need a more intelligent lookup to ensure we're editing the correct array index. For now, we'll assume the ContractDefinition node is still at index 1.

      // Imports
      if (zkSnarkVerificationRequired)
        sourceUnitNodes.splice(1, 0, {
          nodeType: 'ImportDirective',
          file: './verify/Verifier_Interface.sol',
        });
      if (commitmentsRequired)
        sourceUnitNodes.splice(1, 0, {
          nodeType: 'ImportDirective',
          file: './merkle-tree/MerkleTree.sol',
        });

      // VariableDeclarations:
      if (zkSnarkVerificationRequired)
        contractNodes.unshift({
          nodeType: 'ShieldContractConstructorBoilerplate',
        });
      if (nullifiersRequired)
        contractNodes.unshift({
          nodeType: 'ShieldContractMappingBoilerplate',
          args: ['nullifiers', 'uint256', 'uint256'],
        });
      if (oldCommitmentReferencesRequired) {
        contractNodes.unshift({
          nodeType: 'VariableDeclaration',
          name: 'latestRoot',
          typeDescriptions: { typeString: 'uint256' },
          visibility: 'public',
        });
        contractNodes.unshift({
          nodeType: 'ShieldContractMappingBoilerplate',
          args: ['commitmentRoots', 'uint256', 'uint256'],
        });
      }
      if (zkSnarkVerificationRequired) {
        contractNodes.unshift({
          nodeType: 'ShieldContractMappingBoilerplate',
          args: ['vks', 'uint256', 'uint256[]'],
        });
        contractNodes.unshift({
          nodeType: 'ShieldContractVerifierInterfaceBoilerplate',
        });
      }
    },
  },

  FunctionDefinition: {
    enter(path, state, scope) {},

    exit(path, state, scope) {
      // We populate the entire shield contract upon exit, having populated the FunctionDefinition's scope by this point.
      const { node, parent } = path;

      const newNode = {
        // insert this FunctionDefinition node into our ContractDefinition node.
        nodeType: node.nodeType, // FunctionDefinition
        name: node.name,
        visibility: 'external',
        body: {
          nodeType: 'Block',
          statements: [],
        },
        parameters: {
          nodeType: 'ParameterList',
          parameters: [],
        },
        // no returnParameters
      };
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

      const contractDefScope = getScopeAncestorOfType(scope, 'ContractDefinition');
      const { zkSnarkVerificationRequired } = contractDefScope.indicators;
      const oldCommitmentReferencesRequired = scope.indicators.some(
        i => i.oldCommitmentReferenceRequired,
      );
      const nullifiersRequired = scope.indicators.some(i => i.nullifierRequired);
      const newCommitmentsRequired = scope.indicators.some(i => i.newCommitmentRequired);
      // For the 'toContract' transformation, we don't need to consider the initialisationRequired indicator; although it's important in the other transformations.

      // Parameters:
      if (zkSnarkVerificationRequired)
        parameters.push({
          nodeType: 'VariableDeclaration',
          name: 'proof',
          storageLocation: 'calldata',
          typeDescriptions: { typeString: 'uint256[]' },
        });
      if (oldCommitmentReferencesRequired)
        parameters.push({
          nodeType: 'VariableDeclaration',
          name: 'commitmentRoot',
          typeDescriptions: { typeString: 'uint256' },
        });
      if (nullifiersRequired)
        parameters.push({
          nodeType: 'VariableDeclaration',
          name: 'newNullifiers',
          storageLocation: 'calldata',
          typeDescriptions: { typeString: 'uint256[]' },
        });
      if (newCommitmentsRequired)
        parameters.push({
          nodeType: 'VariableDeclaration',
          name: 'newCommitments',
          storageLocation: 'calldata',
          typeDescriptions: { typeString: 'uint256[]' },
        });

      // body:
      if (nullifiersRequired)
        statements.push({
          nodeType: 'requireNewNullifiersNotInNullifiersThenAddThemBoilerplate',
        });
      if (oldCommitmentReferencesRequired)
        statements.push({
          nodeType: 'requireCommitmentRootInCommitmentRootsBoilerplate',
        });
      if (zkSnarkVerificationRequired) {
        statements.push({
          nodeType: 'InputsVariableDeclarationStatementBoilerplate',
          oldCommitmentReferencesRequired,
          nullifiersRequired,
          newCommitmentsRequired,
        });
        statements.push({
          nodeType: 'verifyBoilerplate',
        });
      }
      if (newCommitmentsRequired)
        statements.push({
          nodeType: 'insertLeavesBoilerplate',
        });

      // no node._context assignment yet, because we're not yet considering public smart contract code that might need to be 'copied over' to the shield contract's AST.
      parent._context.push(newNode);
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
    enter(path, state, scope) {},

    exit(path, state, scope) {},
  },

  ExpressionStatement: {
    enter(path, state, scope) {},

    exit(node, parent) {},
  },

  VariableDeclaration: {
    enter(path, state, scope) {},

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
