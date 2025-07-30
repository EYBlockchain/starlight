#!/usr/bin/env -S NODE_ENV=production node

import fs from 'fs';
import path from 'path';
import commander from 'commander';

import mkdirs from './mkdirs.mjs';
import zappify from '../built/index.js';
import logger from '../built/utils/logger.js';
import { FilingError } from '../built/error/errors.js';

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
  )
  .option(
    '-m, --modify <modify>',
    'Ovewrite the file from truezapps folder',
  );

program.parse(process.argv);
const opts = program.opts();

logger.level = opts.verbose ? 'verbose' : opts.logLevel || logger.level;

const inputFilePath = opts.input;
const modifyAST = opts.modify;
const inputFileName = path.parse(inputFilePath).name;
// commander converts 'zapp-name' to 'zappName'
const zappName = opts.zappName || inputFileName;
const outputDirPath = `${opts.output}/${zappName}`;
const configDirPath = `${outputDirPath}/config`;
const migrationsDirPath = `${outputDirPath}/migrations`;
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
  modifyAST,
};

const validateOptions = ({
  inputFilePath // eslint-disable-line no-shadow
}) => {
  if (!fs.existsSync(inputFilePath))
    throw new FilingError(`inputFilePath "${inputFilePath}" does not exist.`);

  if (path.parse(inputFilePath).ext !== '.zol')
    if (path.parse(inputFilePath).ext === '.sol') {
      console.warn(`We'd ordinarily expect a '.zol' file as input, but we'll try to compile this '.sol' file...`);
    } else {
      throw new FilingError(`Invalid input file extension. Expected '.zol' (a 'zappable' solidity file). Got '${path.parse(inputFilePath).ext}'.`);
    }
    fs.rmSync(parseDirPath, { recursive: true, force: true });
    fs.rmSync(circuitsDirPath, { recursive: true, force: true });
    fs.rmSync(contractsDirPath, { recursive: true, force: true });
    fs.rmSync(orchestrationDirPath, { recursive: true, force: true });
    fs.rmSync(configDirPath, { recursive: true, force: true });
    fs.rmSync(migrationsDirPath, { recursive: true, force: true });
};

validateOptions(options);

mkdirs(options);

zappify(options);
