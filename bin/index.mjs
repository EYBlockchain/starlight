#!/usr/bin/env node

import commander from 'commander';

const { Command } = commander;
const program = new Command();

// prettier-ignore
program
  .version('0.0.1')
  .description('Generate a zApp from a decorated solidity file');

// The code for the below subcommands is located in `./zappify-<command name>`

// prettier-ignore
program
  .command(
    'default',
    'Transpile a file.\n(No need to specify the word `default` unless you need help (`zappify default -h` or `zappify help default`)).',
    { isDefault: true }
  );

// prettier-ignore
program
  .command('test', 'Test a newly created zApp. (Takes a long time).')
  .alias('t');

// prettier-ignore
program
  .command('dev-test', 'Run dev tests')
  .alias('d');

program.parse(process.argv);
