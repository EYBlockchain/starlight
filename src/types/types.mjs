export function isArray(thing) {
  return Array.isArray(thing);
}

export function getNodeContext(node, parent, key = 'id') {
  const parentSubTreeNames = getSubTreeNames(parent);
  // let nodeContext = {};
  for (const subTreeName of parentSubTreeNames) {
    if (isArray(parent[subTreeName])) {
      // eslint-disable-next-line consistent-return
      for (let i = 0; i < parent[subTreeName].length; i++) {
        if (parent[subTreeName][i][key] === node[key]) {
          return {
            index: i,
            inArray: true,
            container: parent[subTreeName],
            containerName: subTreeName,
          };
        }
      }
    } else if (parent[subTreeName][key] === node[key]) {
      return {
        inArray: false,
        container: node,
        containerName: subTreeName,
      };
    }
  }
  // return nodeContext;
}

export function getSubTreeNames(node) {
  let names;

  switch (node.nodeType) {
    case 'SourceUnit':
    case 'ContractDefinition':
      names = ['nodes'];
      break;
    case 'FunctionDefinition':
      names = ['parameters', 'returnParameters', 'body'];
      break;
    case 'ParameterList':
      names = ['parameters'];
      break;
    case 'Block':
      names = ['statements'];
      break;
    case 'VariableDeclarationStatement':
      names = ['declarations', 'initialValue'];
      break;
    case 'ExpressionStatement':
      names = ['expression'];
      break;
    case 'Assignment':
      names = ['leftHandSide', 'rightHandSide'];
      break;
    case 'BinaryOperation':
      names = ['leftExpression', 'rightExpression'];
      break;
    case 'VariableDeclaration':
      names = ['typeName'];
      break;
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
      names = [];
      break;

    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(node.nodeType);
  }

  return names;
}
