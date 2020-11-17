/**
Reads an input file line by line and passes each line for further processing
*/

import fs from 'fs';
import logger from './utils/logger.mjs';

function findNodeId(ast, type, name, rhs) {
  const { nodes } = ast.nodes[1];
  let nodeId;
  switch (type) {
    case 'global':
      for (const node of nodes) {
        if (node.nodeType === 'VariableDeclaration' && node.name === `${name}`) {
          nodeId = node.id;
          break;
        }
      }
      if (!nodeId) logger.debug(`Node Id for ${type} ${name} not found`);
      break;
    case 'assignment':
      // TODO not the case anymore - we can have keywords in from of assignments
      // logger.debug( `Assignment: need to 1. warn user and 2. check the global exists and return that nodeid`);
      for (const node of nodes) {
        if (node.nodeType === 'FunctionDefinition') {
          const fnScope = { nodes: [{}, {}] };
          fnScope.nodes[1].nodes = node.body.statements;
          nodeId = findNodeId(fnScope, type, name, rhs);
        }
        if (nodeId) break;
        if (
          node.nodeType === 'ExpressionStatement' &&
          node.expression.nodeType === 'Assignment' &&
          node.expression.leftHandSide.name === name
        ) {
          // TODO change how this works so we can accurately match assignments - may get the wrong id here for anything but identifiers and lierals
          if (
            node.expression.rightHandSide.nodeType === 'Identifier' &&
            !rhs.includes(node.expression.rightHandSide.name)
          )
            break;
          if (
            node.expression.rightHandSide.nodeType === 'Literal' &&
            !rhs.includes(node.expression.rightHandSide.value)
          )
            break;
          nodeId = node.expression.leftHandSide.id;
          break;
        }
      }
      break;
    case 'function':
      for (const node of nodes) {
        if (
          node.nodeType === 'FunctionDefinition' &&
          node.kind === 'function' &&
          node.name === `${name}`
        ) {
          nodeId = node.id;
          break;
        }
      }
      if (!nodeId) logger.debug(`Node Id for ${type} ${name} not found`);
      break;
    case 'constructor':
      for (const node of nodes) {
        if (node.nodeType === 'FunctionDefinition' && node.kind === 'constructor') {
          nodeId = node.id;
          break;
        }
      }
      if (!nodeId) logger.debug(`Node Id for ${type} ${name} not found`);
      break;
    default:
      logger.debug('This shouldnt happen');
  }
  return nodeId;
}

function addSprinkles(ast, line) {
  // separated out node id and sprinkling for now - will merge later
  const newAST = ast;
  const { nodes } = newAST.nodes[1];
  switch (line.type) {
    default:
      for (const node of nodes) {
        if (node.id === line.nodeId) {
          node.sprinkle = line.keyword;
          break;
        }
      }
      break;
    case 'assignment':
      for (const node of nodes) {
        // if (node.id === line.parentNodeId && line.keyword === 'secret') {
        //   // TODO remove this error/ change it
        //   logger.info(`Unnecessary assignment sprinkle for ${node.name}...`);
        //   if (node.sprinkle === 'secret') {
        //     logger.info(
        //       `...but the declaration has correctly been sprinkled as secret, so that's ok`,
        //     );
        //     break;
        //   } else {
        //     throw new Error(`... the declaration for ${node.name} hasn't been sprinkled!`);
        //   }
        // }
        if (
          node.nodeType === 'ExpressionStatement' &&
          node.expression.leftHandSide.id === line.nodeId
        ) {
          node.expression.leftHandSide.sprinkle = line.keyword;
          break;
        }
        if (node.nodeType === 'FunctionDefinition') {
          const fnScope = { nodes: [{}, {}] };
          fnScope.nodes[1].nodes = node.body.statements;
          addSprinkles(fnScope, line);
        }
      }
      break;
    // default:
    //   logger.info(`Not implemented`);
  }
  return ast;
}

function resprinkle(solAST, toResprinkle, options) {
  logger.info(`Creating sprinkled ast... `);

  let newAST = solAST;

  for (const line of toResprinkle) {
    // find nodeId
    switch (line.type) {
      case 'assignment':
        // TODO remove this error/ change it
        if (line.keyword === 'secret') {
          logger.info(`Warning: secret keyword used for assignment after declaration...`);
          for (const check of toResprinkle) {
            if (check.type === 'global' && check.name === line.name) {
              logger.info(
                `...but the declaration has correctly been marked as secret, so that's ok`,
              );
              line.parentNodeId = check.nodeId;
              break;
            } else if (check.type === line.type && check.name === line.name) {
              throw new Error(
                `...and the declaration hasn't been marked as secret, so the assignment can't be secret!`,
              );
            }
          }
        }
        line.nodeId = findNodeId(solAST, line.type, line.name, line.rhs);
        break;
      default:
        // same for function, constructor, and global
        line.nodeId = findNodeId(solAST, line.type, line.name, '');
    }
    // sprinkle ast
    newAST = addSprinkles(newAST, line);
  }

  const zsolASTFilePath = `${options.parseDirPath}/${options.inputFileName}.zsol_ast.json`;
  fs.writeFileSync(zsolASTFilePath, JSON.stringify(newAST, null, 4));

  return newAST;
}

export default resprinkle;
