import { GN } from 'general-number';
import {
  SumType,
  curry,
  mapTree,
  keccakConcatHash,
  reduceTree,
  blackbird,
  toBinArray,
} from './utils.mjs';
import { hlt } from './hash-lookup.mjs';

const TRUNC_LENGTH = 256; // Just for testing so we don't make 256 deep trees.

const Branch = (leftTree, rightTree) => ({
  tag: 'branch',
  left: leftTree,
  right: rightTree,
});
const Leaf = val => ({
  tag: 'leaf',
  val: val,
});

const SMT = SumType([Branch, Leaf], () => {
  throw new TypeError('Invalid data structure provided');
});

export const Empty = SMT(hlt[0]);

// CORE TREE FUNCTIONALITY

// Gets the keccak hash of a tree (or subtree)
export const getHash = tree => reduceTree(keccakConcatHash, tree);

// This is a helper function to insertLeaf that calls the recursion
const _insertLeaf = (val, tree, binArr) => {
  if (binArr.length > 0) {
    switch (tree.tag) {
      case 'branch': // Recursively enter developed subtree
        return binArr[0] === '0'
          ? Branch(_insertLeaf(val, tree.left, binArr.slice(1)), tree.right)
          : Branch(tree.left, _insertLeaf(val, tree.right, binArr.slice(1)));

      case 'leaf': // Open undeveloped subtree
        return binArr[0] === '0'
          ? Branch(
              _insertLeaf(val, Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]), binArr.slice(1)),
              Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]),
            )
          : Branch(
              Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]),
              _insertLeaf(val, Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]), binArr.slice(1)),
            );

      default: {
        return tree;
      }
    }
  } else return Leaf(val);
};

// This inserts a value into the tree as a leaf
export const insertLeaf = (val, tree) => {
  const binArr = toBinArray(new GN(val, 'hex')).slice(0, TRUNC_LENGTH);
  const padBinArr = Array(TRUNC_LENGTH - binArr.length)
    .fill('0')
    .concat(...binArr);
  return _insertLeaf(val, tree, padBinArr);
};

// This is a helper function for checkMembership
const _checkMembership = (binArr, element, tree, acc) => {
  switch (tree.tag) {
    case 'branch':
      return binArr[0] === '0'
        ? _checkMembership(
            binArr.slice(1),
            element,
            tree.left,
            [{ dir: 'right', hash: getHash(tree.right) }].concat(acc),
          )
        : _checkMembership(
            binArr.slice(1),
            element,
            tree.right,
            [{ dir: 'left', hash: getHash(tree.left) }].concat(acc),
          );
    case 'leaf':
      return tree.val !== element
        ? {
            isMember: false,
            path: binArr
              .map((bit, idx) => {
                return bit === '0'
                  ? { dir: 'right', hash: hlt[TRUNC_LENGTH - (binArr.length - idx - 1)] }
                  : { dir: 'left', hash: hlt[TRUNC_LENGTH - (binArr.length - idx - 1)] };
              })
              .reverse()
              .concat(acc),
          }
        : { isMember: true, path: acc };
    default:
      return tree;
  }
};

export const compressDirs = proof => {
  const dirs = proof.path.map(p => (p.dir === 'right' ? '0' : '1'));
  const binaryDirs = new GN(dirs.join(''), 'binary');
  return binaryDirs.hex(32);
};

// This checks for both set and non-set membership
export const checkMembership = (element, tree) => {
  const binArr = toBinArray(new GN(element)).slice(0, TRUNC_LENGTH);
  const padBinArr = Array(TRUNC_LENGTH - binArr.length)
    .fill('0')
    .concat(...binArr);
  return _checkMembership(padBinArr, element, tree, []);
};

export const checkProof = (value, proof, root) => {
  const recreatedRoot = proof.path.reduce(
    (acc, curr) =>
      curr.dir === 'right' ? keccakConcatHash(acc, curr.hash) : keccakConcatHash(curr.hash, acc),
    value,
  );
  return recreatedRoot === getHash(root);
};

/* eslint-disable */
export const scanl = (xs, f, init) => xs.map(
    (x => e => (x = f(e, x)) ) // Curried callbackFn(intermediateState, nextElement) and updates intermediateState
    (init)
  );
/* eslint-enable */

/*
  Helper Functions
  These are useful functions to operate over the SMT.
  They are built up functionally using the generic map and reduce function found in utils.
  Key functionality:
  1) compose(a)(b): f(g(x)) ==> (f ∘ g) x, used to compose two function of 1 input
  2) blackbird: (∘) ∘ (∘), composition of compositions, used to compose two functions where the first takes 2 inputs
*/

// Currying turns f(a,b) -> f(a)(b) which helps with function chaining
const curriedReduce = curry(reduceTree);
const curriedMap = curry(mapTree);

const sum = (a, b) => a + b;
// Identifies if a leaf val is an actual insert value or a value from the hash lookup table
const isRealLeaf = leaf => !hlt.includes(leaf);

export const getDeepest = (depth, tree) => {
  switch (tree.tag) {
    case 'branch':
      return Math.max(getDeepest(depth + 1, tree.left), getDeepest(depth + 1, tree.right));
    default:
      return depth;
  }
};
// This counts only leaves that have been inserted
export const countLeaves = tree => blackbird(curriedReduce(sum))(curriedMap)(isRealLeaf)(tree);
// This counts all leaves that have been inserted
export const countLeavesAll = tree => blackbird(curriedReduce(sum))(curriedMap)(() => 1)(tree);

// This converts only inserted leaves into an array
export const toArray = tree =>
  blackbird(curriedReduce((a, b) => [].concat([a, b]).flat()))(curriedMap)(isRealLeaf)(tree);
// This converts all leaves into an array
export const toArrayAll = tree => reduceTree((a, b) => [].concat([a, b]).flat(), tree);
