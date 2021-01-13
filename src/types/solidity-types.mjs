/* eslint-disable consistent-return, no-param-reassign */

import cloneDeep from 'lodash.clonedeep';

export function isArray(thing) {
  return Array.isArray(thing);
}

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
    case 'SourceUnit':
    case 'ContractDefinition':
      return {
        nodes: [],
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
    case 'Mapping':
      return {
        keyType: {},
        valueType: {},
      };
    case 'IndexAccess':
      return {
        indexExpression: {},
        baseExpression: {},
      };
    case 'MemberAccess':
      return {
        expression: {},
      };
    case 'UnaryOperation':
      return {
        subExpression: {},
      };
    case 'TupleExpression':
      return {
        components: [],
      };
    case 'FunctionCall':
      return {
        expression: {},
        arguments: [],
      };
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
      return {};

    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(nodeType);
  }
}

export function getVisitableKeys(nodeType) {
  switch (nodeType) {
    case 'SourceUnit':
    case 'ContractDefinition':
      return ['nodes', 'baseContracts'];
    case 'InheritanceSpecifier':
      return ['baseName'];
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
    case 'Mapping':
      return ['keyType', 'valueType'];
    case 'IndexAccess':
      return ['indexExpression', 'baseExpression'];
    case 'MemberAccess':
      return ['expression'];
    case 'UnaryOperation':
      return ['subExpression'];
    case 'TupleExpression':
      return ['components'];
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
    case 'UserDefinedTypeName':
      return [];
    case 'FunctionCall':
      return ['expression, arguments'];

    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(nodeType);
  }
}

// creates node.parentPath based on parent's nodeType
// should be used at the end of an enter() call
export function setParentPath(node, _parent) {
  const parent = cloneDeep(_parent);
  let i = 0;
  switch (parent.nodeType) {
    case 'SourceUnit':
    case 'ContractDefinition':
      parent.nodes.forEach(childNode => {
        if (childNode.name === node.name) delete parent.nodes[i];
        i++;
      });
      node.parentPath = parent;
      break;
    case 'FunctionDefinition':
      switch (node.nodeType) {
        case 'ParameterList':
          if (parent.parameters === node) {
            delete parent.parameters;
          } else if (parent.returnParameters === node) {
            delete parent.returnParameters;
          }
          break;
        case 'Block':
          delete parent.body;
          break;
        default:
          throw new TypeError(node.nodeType);
      }
      node.parentPath = parent;
      break;
    case 'ParameterList':
      parent.parameters.forEach(param => {
        if (param.name === node.name) delete parent.parameters[i];
        i++;
      });
      node.parentPath = parent;
      break;
    case 'Block':
      parent.statements.forEach(statement => {
        if (statement.id === node.id) {
          delete parent.statements[i];
        }
        i++;
      });
      node.parentPath = parent;
      break;
    case 'VariableDeclarationStatement':
      parent.declarations.forEach(declaration => {
        if (declaration === node) {
          delete parent.declarations[i];
        }
        i++;
      });
      if (parent.initialValue === node) {
        delete parent.initialValue;
      }
      node.parentPath = parent;
      break;
    case 'ExpressionStatement':
      if (parent.expression.leftHandSide.id === node.id) delete parent.leftHandSide;
      if (parent.expression.rightHandSide.id === node.id) delete parent.rightHandSide;
      node.parentPath = parent;
      break;
    case 'Assignment':
      if (parent.leftHandSide.id === node.id) delete parent.leftHandSide;
      if (parent.rightHandSide.id === node.id) delete parent.rightHandSide;
      node.parentPath = parent;
      break;
    case 'BinaryOperation':
      if (parent.leftExpression.id === node.id) delete parent.leftExpression;
      if (parent.rightExpression.id === node.id) delete parent.rightExpression;
      node.parentPath = parent;
      break;
    case 'VariableDeclaration':
      delete parent.typeName;
      node.parentPath = parent;
      break;
    case 'PragmaDirective':
    case 'ElementaryTypeName':
    case 'Identifier':
    case 'Literal':
      break; // have no children

    // And again, if we haven't recognized the nodeType then we'll throw an
    // error.
    default:
      throw new TypeError(parent.nodeType);
  }
  i = 0; // reset just in case we call again
}

// finds the node with id = referencedDeclaration by working up the tree
// will NOT work unless nodes have parentPaths (above)
// should be used at an exit() call
export function findReferencedDeclaration(node, parent) {
  if (node.nodeType !== 'Identifier') return; // only for Identifiers atm
  const id = node.referencedDeclaration; // the node we're looking for
  console.log('In findReferencedDeclaration');
  if (id > node.id) console.log("We haven't reached this declaration yet"); // shouldn't arrive here
  // Assigment -> Statement -> parent of that
  let currentRoot = parent.parentPath.parentPath; // the 'root' we are starting to search from
  let idFound = false;
  const isVisited = [];
  let dec; // = declaration (found node with node.id = id)
  // eslint-disable-next-line no-labels
  topLoop: while (!idFound) {
    // console.log('at toploop', currentRoot);
    for (const subTreeName of getVisitableKeys(currentRoot.nodeType)) {
      // console.log(`subTreeName: ${subTreeName}`);
      // console.log(currentRoot);
      if (isArray(currentRoot[subTreeName])) {
        // console.log('in array of subtrees');
        for (let i = 0; i < currentRoot[subTreeName].length; i++) {
          // console.log(i, currentRoot[subTreeName][i]);
          if (currentRoot[subTreeName][i]) {
            // a node - if not we go right
            // console.log(`currentRoot: ${currentRoot[subTreeName][i].id}`);
            const currentId = currentRoot[subTreeName][i].id;

            if (
              (isVisited[currentId] === true && i === currentRoot[subTreeName].length - 1) ||
              currentId > node.id
            ) {
              // case: we've gone from left to right and haven't found the node, so we go up one
              currentRoot = currentRoot.parentPath;
              // console.log(`we go up: ${currentRoot.nodeType}  ${currentRoot.id}`);
              // eslint-disable-next-line no-labels, no-continue
              continue topLoop; // node is not in this castle - we go up
            }

            isVisited[currentId] = true; // make sure we don't revisit

            if (currentId > id) {
              // case: we could be above the node, so we look down
              // if not, we've visited this node, so we'll only go up or right on the next pass
              currentRoot = currentRoot[subTreeName][i];
              // console.log(`we go down: ${currentRoot.nodeType}  ${currentRoot.id}`);
              // eslint-disable-next-line no-labels, no-continue
              continue topLoop; // node is not in this castle - we go down
            } else if (currentId === id) {
              // case: we've only gone and found it
              idFound = true;
              dec = currentRoot[subTreeName][i];
              break;
            } // case: if currentId < id, we keep going right
          }
        }
      } else {
        // console.log('in single subtree');
        // console.log(currentRoot[subTreeName]);
        // eslint-disable-next-line no-labels, no-continue, no-lonely-if
        if (currentRoot[subTreeName]) {
          // a node - if not we go right
          const currentId = currentRoot[subTreeName].id;
          // console.log(`currentRoot: ${currentId}`);
          if (
            currentRoot.parentPath &&
            (isVisited[currentId] === true || // already visited
              currentId > node.id || // gone too far right
              getVisitableKeys(currentRoot[subTreeName].nodeType).length < 1) // reached leaf at bottom
          ) {
            // case: if the parent exists (i.e. we can go up) AND one or more of the above (i.e we should go up)
            isVisited[currentId] = true;
            currentRoot = currentRoot.parentPath;
            // console.log(`we go up: ${currentRoot.nodeType} ${currentRoot.id}`);
            // eslint-disable-next-line no-labels, no-continue
            continue topLoop; // node is not in this castle - we go up
          } else if (
            currentId > id &&
            currentRoot[subTreeName] &&
            getVisitableKeys(currentRoot[subTreeName].nodeType).length > 0
          ) {
            // case: if the child exists (i.e. we can go down) and we could be above the node (i.e. we should go down)
            isVisited[currentId] = true;
            currentRoot = currentRoot[subTreeName];
            // console.log(`we go down: ${currentRoot.nodeType} ${currentRoot.id}`);
            // eslint-disable-next-line no-labels, no-continue
            continue topLoop; // node is not in this castle - we go down
          } else if (currentId === id) {
            // case: we've only gone and found it
            idFound = true;
            dec = currentRoot[subTreeName];
            break;
          } else {
            // case: strange one - this means we've looked all over the available tree from parent.parentPath.parentPath, and haven't found it, so it must be way up
            // TODO: start with x2 parentPaths up, then HERE increment to 3, 4, 5, ...
            isVisited[currentId] = true;
            currentRoot = parent.parentPath.parentPath.parentPath;
            // console.log(`we reset: ${currentRoot.nodeType} ${currentRoot.id}`);
            // eslint-disable-next-line no-labels, no-continue
            continue topLoop; // node is not in this castle - we go down
          }
        } else {
          console.log(`This is very bad`); // case: ????
        }
      }
      if (idFound === true) break;
      currentRoot = currentRoot.parentPath; // case: we've looked through everything normally, so we go up
      // console.log(`we go up: ${currentRoot.nodeType} ${currentRoot.id}`);
      // eslint-disable-next-line no-labels, no-continue
      continue topLoop; // node is not in this castle - we go up
    }

    break;
  }
  // eslint-disable-next-line consistent-return
  return dec;
}

export default { getNodeLocation };
