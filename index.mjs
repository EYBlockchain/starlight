
import fs from 'fs';
import path from 'path';

import mkdirs from './bin/mkdirs.mjs';
import compile from './built/index.js';
import { FilingError } from './built/error/errors.js';

// This function is used to export into the published npm package
// (it's basically a replacement for ./bin/index that npm understands)
// locally, always use the command line zappify as defined in package.json
export const zappify = (input, _zappName, output = './zapps', modify = false) => {

  const inputFilePath = input;
  const modifyAST = modify;
  const inputFileName = path.parse(inputFilePath).name;
  const zappName = _zappName || inputFileName;
  const outputDirPath = `${output}/${zappName}`;
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

  mkdirs(options);

  compile(options)
  
}


