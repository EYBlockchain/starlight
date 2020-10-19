import desprinkle from './desprinkler.mjs';
import resprinkle from './resprinkler.mjs';
import compile from './solc.mjs';

import toCircuit from './transformers/toCircuit.mjs';
import logger from './utils/logger.mjs';


const zappify = options => {
  const { desprinkledFile, toResprinkle } = desprinkle(options);

  const solAST = compile(desprinkledFile, options);

  const zsolAST = resprinkle(solAST, toResprinkle, options);

  toCircuit(zsolAST, options);

};

export default zappify;
