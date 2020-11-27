/**
Reads an input file line by line and passes each line for further processing
*/

import fs from 'fs';
import logger from './utils/logger.mjs';

const operators = ['+', '-', '*', '/', '%'];
const eqOperators = [' = ', '+= ', '-= '];

function findNodeId(ast, line) {
  const { type, name, rhs, newline } = line;
  const { nodes } = ast.nodes[1];
  let nodeId;
  let op;
  let eqop;
  switch (type) {
    case 'global':
      for (const node of nodes) {
        if (node.nodeType === 'VariableDeclaration' && node.name === `${name}`) {
          nodeId = node.id;
          break;
        } else if (
          node.nodeType === 'VariableDeclarationStatement' &&
          node.declarations[0].name === `${name}`
        ) {
          nodeId = node.declarations[0].id;
          break;
        }
      }
      if (!nodeId) logger.debug(`Node Id for ${type} ${name} not found`);
      break;
    case 'assignment':
      // TODO functionCalls, MemberAccess, IndexAccess
      for (const operator of operators) {
        if (rhs.includes(operator)) {
          op = operator;
          break;
        }
      }
      for (const eqOperator of eqOperators) {
        if (newline.includes(eqOperator)) {
          eqop = eqOperator.trim();
          break;
        }
      }
      for (const node of nodes) {
        if (node.nodeType === 'FunctionDefinition') {
          const fnScope = { nodes: [{}, {}] };
          fnScope.nodes[1].nodes = node.body.statements;
          nodeId = findNodeId(fnScope, line);
        }
        if (nodeId) break;
        if (
          node.nodeType === 'ExpressionStatement' &&
          node.expression.nodeType === 'Assignment' &&
          node.expression.leftHandSide.name === name
        ) {
          // TODO change how this works so we can accurately match assignments - may get the wrong id here for anything but identifiers and lierals
          if (node.expression.rightHandSide.nodeType === 'Identifier') {
            if (rhs.replace(';', '') !== node.expression.rightHandSide.name) {
              continue;
            } else if (node.expression.operator === eqop) {
              nodeId = node.expression.leftHandSide.id;
              break;
            }
            if (nodeId) break;
          }
          if (node.expression.rightHandSide.nodeType === 'Literal') {
            if (!rhs.includes(node.expression.rightHandSide.value)) {
              continue;
            } else {
              nodeId = node.expression.leftHandSide.id;
              break;
            }
          }
          if (node.expression.rightHandSide.nodeType === 'BinaryOperation' && !op) continue;
          if (
            node.expression.rightHandSide.nodeType === 'BinaryOperation' &&
            op &&
            node.expression.rightHandSide.operator.includes(op)
          ) {
            nodeId = node.expression.leftHandSide.id;
            break;
          }
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

function addDecorators(ast, line) {
  // separated out node id and sprinkling for now - will merge later
  const newAST = ast;
  const { nodes } = newAST.nodes[1];
  switch (line.type) {
    default:
      for (const node of nodes) {
        if (node.id === line.nodeId) {
          switch (line.keyword) {
            case 'secret':
              node.isSecret = true;
              break;
            case 'unknown':
              node.isUnknown = true;
              break;
            case 'known':
              node.isKnown = true;
              break;
            default:
          }
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
        if (node.nodeType === 'ExpressionStatement') {
          if (node.expression.leftHandSide.id === line.nodeId) {
            switch (line.keyword) {
              case 'secret':
                node.expression.leftHandSide.isSecret = true;
                break;
              case 'unknown':
                node.expression.leftHandSide.isUnknown = true;
                break;
              case 'known':
                node.expression.leftHandSide.isKnown = true;
                break;
              default:
            }
            break;
          }
        }
        if (node.nodeType === 'FunctionDefinition') {
          const fnScope = { nodes: [{}, {}] };
          fnScope.nodes[1].nodes = node.body.statements;
          addDecorators(fnScope, line);
        }
      }
      break;
    // default:
    //   logger.info(`Not implemented`);
  }
  return ast;
}

function redecorate(solAST, toRedecorate, options) {
  logger.info(`Creating decorated ast... `);

  let newAST = solAST;

  for (const line of toRedecorate) {
    // find nodeId
    switch (line.type) {
      case 'assignment':
        // TODO remove this error/ change it
        if (line.keyword === 'secret') {
          logger.info(`Warning: secret keyword used for assignment after declaration...`);
          for (const check of toRedecorate) {
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
        line.nodeId = findNodeId(solAST, line);
        break;
      default:
        // same for function, constructor, and global
        line.nodeId = findNodeId(solAST, line);
    }
    // sprinkle ast
    newAST = addDecorators(newAST, line);
  }

  const zsolASTFilePath = `${options.parseDirPath}/${options.inputFileName}.zsol_ast.json`;
  fs.writeFileSync(zsolASTFilePath, JSON.stringify(newAST, null, 4));

  return newAST;
}

export default redecorate;
