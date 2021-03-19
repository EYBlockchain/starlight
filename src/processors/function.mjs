// @UNUSED?
/**
Process a contract function
*/
import { zokrates, currentFunction } from '../state.mjs';
import addGlobal from './global.mjs';

function processFunction(func) {
  // a function indicates a new Zokrates circuit - so start a main definition
  currentFunction.name = func.name;

  zokrates.src += `************ Circuit for ${func.name} function ***********\ndef main(@main_params) -> ():\n`;
  // functions are also a type of global so we need to add them to the Globals table
  // I'm not really sure why yet but I feel good about doing so
  addGlobal(func);
}

export default processFunction;
