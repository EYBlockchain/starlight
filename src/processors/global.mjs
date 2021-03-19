import { globals } from '../state.mjs';

/**
 * @param {Object} global = { type, visibility, name }; details of a state variable declaration
 */
function addGlobal(global) {
  globals[global.name] = global;
}

export default addGlobal;
