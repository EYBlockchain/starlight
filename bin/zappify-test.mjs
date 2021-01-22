#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import commander from 'commander';
import zappify from '../src/index.mjs';

const { Command } = commander;
const program = new Command();

// prettier-ignore
program
  .description('Test your newly created zapp')
  .alias('t');

// prettier-ignore
program
  .requiredOption('-i, --input <dirpath>', `Specify the relative path to a zapp's directory.`);

program.parse(process.argv);

const { input } = program;

console.log(`zappify test -i ${input}`);

const validateInputDir = () => {
  if (!fs.existsSync(input)) throw new Error(`input dir ${input} does not exist.`);

  // TODO: check for dirs such as 'circuits', 'contracts', etc. to ensure the user has specified a valid path to a zapp dir.
};

validateInputDir(input);
