/**
Reads an input file line by line and passes each line for further processing
*/

import fs from 'fs';
import readline from 'readline';
import replaceIn from 'replace-in-file';
import recogniseSprinkles from './recognisers/sprinkles.mjs';
import recogniseCurlyBracket from './recognisers/curly-bracket.mjs';
import logger from './utils/logger.mjs';

function tidy(_line) {
  // trim whitespace
  const line = _line.replace(/\s+/g, ' ').replace(/^\s/, '');
  // remove comments
  if (line.startsWith('//')) return null;
  return line;
}

function replaceSprinkles(file, replaceArr) {
  for (const obj of replaceArr) {
    const options = {
      files: file,
      from: obj.oldline,
      to: obj.newline,
    };
    replaceIn.sync(options);
  }
}

async function desprinkleLineByLine(file) {
  const fileStream = fs.createReadStream(file);
  const desprinkledFile = file.replace('.sol', '_desprinkled.sol');
  let fileWritten = false;

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.
  logger.info(`Parsing sprinkled file ${file}... `);
  const toResprinkle = [];
  for await (const line of rl) {
    // Each line in input.txt will be successively available here as `line`.
    const lineObj = { oldline: tidy(line) };
    try {
      recogniseCurlyBracket(line); // increases blockCount, checks we are in the correct block
      if (recogniseSprinkles(tidy(line))) {
        if (!fileWritten) {
          fs.copyFile(file, desprinkledFile, fs.constants.COPYFILE_EXCL, err => console.error(err));
          fileWritten = true;
        }
        const { s, type, name, ln } = recogniseSprinkles(tidy(line), true);
        lineObj.newline = tidy(ln);
        lineObj.type = type;
        lineObj.keyword = s;
        lineObj.name = name;
        toResprinkle.push(lineObj);
      }
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }
  if (fs.existsSync(desprinkledFile)) {
    replaceSprinkles(desprinkledFile, toResprinkle);
    return { desprinkledFile, toResprinkle };
  }
  return file;
}

export default desprinkleLineByLine;
