/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

import cloneDeep from 'lodash.clonedeep';
import logger from '../../utils/logger.mjs';
import { traverse, traverseNodesFast } from '../../traverse/traverse.mjs';

export default {
  SourceUnit: {
    enter(path, state) {},

    exit(path, state) {},
  },

  PragmaDirective: {
    enter(path, state) {},
    exit(path, state) {},
  },

  ContractDefinition: {
    enter(path, state) {},

    exit(path, state) {},
  },

  FunctionDefinition: {
    enter(path, state) {
      const { node } = path;
      for (const line of state) {
        switch (line.type) {
          case 'function':
            if (line.nodeId) break;
            if (node.kind === 'function' && node.name === line.name) line.nodeId = node.id;
            break;
          case 'constructor':
            if (line.nodeId) break;
            if (node.kind === 'constructor' && node.name === line.name) line.nodeId = node.id;
            break;
          default:
            break;
          // line.nodeId = findNodeId(solAST, line);
        }
        if (line.nodeId === node.id) {
          switch (line.keyword) {
            default:
              break;
            case 'secret':
              node.isSecret = true;
              break;
            // case 'known':
            //   node.isKnown = true;
            //   break;
            // case 'unknown':
            //   node.isUnknown = true;
            //   break;
          }
        }
      }
    },

    exit(path, state) {},
  },

  ParameterList: {
    enter(path, state) {
      const { node } = path;
      const functionName = path.parent.name;
      for (const line of state) {
        switch (line.type) {
          case 'param':
            if (line.nodeId) break;
            for (const param of node.parameters) {
              if (param.name === line.name && line.oldline.includes(functionName)) {
                line.nodeId = param.id;
                if (line.keyword === 'secret') {
                  param.isSecret = true;
                } else {
                  throw new Error(`Parameters can't be marked as known/unknown`);
                }
              }
            }
            break;
          default:
            break;
        }
      }
    },

    exit(path) {},
  },

  Block: {
    enter(path) {},

    exit(path) {},
  },

  VariableDeclarationStatement: {
    enter(path, state) {
      const { node } = path;
      for (const line of state) {
        switch (line.type) {
          case 'global':
            if (line.nodeId) break;
            if (node.declarations[0].name === line.name) line.nodeId = node.declarations[0].id;
            break;
          default:
            break;
        }
        if (line.nodeId === node.declarations[0].id) {
          switch (line.keyword) {
            default:
              break;
            case 'secret':
              node.declarations[0].isSecret = true;
              break;
            case 'known':
              node.declarations[0].isKnown = true;
              break;
            case 'unknown':
              node.declarations[0].isUnknown = true;
              break;
          }
        }
        console.log(state);
      }
    },

    exit(path) {},
  },

  BinaryOperation: {
    enter(path) {},

    exit(path) {},
  },

  Assignment: {
    enter(path, state) {
      const operators = ['+', '-', '*', '/', '%'];
      const eqOperators = [' = ', '+= ', '-= '];
      let op;
      let eqop;
      const { node } = path;
      for (const line of state) {
        switch (line.type) {
          case 'assignment':
            if (line.nodeId) break;
            for (const operator of operators) {
              if (line.rhs.includes(operator)) {
                op = operator;
                break;
              }
            }
            for (const eqOperator of eqOperators) {
              if (line.newline.includes(eqOperator)) {
                // TODO more than one operator e.g. a = b + 7 - c;
                eqop = eqOperator.trim();
                break;
              }
            }
            // we have an assignment we still need to redecorate:
            if (line.name === node.leftHandSide.name) {
              // we have an identifier with name = name of assigned secret var
              // check: operator, rhs type
              switch (node.rightHandSide.nodeType) {
                case 'Identifier':
                  if (line.rhs.replace(';', '') !== node.rightHandSide.name) {
                    break;
                  } else if (node.operator === eqop) {
                    line.nodeId = node.leftHandSide.id;
                    break;
                  }
                  break;
                case 'Literal':
                  if (!line.rhs.includes(node.rightHandSide.value)) {
                    break;
                  } else {
                    line.nodeId = node.leftHandSide.id;
                    break;
                  }
                case 'BinaryOperation':
                  if (!op) break;
                  if (op && node.rightHandSide.operator.includes(op)) {
                    if (
                      node.rightHandSide.rightExpression.name &&
                      line.rhs.includes(node.rightHandSide.rightExpression.name) &&
                      line.rhs.includes(node.rightHandSide.leftExpression.name)
                    ) {
                      line.nodeId = node.leftHandSide.id;
                      break;
                    }
                    if (
                      node.rightHandSide.rightExpression.name &&
                      line.rhs.includes(node.rightHandSide.rightExpression.value) &&
                      line.rhs.includes(node.rightHandSide.leftExpression.name)
                    ) {
                      line.nodeId = node.leftHandSide.id;
                      break;
                    }
                    break;
                  }
                  break;
                default:
                  break;
              }
            } else if (node.leftHandSide.nodeType === 'IndexAccess') {
              const key =
                node.leftHandSide.indexExpression.expression || node.leftHandSide.indexExpression;
              if (!line.name.includes(node.leftHandSide.baseExpression.name)) break;
              if (!line.name.includes(key.name)) break;
              // copied and pasted from above -- TODO not repeat code!
              // ---
              switch (node.rightHandSide.nodeType) {
                case 'Identifier':
                  if (line.rhs.replace(';', '') !== node.rightHandSide.name) {
                    break;
                  } else if (node.operator === eqop) {
                    line.nodeId = node.leftHandSide.id;
                    break;
                  }
                  break;
                case 'Literal':
                  if (!line.rhs.includes(node.rightHandSide.value)) {
                    break;
                  } else {
                    line.nodeId = node.leftHandSide.id;
                    break;
                  }
                case 'BinaryOperation':
                  if (!op) break;
                  if (op && node.rightHandSide.operator.includes(op)) {
                    if (
                      line.rhs.includes(node.rightHandSide.rightExpression.name) &&
                      line.rhs.includes(node.rightHandSide.leftExpression.baseExpression.name) &&
                      (line.rhs.includes(node.rightHandSide.leftExpression.indexExpression.name) ||
                        line.rhs.includes(
                          node.rightHandSide.leftExpression.indexExpression.expression.name,
                        ))
                    ) {
                      line.nodeId = node.leftHandSide.id;
                      break;
                    }
                    if (
                      node.rightHandSide.leftExpression.baseExpression &&
                      line.rhs.includes(node.rightHandSide.rightExpression.value) &&
                      line.rhs.includes(node.rightHandSide.leftExpression.baseExpression.name) &&
                      line.rhs.includes(node.rightHandSide.leftExpression.indexExpression.name)
                    ) {
                      line.nodeId = node.leftHandSide.id;
                      break;
                    }
                    break;
                  }
                  break;
                default:
                  break;
              }
              // ----
            }
            // error checking:
            if (line.nodeId === node.leftHandSide.id) {
              switch (line.keyword) {
                default:
                  break;
                case 'secret':
                  logger.warn(`Warning: secret keyword used for assignment after declaration...`);
                  for (const check of state) {
                    if (check.type === 'global' && check.name === line.name) {
                      logger.warn(
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
                  break;
                case 'known':
                  node.leftHandSide.isKnown = true;
                  break;
                case 'unknown':
                  node.leftHandSide.isUnknown = true;
                  break;
              }
            }

            break;
          default:
            break;
        }
      }
    },

    exit(path, state) {},
  },

  ExpressionStatement: {
    enter(path, state) {},

    exit(node, parent) {},
  },

  VariableDeclaration: {
    enter(path, state) {
      const { node } = path;
      for (const line of state) {
        switch (line.type) {
          case 'global':
            if (line.nodeId) break;
            if (node.name === line.name) line.nodeId = node.id;
            break;
          default:
            break;
        }
        if (line.nodeId === node.id) {
          switch (line.keyword) {
            default:
              break;
            case 'secret':
              node.isSecret = true;
              break;
            // case 'known':
            //   node.isKnown = true;
            //   break;
            // case 'unknown':
            //   node.isUnknown = true;
            //   break;
          }
        }
      }
    },

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
