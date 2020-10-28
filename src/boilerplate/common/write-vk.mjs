/**
Module to set up zkp elements of compiler output, along with writing the vks to the db folder. To be run from inside the zokrates container.
*/

import fs from 'fs';
import yargs from 'yargs';

// const { generalise } = GN;
const { argv } = yargs.usage('Usage: $0 -i <input file>').demandOption(['i']);

const readFile = filePath => {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  console.log('Unable to locate file: ', filePath);
  return null;
};

export const writeFile = (filePath, data) => {
  // this will overwrite any existing file:
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
  } catch (err) {
    throw new Error(err);
  }
};

export const writeVK = async functionName => {
  const sourcePath = `/app/output/${functionName}/${functionName}_vk.key`; // won't change
  const destinationPath = `/app/examples/cases/uninit_global/db/${functionName}_vk.key`; // TODO - change to output of compiler

  const vk = JSON.parse(readFile(sourcePath));
  writeFile(destinationPath, vk);
};

writeVK(argv.i);
