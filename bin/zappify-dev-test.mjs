#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import commander from 'commander';
import Mocha from 'mocha';
import cp from 'child_process';
import zappify from '../src/index.mjs';

const { execSync } = cp;

const { Command } = commander;
const program = new Command();

// prettier-ignore
program
  .description('Dev tests');

// prettier-ignore
program
  .option('-p, --prelim', 'Test preliminary traversals.')
  .option('-d, --diff', `Test zappify on a set of example zsol files, and compare the file 'diffs' of actual vs expected.`);

program.parse(process.argv);

const { prelim, diff } = program;

if (!prelim && !diff) console.log('No options specified. `zappify help dev-test` for help.');

// Instantiate a Mocha instance.
const mocha = new Mocha();

const prelimTestFile = './test/prelim-traversals/index.cjs';

// require = require('esm')(module);
// module.exports = require('prelimTestFile').default;

mocha.addFile(prelimTestFile);

// Run the tests.
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0; // exit with non-zero status if there were failures
});

// execSync(`mocha --require @babel/register ${prelimTestFile}`, (error, stdout, stderr) => {
//   console.log(`stdout: ${stdout}`);
//   console.log(`stderr: ${stderr}`);
//   if (error !== null) {
//     console.log(`exec error: ${error}`);
//   }
// });
