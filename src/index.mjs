import yargs from 'yargs';
import processLineByLine from './preprocessor.mjs';

const { argv } = yargs.usage('Usage: $0 -i <input file>').demandOption(['i']);

processLineByLine(argv.i);
