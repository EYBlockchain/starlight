/**
Reads an input file line by line and passes each line for further processing
*/

import fs from 'fs';
import readline from 'readline';
import parse from './parser.mjs';
import logger from './utils/logger.mjs';

function tidy(_line) {
  // trim whitespace
  const line = _line.replace(/\s+/g, ' ').replace(/^\s/, '');
  // remove comments
  if (line.startsWith('//')) return null;
  return line;
}

async function processLineByLine(file) {
  const fileStream = fs.createReadStream(file);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.
  logger.info(`Parsing file ${file}... `);
  for await (const line of rl) {
    // Each line in input.txt will be successively available here as `line`.
    try {
      parse(tidy(line));
    } catch (err) {
      logger.error(err);
      break;
    }
  }
}

export default processLineByLine;
