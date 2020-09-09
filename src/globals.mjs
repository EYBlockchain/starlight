/**
Table of global variables
*/

export const globals = {};

export function addGlobal(type, visibility, name) {
  globals[name] = { type: type, visibility: visibility };
}
