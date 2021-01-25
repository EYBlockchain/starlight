#!/usr/bin/env -S NODE_ENV=production node

import fs from 'fs';
import path from 'path';
import commander from 'commander';
import figlet from 'figlet';

import mkdirs from './mkdirs.mjs';
import zappify from '../src/index.mjs';
import logger from '../src/utils/logger.mjs';
import { FilingError } from '../src/utils/errors.mjs';

const { Command } = commander;
const program = new Command();

// prettier-ignore
program
  .version('0.0.1')
  .description('Generate a zApp from a decorated solidity file');

// prettier-ignore
program
  .option(
    '-v, --verbose',
    'verbose console logging'
  )
  .option(
    '--log-level <loglevel>',
    'specify a winston log level'
  )
  .requiredOption(
    '-i, --input <filepath>',
    'specify the relative path to a zappable solidity file',
  )
  .option(
    '-o, --output <dirpath>',
    'specify the relative path to an output directory',
    './zapps',
  )
  .option(
    '-z, --zapp-name <name>',
    'Specify a name for the output zapp. Defaults to the name of the --input file.',
  );

program.parse(process.argv);

logger.level = program.verbose ? 'verbose' : program.logLevel || logger.level;

const inputFilePath = program.input;
const inputFileName = path.parse(inputFilePath).name;
// commander converts 'zapp-name' to 'zappName'
const zappName = program.zappName || inputFileName;
const outputDirPath = `${program.output}/${zappName}`;
const parseDirPath = `${outputDirPath}/parse`;
const circuitsDirPath = `${outputDirPath}/circuits`;
const contractsDirPath = `${outputDirPath}/contracts`;
const orchestrationDirPath = `${outputDirPath}/orchestration`;

const options = {
  zappName,
  inputFileName,
  inputFilePath,
  outputDirPath,
  parseDirPath,
  circuitsDirPath,
  contractsDirPath,
  orchestrationDirPath,
};

const validateOptions = ({
  inputFilePath,
}) => {
  if (!fs.existsSync(inputFilePath))
    throw new FilingError(`inputFilePath "${inputFilePath}" does not exist.`);

  if (path.parse(inputFilePath).ext !== '.zsol')
    throw new FilingError(`Invalid input file extension. Expected '.zsol' (a 'zappable' solidity file). Got '${path.parse(inputFilePath).ext}'.`);
};

validateOptions(options);

mkdirs(options);

console.log(figlet.textSync('zappify!'));

zappify(options);
