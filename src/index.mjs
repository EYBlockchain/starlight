import yargs from 'yargs';
import processLineByLine from './preprocessor.mjs';
import { node, solidity, zokrates } from './state.mjs';
import logger from './utils/logger.mjs';

const { argv } = yargs.usage('Usage: $0 -i <input file>').demandOption(['i']);

processLineByLine(argv.i).then(() => {
  logger.info(`Node code generated:\n${node.src}`);
  logger.info(`Solidity code generated:\n${solidity.src}`);
  logger.info(`Zokrates code generated:\n${zokrates.src}`);
});
