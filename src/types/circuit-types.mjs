/* eslint-disable consistent-return */

export function isArray(thing) {
  return Array.isArray(thing);
}

/**
 * container:
 *     1) If the node is _not_ contained within a list:
 *        parent: {
 *            key: { <-- 'key' is the 'containerName'
 *                // contents of the node
 *            }
 *        }
 *        // the node is at parent[key]
 *
 *     2) If the node _is_ contained within a list:
 *        parent: {
 *            key: [  <-- 'key' is the 'containerName'
 *                {                                <--| this is the node
 *                    // contents of the node      <--| at some 'index' of this
 *                }                                <--| container
 *            ]
 *        }
 *        // the node is at parent[key][index]
 *
 * So overall, the naming is such that the node is always at container[key]
 */
export function getNodeLocation(node, parent, matchKey = 'id') {
  const visitableParentKeys = getVisitableKeys(parent.nodeType);
  for (const key of visitableParentKeys) {
    if (isArray(parent[key])) {
      for (let i = 0; i < parent[key].length; i++) {
        if (parent[key][i][matchKey] === node[matchKey]) {
          return {
            index: i,
            inArray: true,
            array: parent[key],
            containerName: key,
          };
        }
      }
    } else if (parent[key][matchKey] === node[matchKey]) {
      return {
        inArray: false,
        containerName: key,
      };
    }
  }
}

export function getNodeSkeleton(nodeType) {
  switch (nodeType) {
    case 'Folder':
      return {
        files: [],
      };
    case 'File':
      return {
        nodes: [],
      };
    case 'ImportList':
      return {
        imports: [],
      };
    case 'FunctionDefinition':
      return {
        body: {},
        parameters: {},
        returnParameters: {},
      };
    case 'ParameterList':
      return {
        parameters: [],
      };
    case 'Block':
      return {
        statements: [],
      };
    case 'VariableDeclarationStatement':
      return {
        declarations: [],
        initialValue: {},
      };
    case 'ExpressionStatement':
      return {
        expression: {},
      };
    case 'Assignment':
      return {
        leftHandSide: {},
        rightHandSide: {},
      };
    case 'BinaryOperation':
      return {
        leftExpression: {},
        rightExpression: {},
      };
    case 'VariableDeclaration':
      return {
        typeName: {},
      };
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
      return {};
    case 'UpdatableCommitment':
      return {}; // how do we add the 'name' of the commitment's state etc?

    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(nodeType);
  }
}

export function getVisitableKeys(nodeType) {
  switch (nodeType) {
    case 'Folder':
      return ['files'];
    case 'File':
      return ['nodes'];
    case 'ImportStatements':
      return ['imports'];
    case 'SourceUnit':
    case 'ContractDefinition':
      return ['nodes'];
    case 'FunctionDefinition':
      return ['parameters', 'returnParameters', 'body'];
    case 'ParameterList':
      return ['parameters'];
    case 'Block':
      return ['statements'];
    case 'VariableDeclarationStatement':
      return ['declarations', 'initialValue'];
    case 'ExpressionStatement':
      return ['expression'];
    case 'Assignment':
      return ['leftHandSide', 'rightHandSide'];
    case 'BinaryOperation':
      return ['leftExpression', 'rightExpression'];
    case 'VariableDeclaration':
      return ['typeName'];
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
      return [];

    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(nodeType);
  }
}

export function buildEditableCommitmentParameters(privateStateName) {
  const EDITABLE_COMMITMENT_PARAMETERS = [
    ['oldCommitment_privateState', true, 'u32[8]'],
    ['oldCommitment_salt', true, 'u32[8]'],
    ['oldCommitment_membershipWitness_index', true, 'field'],
    ['oldCommitment_membershipWitness_siblingPath', true, 'field[32]'], // TODO tree height config
    ['oldCommitment_nullifier', false, 'field'], // PUBLIC
    ['newCommitment_privateState', true, 'u32[8]'],
    ['newCommitment_salt', true, 'u32[8]'],
    ['newCommitment_commitment', false, 'field'], // PUBLIC'
  ];

  const parameters = [];

  for (const paramArr of EDITABLE_COMMITMENT_PARAMETERS) {
    const param = {
      nodeType: 'VariableDeclaration',
      name: `${privateStateName}_${paramArr[0]}`,
      isPrivate: paramArr[1],
      typeName: {
        nodeType: 'ElementaryTypeName',
        name: paramArr[2],
      },
    };
    parameters.push(param);
  }

  return parameters;
}

export default { getNodeLocation, buildEditableCommitmentParameters };
