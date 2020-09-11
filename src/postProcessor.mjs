/**
clean up after the compilation
*/

import { zokrates, node, solidity } from './state.mjs';

function postProcess() {
  // as we go through the compilation, we'll find we need to add some standard functions to the end of the code e.g. a hash function.  These are saved up and added here.
  zokrates.src = zokrates.standardFunctions + zokrates.src;
  solidity.src = solidity.standardFunctions + solidity.src;
  node.src = node.standardFunctions + node.src;
  // also, we don't know what the Zokrates' main function parameter list is until the end, so add it here
  zokrates.src = zokrates.src.replace(/@main_params/, zokrates.mainParams);
}

export default postProcess;
