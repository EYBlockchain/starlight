/* eslint-disable no-param-reassign, no-continue, no-shadow, consistent-return */

/**
 * @desc there's some 'lazy' syntax for writing Visitors succinctly. This
 * function 'explodes' that lazy syntax into a format which can be travsersed
 * by the traverser.
 * Lazy syntax: if multiple nodeTypes share the same `enter` & `exit`
 * functions, then you can write `'NodeType1|NodeType2': { enter(), exit() }`
 */
function explode(visitor) {
  if (visitor._exploded) return visitor;
  visitor._exploded = true;

  // explode piped nodeTypes
  for (const nodeType of Object.keys(visitor)) {
    const nodeTypes = nodeType.split('|');
    if (nodeTypes.length === 1) continue;

    const methods = visitor[nodeType];
    delete visitor[nodeType];

    for (const nodeType of nodeTypes) {
      visitor[nodeType] = methods;
    }
  }
  return visitor;
}

export default explode;
