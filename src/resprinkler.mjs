/**
Reads an input file line by line and passes each line for further processing
*/

import fs from 'fs';
import replaceIn from 'replace-in-file';
import recogniseSprinkles from './recognisers/sprinkles.mjs';
import logger from './utils/logger.mjs';

function replaceSprinkles(file, replaceArr) {
  for (const obj of replaceArr) {
    const options = {
      files: file,
      from: obj.oldline,
      to: obj.newline,
    };
    replaceIn.sync(options);
  }
}

function findNodeId(ast, type, name) {
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
      logger.debug(
        `Assignment: need to 1. warn user and 2. check the global exists and return that nodeid`,
      );
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
  const newAst = ast;
  const { nodes } = newAst.nodes[1];
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
        if (node.id === line.parentNodeId) {
          logger.info(`Unnecessary assignment sprinkle for ${node.name}...`);
          if (node.sprinkle) {
            logger.info(
              `...but the declaration has correctly been sprinkled as secret, so that's ok`,
            );
            break;
          } else {
            throw new Error(`... the declaration for ${node.name} hasn't been sprinkled!`);
          }
        }
      }
      break;
    // default:
    //   logger.info(`Not implemented`);
  }
  return ast;
}

async function resprinkle(file, toResprinkle) {
  const ast = JSON.parse(
    fs.readFileSync(file, 'utf-8', err => {
      console.log(err);
    }),
  );

  logger.info(`Creating sprinkled ast... `);

  let newAst = ast;

  for (const line of toResprinkle) {
    // find nodeId
    switch (line.type) {
      case 'assignment':
        logger.info(`Warning: secret keyword used for assignment after declaration...`);
        for (const check of toResprinkle) {
          if (check.type === 'global' && check.name === line.name) {
            logger.info(`...but the declaration has correctly been marked as secret, so that's ok`);
            line.parentNodeId = check.nodeId;
            break;
          } else if (check.type === line.type && check.name === line.name) {
            throw new Error(
              `...and the declaration hasn't been marked as secret, so the assignment can't be secret!`,
            );
          }
        }
        break;
      default:
        // same for function, constructor, and global
        line.nodeId = findNodeId(ast, line.type, line.name);
    }
    // sprinkle ast
    newAst = addSprinkles(newAst, line);
  }
  console.log(toResprinkle);

  return newAst;
}

export default resprinkle;
