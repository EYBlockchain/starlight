/* eslint-disable consistent-return */
import buildNode from '../../../../types/orchestration-types.mjs';

/**
 * @param {string} nodeType - the type of node you'd like to build
 * @param {Object} fields - important key, value pairs to include in the node, and which enable the rest of the node's info to be derived. How do you know which data to include in `fields`? Read this function.
 */
export function buildPrivateStateNode(nodeType, fields = {}) {
  switch (nodeType) {
    case 'InitialisePreimage': {
      const { privateStateName, indicator = {} } = fields;
      return {
        privateStateName,
        mappingKey: indicator.referencedKeyName || null,
        mappingName: indicator.referencedKeyName ? indicator.node?.name : null,
      };
    }
    case 'ReadPreimage': {
      const {
        id,
        increment,
        reinitialisedOnly,
        accessedOnly,
        indicator = {},
      } = fields;
      return {
        increment,
        stateVarId: id,
        isWhole: indicator.isWhole,
        isPartitioned: indicator.isPartitioned,
        mappingKey: indicator.referencedKeyName || null,
        mappingName: indicator.referencedKeyName ? indicator.node?.name : null,
        nullifierRequired: indicator.isNullified,
        reinitialisedOnly,
        accessedOnly,
        isOwned: indicator.isOwned,
        mappingOwnershipType: indicator.mappingOwnershipType,
        owner: indicator.isOwned
          ? indicator.owner.node?.name || indicator.owner.name
          : null,
        ownerIsSecret: indicator.isOwned
          ? indicator.owner.isSecret || indicator.owner.node?.isSecret
          : null,
        ownerIsParam: indicator.isOwned ? indicator.owner.isParam : null,
      };
    }
    case 'WritePreimage': {
      const { id, increment, burnedOnly, indicator = {} } = fields;
      return {
        increment,
        stateVarId: id,
        isWhole: indicator.isWhole,
        isPartitioned: indicator.isPartitioned,
        mappingKey: indicator.referencedKeyName || null,
        mappingName: indicator.referencedKeyName ? indicator.node?.name : null,
        nullifierRequired: indicator.isNullified,
        burnedOnly,
        isOwned: indicator.isOwned,
        mappingOwnershipType: indicator.mappingOwnershipType,
        owner: indicator.isOwned
          ? indicator.owner.node?.name || indicator.owner.name
          : null,
        ownerIsSecret: indicator.isOwned
          ? indicator.owner.isSecret || indicator.owner.node?.isSecret
          : null,
      };
    }
    case 'MembershipWitness': {
      const {
        increment,
        privateStateName,
        accessedOnly,
        indicator = {},
      } = fields;
      return {
        increment,
        privateStateName,
        accessedOnly,
        isWhole: indicator.isWhole,
        isPartitioned: indicator.isPartitioned,
      };
    }
    case 'CalculateNullifier': {
      const { increment, indicator = {} } = fields;
      return {
        increment,
        isWhole: indicator.isWhole,
        isPartitioned: indicator.isPartitioned,
      };
    }
    case 'CalculateCommitment': {
      const { id, increment, privateStateName, indicator = {} } = fields;
      return {
        privateStateName,
        stateVarId: id,
        increment,
        isWhole: indicator.isWhole,
        isPartitioned: indicator.isPartitioned,
        nullifierRequired: indicator.isNullified,
        isOwned: indicator.isOwned,
        mappingOwnershipType: indicator.mappingOwnershipType,
        owner: indicator.isOwned
          ? indicator.owner.node?.name || indicator.owner.name
          : null,
        ownerIsSecret: indicator.isOwned
          ? indicator.owner.isSecret || indicator.owner.node?.isSecret
          : null,
      };
    }
    case 'GenerateProof': {
      const {
        id,
        increment,
        reinitialisedOnly,
        burnedOnly,
        accessedOnly,
        privateStateName,
        indicator = {},
      } = fields;
      return {
        privateStateName,
        stateVarId: id,
        reinitialisedOnly,
        burnedOnly,
        accessedOnly,
        nullifierRequired: indicator.isNullified,
        increment,
        isMapping: indicator.isMapping,
        isWhole: indicator.isWhole,
        isPartitioned: indicator.isPartitioned,
        isOwned: indicator.isOwned,
        mappingOwnershipType: indicator.mappingOwnershipType,
        owner: indicator.isOwned
          ? indicator.owner.node?.name || indicator.owner.name
          : null,
        ownerIsSecret: indicator.isOwned
          ? indicator.owner.isSecret || indicator.owner.node?.isSecret
          : null,
      };
    }
    case 'SendTransaction': {
      const {
        increment,
        reinitialisedOnly,
        burnedOnly,
        accessedOnly,
        indicator = {},
      } = fields;
      return {
        increment,
        isPartitioned: indicator.isPartitioned,
        isWhole: indicator.isWhole,
        reinitialisedOnly,
        burnedOnly,
        accessedOnly,
        nullifierRequired: indicator.isNullified,
      };
    }

    default:
      throw new TypeError(nodeType);
  }
}

/**
 * @param {string} nodeType - the type of node you'd like to build
 * @param {Object} fields - important key, value pairs to include in the node, and which enable the rest of the node's info to be derived. How do you know which data to include in `fields`? Read this function.
 */
export function buildBoilerplateNode(nodeType, fields = {}) {
  switch (nodeType) {
    case 'InitialiseKeys': {
      const { onChainKeyRegistry, contractName } = fields;
      return {
        nodeType,
        contractName,
        onChainKeyRegistry,
      };
    }
    case 'InitialisePreimage': {
      const { privateStates = {} } = fields;
      return {
        nodeType,
        privateStates,
      };
    }
    case 'ReadPreimage': {
      const { privateStates = {} } = fields;
      return {
        nodeType,
        privateStates,
      };
    }
    case 'WritePreimage': {
      const {
        contractName,
        onChainKeyRegistry = false,
        privateStates = {},
      } = fields;
      return {
        nodeType,
        privateStates,
        contractName,
        onChainKeyRegistry,
      };
    }
    case 'MembershipWitness': {
      const { contractName, privateStates = {} } = fields;
      return {
        nodeType,
        privateStates,
        contractName,
      };
    }
    case 'CalculateNullifier': {
      const { privateStates = {} } = fields;
      return {
        nodeType,
        privateStates,
      };
    }
    case 'CalculateCommitment': {
      const { privateStates = {} } = fields;
      return {
        nodeType,
        privateStates,
      };
    }
    case 'GenerateProof': {
      const { circuitName, privateStates = {}, parameters = [] } = fields;
      return {
        nodeType,
        circuitName,
        privateStates,
        parameters,
      };
    }
    case 'SendTransaction': {
      const {
        functionName,
        contractName,
        publicInputs = [],
        privateStates = {},
      } = fields;
      return {
        nodeType,
        privateStates,
        functionName,
        contractName,
        publicInputs,
      };
    }
    case 'SetupCommonFilesBoilerplate': {
      const {
        contractName,
        functionNames = [],
        constructorParams = [],
        contractImports = [],
      } = fields;
      return {
        nodeType,
        contractName,
        functionNames,
        constructorParams,
        contractImports,
      };
    }
    case 'EditableCommitmentCommonFilesBoilerplate': {
      return {
        nodeType,
      };
    }
    // TODO link to buildNode for function -> param list -> buildPrivateStateNode
    case 'IntegrationTestBoilerplate': {
      const {
        contractName,
        functions = [],
        constructorParams = [],
        contractImports = [],
      } = fields;
      return {
        nodeType,
        contractName,
        functions,
        constructorParams,
        contractImports,
      };
    }
    case 'IntegrationTestFunction': {
      const {
        name,
        parameters = buildNode('ParameterList', fields),
        decrementsSecretState = false,
      } = fields;
      return {
        nodeType,
        name,
        parameters,
        decrementsSecretState,
      };
    }
    default:
      throw new TypeError(nodeType);
  }
}
