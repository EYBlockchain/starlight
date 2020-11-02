/**
Module to set up zkp elements of compiler output, along with writing the vks to the db folder. To be run from inside the zokrates container.
*/

import fs from 'fs';
import yargs from 'yargs';
import { generateKeys } from './zokrates.mjs';

// const { generalise } = GN;
const { argv } = yargs.usage('Usage: $0 -i <input file>').demandOption(['i']);
const functionPath = `/app/examples/cases/uninit_global`;

export const setup = async functionName => {
  if (!fs.existsSync(`/app/circuits/${functionName}.zok`)) {
    const circuit = fs.readFileSync(`${functionPath}/${functionName}.zok`, 'utf-8');
    fs.writeFileSync(`/app/circuits/${functionName}.zok`, circuit);
  }
  await generateKeys(`${functionName}.zok`);
};

setup(argv.i);
