import { getVisitableKeys } from '../types/solidity-types.mjs';

/**
 * Fast traversal function for quick searching of a subtree
 */
export default function traverseFast(node, enter, state = {}, scope = {}, stop = false) {
  if (!node) return;

  const keys = getVisitableKeys(node.nodeType);
  if (!keys) return;

  enter(node, state);

  for (const key of keys) {
    if (Array.isArray(node[key])) {
      const subNodes = node[key];
      for (const subNode of subNodes) {
        traverseFast(subNode, enter, state);
      }
    } else {
      const subNode = node[key];
      traverseFast(subNode, enter, state);
    }
  }
}
