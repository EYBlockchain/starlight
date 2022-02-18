/**
Reads an input file line by line and passes each line for further processing
*/

/* eslint-disable no-continue */

import fs from 'fs';
import path from 'path';
import backtrace from '../error/backtrace.mjs';
import logger from '../utils/logger.mjs';

// regex: matches all cases of 'known' unless they are directly preceded by 'un'
const decorators = [/secret/g, /unknown/g, /\w*(?<!un)known/g, /reinitialisable/g];

function tidy(_line) {
  let line = _line;
  // trim multiple spaces to a single space:
  line = line.replace(/\s+/g, ' ');
  // remove spaces from the start of the line:
  line = line.replace(/^\s/, '');
  return line;
}

function inComment(file, char) {
  // are we in a comment?
  let aComment = false;
  let aMultiComment = false;
  for (let ii = 1; ii < char + 1; ii++) {
    // we take the latest two character substring
    const twoCharSubStr = file.substring(ii - 1, ii + 1);
    // if we're in a multi line comment, we ignore everything until it closes
    if (aMultiComment) {
      if (twoCharSubStr === `*/`) [aComment, aMultiComment] = [false, false];
    } else {
      // otherwise, we're looking for a start of a comment or a new line
      if (twoCharSubStr === `//`) aComment = true;
      if (twoCharSubStr === `/*`) [aComment, aMultiComment] = [true, true];
      if (twoCharSubStr.includes(`\r`) || twoCharSubStr.includes(`\n`))
        aComment = false;
    }
  }
  return aComment;
}

/**
 * Takes an input '.zol' file and removes the privacy keywords.
 * @return {Object} = {
 *     deDecoratedFile // a '.sol' file, stripped of any keywords, so
 *                        that 'solc' may compile it.
 *     toRedecorate // an array of objects recording where the
 *                     decorator keywords should be reinstated after
 *                     running 'solc'.
 */
function removeDecorators(options) {
  logger.verbose(`Parsing decorated file ${options.inputFilePath}... `);
  const decLines = fs
    .readFileSync(options.inputFilePath, 'utf-8')
    .split(/\r?\n/);
  // tidy each line before any changes - so no char numbers are skewed
  const tidyDecLines = decLines.map(decLine => tidy(decLine));
  // combine lines in new file
  const decoratedFile = tidyDecLines.join('\r\n');
  // now we remove decorators and remember how many characters are offset

  // init file
  let deDecoratedFile = decoratedFile;
  // init redecorate obj
  const toRedecorate = [];
  // init matches obj
  const matches = [];

  for (const decorator of decorators) {
    // collate decorator matches in one array
    matches.push(...deDecoratedFile.matchAll(decorator));
  }

  // number of chars to offset
  let offset = 0;

  // sort the array of decorators by their location (char index) in the contract
  matches.sort((matchA, matchB) => matchA.index - matchB.index);

  for (const match of matches) {
    // skip removal and offsetting if we're in a comment
    if (inComment(decoratedFile, match.index)) continue;
    // add this keyword length to offset, since we'll remove it (add one for the space we remove)
    const offsetSrcStart = match.index - offset;
    // save the keyword and where the next word starts
    toRedecorate.push({ decorator: match[0], charStart: offsetSrcStart });
    // replace the dedecorated file with one w/o the keyword (and remove one space)
    deDecoratedFile =
      deDecoratedFile.substring(0, offsetSrcStart) +
      deDecoratedFile.substring(offsetSrcStart + match[0].length + 1);
    offset += match[0].length + 1;
  }

  // const deDecoratedFile = deDecledLines.join('\r\n');
  backtrace.setSolContract(deDecoratedFile); // store for later backtracing 'src' locators to lines of original code.

  const deDecoratedFilePath = `${options.parseDirPath}/${options.inputFileName}_dedecorated.sol`;
  fs.writeFileSync(deDecoratedFilePath, deDecoratedFile); // TODO: consider adding a 'safe' cli option to prevent overwrites.

  // Let's also copy the original input file to this output dir:
  const duplicateInputFilePath = `${options.parseDirPath}/${path.basename(
    options.inputFilePath,
  )}`;
  fs.copyFileSync(options.inputFilePath, duplicateInputFilePath);

  return { deDecoratedFile, toRedecorate };
}

export default removeDecorators;
