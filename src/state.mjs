/**
keeps track of the compiler state
*/

export const inits = {
  assignment: false,
};

export const node = { src: '', standardFunctions: '' };
export const zokrates = { src: '', standardFunctions: '', mainParams: '' };
export const solidity = { src: '', standardFunctions: '' };

export const currentFunction = { name: undefined };
export const blockCount = { value: 0 };

export const globals = {};
