/**
Reads an input file line by line and passes each line for further processing
*/

/* eslint-disable no-continue */

import fs from 'fs';
import path from 'path';
import recogniseSprinkles from './recognisers/sprinkles.mjs';
import recogniseCurlyBracket from './recognisers/curly-bracket.mjs';
import logger from './utils/logger.mjs';

function tidy(_line) {
  let line = _line;
  // trim multiple spaces to a single space:
  line = line.replace(/\s+/g, ' ');
  // remove spaces from the start of the line:
  line = line.replace(/^\s/, '');
  // remove comments
  if (line.startsWith('//')) return null;
  return line;
}

/**
 * Takes an input '.zsol' file and removes the privacy keywords.
 * @return {Object} = {
 *     desprinkledFile // a '.sol' file, stripped of any keywords, so
 *                        that 'solc' may compile it.
 *     toResprinkle // an array of objects recording where the
 *                     sprinkled keywords should be reinstated after
 *                     running 'solc'.
 */
function desprinkle(options) {
  logger.info(`Parsing sprinkled file ${options.inputFilePath}... `);
  const sprinkledLines = fs.readFileSync(options.inputFilePath, 'utf-8').split(/\r?\n/);

  const toResprinkle = [];
  const desprinkledLines = sprinkledLines.map(sprinkledLine => {
    const line = tidy(sprinkledLine);
    if (!line) return sprinkledLine;
    recogniseCurlyBracket(line); // increases blockCount, checks we are in the correct block // TODO: is this needed?
    const { keyword, type, name, desprinkledLine } = recogniseSprinkles(line);
    if (desprinkledLine) {
      // record the desprinkling, so that we may add the keywords back to the AST later (after solc compilation):
      toResprinkle.push({
        oldline: sprinkledLine,
        newline: desprinkledLine,
        type,
        keyword,
        name,
      });
      return sprinkledLine.replace(line, desprinkledLine);
    }
    return sprinkledLine;
  });

  const desprinkledFile = desprinkledLines.join('\r\n');

  const desprinkledFilePath = `${options.parseDirPath}/${options.inputFileName}_desprinkled.sol`;
  fs.writeFileSync(desprinkledFilePath, desprinkledFile); // TODO: consider adding a 'safe' cli option to prevent overwrites.

  // Let's also copy the original input file to this output dir:
  const duplicateInputFilePath = `${options.parseDirPath}/${path.basename(options.inputFilePath)}`;
  fs.copyFileSync(options.inputFilePath, duplicateInputFilePath);

  return { desprinkledFile, toResprinkle };
}

export default desprinkle;
