/**
Process a contract function
*/
import { inits, node, solidity, zokrates } from '../state.mjs';

function processFunction(func) {
  // a function indicates a new Zokrates circuit - so start a main definition
  const mainParams = {}; // placeholder for now
  mainParams.toString = () => '';
  zokrates.src += `************ Circuit for ${func.name} function ***********
def main(@main_params) -> ():
  `;
}

export default processFunction;
