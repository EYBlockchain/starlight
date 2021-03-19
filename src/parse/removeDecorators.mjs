/**
Reads an input file line by line and passes each line for further processing
*/

/* eslint-disable no-continue */

import fs from 'fs';
import path from 'path';
import recogniseDecorators from '../recognisers/decorators.mjs';
import recogniseCurlyBracket from '../recognisers/curly-bracket.mjs';
import backtrace from '../error/backtrace.mjs';
import logger from '../utils/logger.mjs';

function tidy(_line) {
  let line = _line;
  // trim multiple spaces to a single space:
  line = line.replace(/\s+/g, ' ');
  // remove spaces from the start of the line:
  line = line.replace(/^\s/, '');
  // remove all comments
  line = line.replace(/\/\/.*/g, '');
  // TODO: multi-line comments - difficult once we've cut line-by-line
  return line;
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
  const decLines = fs.readFileSync(options.inputFilePath, 'utf-8').split(/\r?\n/);

  const toRedecorate = [];
  const deDecledLines = decLines.map(decLine => {
    const line = tidy(decLine);
    if (!line) return decLine; // empty string is falsey
    recogniseCurlyBracket(line); // increases blockCount, checks we are in the correct block // TODO: is this needed?
    const { keyword, type, name, rhs, deDecLine } = recogniseDecorators(line);
    if (deDecLine && !Array.isArray(deDecLine)) {
      // record the dedecoration, so that we may add the keywords back to the AST later (after solc compilation):
      toRedecorate.push({
        oldline: tidy(decLine),
        newline: tidy(deDecLine),
        type,
        keyword,
        name,
        rhs,
      });
      return decLine.replace(line, deDecLine); // QUESTION: won't the earlier trimming of whitespace corrupt this 'replace' attempt sometimes?
    }
    if (deDecLine && Array.isArray(deDecLine)) {
      // we have secret params - FIXME: structures too confusing: would need to follow lots of code to realise this // TODO: always return array (of objects) from recogniseDecorators?
      for (let i = 0; i < deDecLine.length; i++) {
        toRedecorate.push({
          oldline: decLine,
          newline: deDecLine,
          type: type[i],
          keyword: keyword[i], // all
          name: name[i], // all
          rhs, // recogniseAssignments only TODO: move rhs (& recognition of assignments) elsewhere?
        });
      }
      return decLine.replace(/secret/g, '');
    }
    return decLine;
  });

  const deDecoratedFile = deDecledLines.join('\r\n');
  backtrace.setSolContract(deDecoratedFile); // store for later backtracing 'src' locators to lines of original code.

  const deDecoratedFilePath = `${options.parseDirPath}/${options.inputFileName}_dedecorated.sol`;
  fs.writeFileSync(deDecoratedFilePath, deDecoratedFile); // TODO: consider adding a 'safe' cli option to prevent overwrites.

  // Let's also copy the original input file to this output dir:
  const duplicateInputFilePath = `${options.parseDirPath}/${path.basename(options.inputFilePath)}`;
  fs.copyFileSync(options.inputFilePath, duplicateInputFilePath);

  return { deDecoratedFile, toRedecorate };
}

export default removeDecorators;
