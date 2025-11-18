/* eslint-disable no-param-reassign, no-continue */

import fs from 'fs';
import {
  traverseNodesFast,
  traverseNodesFastVisitor,
} from '../traverse/traverse.js';
import logger from '../utils/logger.js';
import { SyntaxTypeError, SyntaxError } from '../error/errors.js';
import explode from '../transformers/visitors/explode.js';
import redecorateVisitor from '../transformers/visitors/redecorateVisitor.js';

export class ToRedecorate {
  decorator: string;
  charStart: number;
  added?: boolean;
  perParameters?: Array<{type: string, name: string}>;
  perFunctionParam?: boolean;
  paramType?: string;
  paramName?: string;
}

const errorCheckVisitor = (thisPath: any, decoratorObj: any) => {
  // skip if node doesn't have src property
  if (!thisPath.node || !thisPath.node.src) return;
  // extract the char number
  const srcStart = thisPath.node.src.split(':')[0];
  // if it matches the one we removed, throw error
  if (decoratorObj.charStart === Number(srcStart)) {
    throw new SyntaxTypeError(thisPath.node, decoratorObj.decorator);
  }
};

/**
 * Inspired by the Transformer
 * https://github.com/jamiebuilds/the-super-tiny-compiler
 */

function transformation1(oldAST: any, toRedecorate: ToRedecorate[]) {
  // HACK: ordinarily the 2nd parameter `state` is an object. toRedecorate is an array (special kind of object). Not ideal, but it works.
  traverseNodesFastVisitor(oldAST, explode(redecorateVisitor), toRedecorate);

  // Handle per(...) mapping decorators that weren't matched by the visitor
  // This can happen when the charStart doesn't match the src property
  for (const decorator of toRedecorate) {
    if (decorator.added || decorator.decorator !== 'per' || decorator.perFunctionParam) continue;

    // Handle per(...) mapping decorators
    // Try to find a VariableDeclaration node that matches
    const findPerNode = (node: any): any => {
      if (node && node.nodeType === 'VariableDeclaration' && node.src && node.stateVariable) {
        const srcStart = node.src.split(':')[0];
        if (decorator.charStart === Number(srcStart)) {
          return node;
        }
      }
      if (node && typeof node === 'object') {
        for (const key in node) {
          if (Array.isArray(node[key])) {
            for (const item of node[key]) {
              const result = findPerNode(item);
              if (result) return result;
            }
          } else if (typeof node[key] === 'object') {
            const result = findPerNode(node[key]);
            if (result) return result;
          }
        }
      }
      return null;
    };

    const perNode = findPerNode(oldAST);
    if (perNode) {
      perNode.perParameters = decorator.perParameters || [];
      decorator.added = true;
    }
  }

  // Handle per function parameters by finding the parameter nodes and setting isPer flag
  // We need to track which parameters have been marked to avoid marking the same parameter twice
  const markedParams = new Set<string>();

  for (const decorator of toRedecorate) {
    if (!decorator.perFunctionParam || !decorator.paramName) continue;

    // Find all function definitions and their parameters
    const findAndMarkPerParams = (node: any): void => {
      if (node && node.nodeType === 'FunctionDefinition' && node.parameters && node.parameters.parameters) {
        // Look for the parameter with the matching name in this function
        for (const param of node.parameters.parameters) {
          if (param.nodeType === 'VariableDeclaration' && param.name === decorator.paramName && !param.stateVariable) {
            // Create a unique key for this parameter
            const paramKey = `${node.id}_${param.id}`;
            if (!markedParams.has(paramKey)) {
              param.isPer = true;
              markedParams.add(paramKey);
              return; // Found and marked, move to next decorator
            }
          }
        }
      }

      if (node && typeof node === 'object') {
        for (const key in node) {
          if (Array.isArray(node[key])) {
            for (const item of node[key]) {
              findAndMarkPerParams(item);
            }
          } else if (typeof node[key] === 'object') {
            findAndMarkPerParams(node[key]);
          }
        }
      }
    };

    findAndMarkPerParams(oldAST);
  }

  // we check for decorators we couldn't re-add
  for (const decorator of toRedecorate) {
    if (decorator.added) continue;
    traverseNodesFast(oldAST, errorCheckVisitor, decorator);
    throw new SyntaxError(
      `We couldn't find where ${decorator.decorator} should be re-added (char number ${decorator.charStart}). Do all decorators precede a variable name?`,
    );
  }
  // At the end of our transformer function we'll return the new ast that we
  // just created.
  return oldAST;
}

// A transformer function which will accept an ast.
export default function redecorate(ast: any, toRedecorate: any, options: any) {
  logger.verbose(`Creating decorated ast... `);
  const newAST = transformation1(ast, toRedecorate);

  const zolASTFilePath = `${options.parseDirPath}/${options.inputFileName}.zol_ast.json`;
  fs.writeFileSync(zolASTFilePath, JSON.stringify(newAST, null, 4));
  return JSON.parse(JSON.stringify(newAST, null, 4));
}
