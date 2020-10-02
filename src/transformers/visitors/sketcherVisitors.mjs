/* eslint-disable no-param-reassign */

import logger from '../../utils/logger.mjs';
import { getNodeContext, getSubTreeNames } from '../../types/types.mjs';
import traverse from '../traverser.mjs';
import explode from './explode.mjs';

// a closure for assigning a variable to an object's property by reference
function property(object, prop) {
  return {
    get value() {
      return object[prop];
    },
    set value(val) {
      object[prop] = val;
    },
  };
}

export function printSketch(sketch) {
  console.log('****************************************************');
  sketch.forEach(row => row.forEach(line => console.log(line)));
  console.log('****************************************************');
}

export const shiftNodePositionsVisitor = {
  'PragmaDirective|ContractDefinition|VariableDeclaration|VariableDeclarationStatement|FunctionDefinition|ParameterList|Block|ExpressionStatement|Assignment|BinaryOperation|Identifier|Literal|ElementaryTypeName': {
    enter(node, parent, state) {
      ++state.depth;

      if (node.startPos === undefined && node.endPos === undefined) {
        return;
      }
      node.startPos += state.shift;
      node.endPos += state.shift;
      state.lineEndAtDepth[state.depth] = Math.max(
        state.lineEndAtDepth[state.depth] || 0,
        node.endPos + 1,
      );
    },

    exit(node, parent, state) {
      --state.depth;
    },
  },
};

export const addNodePositionsVisitor = {
  SourceUnit: {
    enter(node, parent, state) {
      // initialise - SourceUnit is the top of the tree
      state.depth = 0;
      state.nodeCount = 0;

      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = `TOP`;
      const { length } = nodeString;
      // const startPos = state.nextLeafPos;
      // const endPos = startPos + length; // exclusive
      // state.nextLeafPos = endPos + 1; // '+1' to add a space

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        nodes: [],
      };

      node._context = newNode.nodes;
      Object.assign(parent._context, newNode);
    },

    exit(node, parent, state) {
      const newChildNodes = node._context;

      const { length } = parent._context;
      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      Object.assign(parent._context, { startPos, endPos, branchStartPos, branchEndPos });

      --state.depth;
    },
  },

  PragmaDirective: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = node.nodeType;
      const { length } = nodeString;
      const startPos = state.nextLeafPos;
      const endPos = startPos + length; // exclusive
      state.nextLeafPos = endPos + 1; // '+1' to add a space

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        startPos,
        endPos,
        isLeaf: true,
      };
      // node._context = // no context needed, because this is a leaf, so we won't be recursing any further.
      parent._context.push(newNode);
    },

    exit(node, parent, state) {
      --state.depth;
    },
  },

  ContractDefinition: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = `contract: ${node.name}`;
      const { length } = nodeString;
      // const startPos = state.nextLeafPos;
      // const endPos = startPos + length; // exclusive
      // state.nextLeafPos = endPos + 1; // '+1' to add a space

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        nodes: [],
      };

      node._context = newNode.nodes;
      parent._context.push(newNode);
    },

    exit(node, parent, state) {
      const newChildNodes = node._context;

      const nodeContext = getNodeContext(node, parent);
      const { index } = nodeContext;

      const { length } = parent._context[index];

      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ...parent._context[index],
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      parent._context[index] = newNode;
      --state.depth;
    },
  },

  FunctionDefinition: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = `function: ${node.name}`;
      const { length } = nodeString;

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        parameters: {},
        returnParameters: {},
        body: {},
      };
      node._context = newNode;
      parent._context.push(newNode);
    },

    exit(node, parent, state) {
      const newChildNodes = [
        node._context.parameters,
        node._context.returnParameters,
        node._context.body,
      ];

      const index = parent._context.findIndex(child => child.nodeCount === node._context.nodeCount);
      const { length } = parent._context[index];
      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ...parent._context[index],
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      parent._context[index] = newNode;
      --state.depth;
    },
  },

  ParameterList: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = nodeType;
      const { length } = nodeString;

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        parameters: [],
      };
      node._context = newNode.parameters;
      const { containerName } = getNodeContext(node, parent);
      parent._context[containerName] = newNode;
    },

    exit(node, parent, state) {
      const newChildNodes = node._context;

      const nodeContext = getNodeContext(node, parent);
      const { containerName } = nodeContext;

      const { length } = parent._context[containerName];

      let startPos;
      let branchStartPos;
      let branchEndPos;
      if (newChildNodes.length === 0) {
        startPos = state.lineEndAtDepth[state.depth] + 1;
        parent._context[containerName].isLeaf = true;
      } else {
        // startPos = (a + b)/2 - node.length/2
        const a = newChildNodes[0].startPos;
        const b = newChildNodes[newChildNodes.length - 1].endPos;
        branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
        branchEndPos = Math.floor(
          newChildNodes[newChildNodes.length - 1].endPos -
            newChildNodes[newChildNodes.length - 1].length / 2,
        );
        startPos = Math.floor((a + b) / 2 - length / 2);

        if (startPos < state.lineEndAtDepth[state.depth]) {
          state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
          // shift right
          node._context.forEach(subNode =>
            traverse(subNode, null, explode(shiftNodePositionsVisitor), state),
          );
          startPos += state.shift;
          branchEndPos += state.shift;
        }
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ...parent._context[containerName],
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      parent._context[containerName] = newNode;
      --state.depth;
    },
  },

  Block: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = nodeType;
      const { length } = nodeString;

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        statements: [],
      };
      node._context = newNode.statements;
      parent._context.body = newNode;
    },

    exit(node, parent, state) {
      const newChildNodes = node._context;

      // if (newChildNodes.length === 0) {
      //   delete parent._context.body.statements;
      //   return;
      // }

      const { length } = parent._context.body;

      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ...parent._context.body,
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      parent._context.body = newNode;
      --state.depth;
    },
  },

  // THIS ONE
  VariableDeclarationStatement: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = ':=';
      const { length } = nodeString;

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        declarations: [],
        initialValue: {},
      };
      node._context = newNode;
      parent._context.push(newNode);
    },

    exit(node, parent, state) {
      const newChildNodes = [...node._context.declarations, node._context.initialValue];

      const index = parent._context.findIndex(child => child.nodeCount === node._context.nodeCount);

      const { length } = parent._context[index];

      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ...node._context,
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      parent._context[index] = newNode;
      --state.depth;
    },
  },

  // THIS ONE
  BinaryOperation: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = node.operator;
      const { length } = nodeString;

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        leftExpression: {},
        rightExpression: {},
      };
      node._context = newNode;
      const { containerName } = getNodeContext(node, parent);
      parent._context[containerName] = newNode;
    },

    exit(node, parent, state) {
      const newChildNodes = [node._context.leftExpression, node._context.rightExpression];

      const { containerName } = getNodeContext(node, parent);

      const { length } = parent._context[containerName];

      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ...parent._context[containerName],
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      parent._context[containerName] = newNode;
      --state.depth;
    },
  },

  // THIS ONE
  Assignment: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = node.operator;
      const { length } = nodeString;

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        leftHandSide: {},
        rightHandSide: {},
      };
      node._context = newNode;
      parent._context.expression = newNode;
    },

    exit(node, parent, state) {
      const newChildNodes = [node._context.leftHandSide, node._context.rightHandSide];

      const { length } = parent._context.expression;

      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ...parent._context.expression,
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      parent._context.expression = newNode;
      --state.depth;
    },
  },

  ExpressionStatement: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = nodeType;
      const { length } = nodeString;

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        expression: {},
      };
      node._context = newNode;
      parent._context.push(newNode);
    },

    exit(node, parent, state) {
      const newChildNodes = [node._context.expression];

      const index = parent._context.findIndex(child => child.nodeCount === node._context.nodeCount);

      const { length } = parent._context[index];

      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ...parent._context[index],
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      parent._context[index] = newNode;
      --state.depth;
    },
  },

  VariableDeclaration: {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = node.name;
      const { length } = nodeString;

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        isLeaf: false,
        typeName: {},
      };
      node._context = newNode;
      if (Array.isArray(parent._context)) {
        parent._context.push(newNode);
      } else {
        const { containerName } = getNodeContext(node, parent);
        parent._context[containerName].push(newNode);
      }
    },

    exit(node, parent, state) {
      const newChildNodes = [node._context.typeName];

      let _newNode;
      if (Array.isArray(parent._context)) {
        const index = parent._context.findIndex(
          child => child.nodeCount === node._context.nodeCount,
        );
        _newNode = parent._context[index];
      } else {
        const { containerName } = getNodeContext(node, parent);
        const index = parent._context[containerName].findIndex(
          child => child.nodeCount === node._context.nodeCount,
        );
        _newNode = parent._context[containerName][index];
      }

      const { length } = _newNode;

      // startPos = (a + b)/2 - node.length/2
      const a = newChildNodes[0].startPos;
      const b = newChildNodes[newChildNodes.length - 1].endPos;
      const branchStartPos = Math.floor(newChildNodes[0].startPos + newChildNodes[0].length / 2);
      let branchEndPos = Math.floor(
        newChildNodes[newChildNodes.length - 1].endPos -
          newChildNodes[newChildNodes.length - 1].length / 2,
      );
      let startPos = Math.floor((a + b) / 2 - length / 2);

      if (startPos < state.lineEndAtDepth[state.depth]) {
        state.shift = state.lineEndAtDepth[state.depth] - startPos + 1;
        // shift right
        traverse(node._context, null, explode(shiftNodePositionsVisitor), state);
        startPos += state.shift;
        branchEndPos += state.shift;
      }

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      const newNode = {
        ..._newNode,
        startPos,
        endPos,
        branchStartPos,
        branchEndPos,
      };

      if (Array.isArray(parent._context)) {
        const index = parent._context.findIndex(
          child => child.nodeCount === node._context.nodeCount,
        );
        parent._context[index] = newNode;
      } else {
        const { containerName } = getNodeContext(node, parent);
        const index = parent._context[containerName].findIndex(
          child => child.nodeCount === node._context.nodeCount,
        );
        parent._context[containerName][index] = newNode;
      }
      --state.depth;
    },
  },

  'Identifier|Literal|ElementaryTypeName': {
    enter(node, parent, state) {
      ++state.depth;
      ++state.nodeCount;
      const { nodeType } = node;
      const { nodeCount } = state;
      const nodeString = node.name || node.value;
      const { length } = nodeString;
      const startPos = state.nextLeafPos;

      const endPos = startPos + length; // exclusive
      state.lineEndAtDepth[state.depth] = endPos + 1;

      state.nextLeafPos = endPos + 1; // '+1' to add a space

      const newNode = {
        nodeType,
        nodeCount,
        nodeString,
        length,
        startPos,
        endPos,
        isLeaf: true,
      };

      // node._context = // no context needed, because this is a leaf, so we won't be recursing any further.
      const { containerName } = getNodeContext(node, parent);
      parent._context[containerName] = newNode;
    },

    exit(node, parent, state) {
      --state.depth;
    },
  },
};

export const createSketchVisitor = {
  SourceUnit: {
    enter(node, parent, state) {
      const { depth, lineEndAtDepth, sketch } = state;
      let lineEnd = lineEndAtDepth[depth] || 0;

      // printSketch(sketch);

      if (node.startPos < lineEnd)
        throw new Error(`startPos ${node.startPos} < lineEnd ${lineEnd}`);

      const mid = Math.floor((node.startPos + node.endPos) / 2);
      sketch[depth] = sketch[depth] || Array(3).fill('');
      sketch[depth][1] = `${sketch[depth][1].padEnd(mid, ' ')}|`;

      sketch[depth][0] = `${sketch[depth][0].padEnd(node.startPos, ' ')}${node.nodeString}`;

      sketch[depth][2] = `${sketch[depth][2]
        .padEnd(node.branchStartPos, ' ')
        .padEnd(node.branchEndPos, '_')}`;

      lineEnd = node.endPos;

      // printSketch(sketch);

      state.depth = depth;
      state.lineEndAtDepth = lineEnd;
      state.sketch = sketch;
    },

    exit(node, parent, state) {
    },
  },

  'PragmaDirective|ContractDefinition|VariableDeclaration|VariableDeclarationStatement|FunctionDefinition|ParameterList|Block|ExpressionStatement|Assignment|BinaryOperation|Identifier|Literal|ElementaryTypeName': {
    enter(node, parent, state) {
      let { depth, lineEndAtDepth, sketch } = state;
      ++depth;
      let lineEnd = lineEndAtDepth[depth] || 0;

      // printSketch(sketch);

      if (node.startPos < lineEnd) throw new Error(`startPos ${node.startPos} < lineEnd ${lineEnd}`);

      const mid = Math.floor((node.startPos + node.endPos) / 2);
      sketch[depth] = sketch[depth] || Array(4).fill('');
      sketch[depth][0] = `${sketch[depth][0].padEnd(mid, ' ')}|`;

      if (!node.isLeaf) sketch[depth][2] = `${sketch[depth][2].padEnd(mid, ' ')}|`;

      sketch[depth][1] = `${sketch[depth][1].padEnd(node.startPos, ' ')}${node.nodeString}`;

      sketch[depth][3] = `${sketch[depth][3]
        .padEnd(node.branchStartPos, ' ')
        .padEnd(node.branchEndPos, '_')}`;

      lineEnd = node.endPos;

      // printSketch(sketch);

      state.depth = depth;
      state.lineEndAtDepth = lineEnd;
      state.sketch = sketch;
    },

    exit(node, parent, state) {
      --state.depth;
    },
  },
};
