import { globals } from '../state.mjs';

function addGlobal(global) {
  globals[global.name] = global;
}

export default addGlobal;
