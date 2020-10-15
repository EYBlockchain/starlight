import { BUILDER_KEYS } from './solidity-types.mjs';

// IS THIS EVEN NEEDED??? if the user is required to know the exact ordering of values to pass to the `args` param, they might as well construct the object entirely...

// args is an array of values/objects/arrays; where each arg will be assigned to the next value of the BUILDER_KEYS list.
export default function builder(type, ...args): Object {
  const keys = BUILDER_KEYS[type];
  const countArgs = args.length;
  if (countArgs > keys.length) {
    throw new Error(
      `${type}: Too many arguments passed. Received ${countArgs} but can receive no more than ${keys.length}`,
    );
  }

  const node = { type };

  let i = 0;
  keys.forEach(key => {
    let arg;
    if (i < countArgs) arg = args[i];

    node[key] = arg;
    i++;
  });

  return node;
}
