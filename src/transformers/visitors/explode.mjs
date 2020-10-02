/* eslint-disable no-param-reassign, no-continue, no-shadow, consistent-return */

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
