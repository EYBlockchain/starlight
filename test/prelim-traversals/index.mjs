/* eslint-disable func-names, global-require, import/no-dynamic-require, no-loop-func, no-param-reassign, no-continue */

import fs from 'fs';
import pathjs from 'path';
import chai from 'chai';
import assert from 'assert';
import { fileURLToPath } from 'url';

import { readJsonFile, writeJsonFile } from '../helper/filing.mjs';

import zappify from '../../src/index.mjs';
import logger from '../../src/utils/logger.mjs';

const { expect } = chai;
const { AssertionError } = assert;

const __dirname = pathjs.dirname(fileURLToPath(import.meta.url)); // because ES modules don't support __dirname, and this test will be called from the root context, so relative paths won't be relative to this file...
// const require = filePath => eval(fs.readFileSync(`${filePath}`, 'utf8'));

const args = process.argv;

const testDataDir = pathjs.join(__dirname, 'test-data');
const testDataFiles = fs.readdirSync(testDataDir).filter(file => file.includes('.zsol'));

const mkDirs = ({ outputDirPath, parseDirPath }) => {
  try {
    fs.mkdirSync(outputDirPath, {
      recursive: true,
    });
  } catch (err) {
    throw new Error(`Failed to create the output directory ${outputDirPath}`);
  }

  if (!fs.existsSync(parseDirPath)) fs.mkdirSync(parseDirPath);
};

const rmDir = dirPath => {
  try {
    fs.rmdirSync(dirPath, {
      recursive: true, // rm subdirectories too
      force: true,
    });
  } catch (err) {
    throw new Error(`Failed to remove the directory ${dirPath}`);
  }
};

const collectScopesIntoArray = (path, state) => {
  const { scope } = path;
  const scopes = state;
  if (!scopes.some(scp => scp.scopeId === scope.scopeId)) scopes.push(scope);
};

const pathsMap = bindingOrIndicator => {
  const x = bindingOrIndicator;
  const mapToId = pathsArr =>
    pathsArr.map(p => {
      return p.node ? p.node.id : p;
    });
  if (x.referencingPaths) x.referencingPaths = mapToId(x.referencingPaths);
  if (x.modifyingPaths) x.modifyingPaths = mapToId(x.modifyingPaths);
  if (x.nullifyingPaths) x.nullifyingPaths = mapToId(x.nullifyingPaths);
};

const formatBindings = bindings => {
  for (const binding of Object.values(bindings)) {
    delete binding.node;
    delete binding.path;
    delete binding.scope;
    pathsMap(binding);
  }
};

const formatIndicators = indicators => {
  for (const indicator of Object.values(indicators)) {
    delete indicator.binding;
    pathsMap(indicator);
  }
};

/**
Removes nested classes. Makes it easier to copy the console output to create _new_ example test cases.
*/
const formatScopesForTesting = scopes => {
  scopes.forEach(scope => {
    delete scope.path;
    formatBindings(scope.bindings);
    formatBindings(scope.referencedBindings);
    formatBindings(scope.modifiedBindings);
    formatIndicators(scope.indicators);
  });
};

// TODO: remember to delete the temp dir for each zapp that these tests create, at the end of each loop!!!

// We wrap the `it()` function in a closure, because `it()` is located within a 'for' loop. If we don't do this, mocha does weird async things.
function itShouldCompareOutputs(options, expected, actual, consoleWarnings) {
  const fileName = options.inputFileName;
  it(`${fileName}: indicators & bindings should be as expected`, () => {
    // try {
    const path = zappify(options);
    rmDir(options.outputDirPath); // clean up

    const scopes = [];
    path.traversePathsFast(collectScopesIntoArray, scopes);
    formatScopesForTesting(scopes);
    // `eql` tests for _deep_ object equality.
    actual = {
      scopes,
      errorType: null,
      errorMessage: null,
      warningMessages: consoleWarnings,
    };

    if (args.includes('--json')) {
      // User is requesting the JSON be output to the console.
      console.log(`${fileName}: scopes, JSON-formatted:`);
      console.log(JSON.stringify(actual, null, 2));
    }

    expect(actual).to.eql(expected);
    // } catch (err) {
    //   rmDir(options.outputDirPath); // clean up
    //   console.log(`Did not expect to get an error for file ${fileName}`);
    //   console.error(err);
    // }
  });
}

// We wrap the `it()` function in a closure, because `it()` is located within a 'for' loop. If we don't do this, mocha does weird async things.
function itShouldThrowAnError(options, expected) {
  const fileName = options.inputFileName;
  it(`${fileName}: should throw an error: '${expected.errorType}'`, () => {
    try {
      zappify(options); // this should fail
      assert.fail(
        `Expected an error of type '${expected.errorType}', but the code seems to have run succesfully... whoops.`,
      ); // This code should be unreachable if the error is correctly thrown as expected. If we reach here, it throws an AssertionError.
    } catch (err) {
      // this catches all errors: those thrown by the function under test; and those thrown by assert.fail

      rmDir(options.outputDirPath); // clean up

      if (err instanceof AssertionError) {
        // bubble up the assertion error
        throw err;
      }
      // Check error is as expected:
      assert.equal(err.name, expected.errorType);
      assert.equal(err.message, expected.errorMessage);
    }
  });
}

function itShouldWriteAnOutputFile(options, jsonFilePath, actual, consoleWarnings) {
  const fileName = options.inputFileName;
  it(`${fileName}: should write/overwrite '${fileName}.json'`, () => {
    try {
      const path = zappify(options);
      const scopes = [];
      path.traversePathsFast(collectScopesIntoArray, scopes);
      formatScopesForTesting(scopes);
      // `eql` tests for _deep_ object equality.
      actual = {
        scopes,
        errorType: null,
        errorMessage: null,
        warningMessages: consoleWarnings,
      };
    } catch (err) {
      actual = {
        scopes: null,
        errorType: err.name,
        errorMessage: err.message,
        warningMessages: null,
      };
    }
    writeJsonFile(jsonFilePath, actual);
    console.log(`Overwritten json file '${jsonFilePath}' with new expected values.`);

    rmDir(options.outputDirPath); // clean up
  });
}

describe('Test prelim traversals of .zsol files', function () {
  console.log(`Pass '--json' to see a JSON output of the scopes.`);
  console.log(
    `Pass '--write <fileName>' to write/overwrite the scopes to a JSON file. (But only do this if you know what you're doing!)\n`,
  );

  const originalWarn = logger.warn; // remember logger.warn; we'll be diverting it to a stub.
  afterEach(function () {
    logger.warn = originalWarn; // reset logger.warn to its correct functionality.
  });

  const consoleWarnings = [];
  const stubWarn = warning => consoleWarnings.push(warning);
  beforeEach(function () {
    logger.warn = stubWarn; // temporarily divert logger.warn, so that we may collect warnings in memory, for testing.
  });

  for (const zsolFile of testDataFiles) {
    const fileName = pathjs.basename(zsolFile, '.zsol');
    const zsolFilePath = pathjs.join(testDataDir, `${fileName}.zsol`);
    const jsonFilePath = pathjs.join(testDataDir, `${fileName}.json`);

    const options = {
      zappName: fileName,
      inputFileName: fileName,
      inputFilePath: zsolFilePath,
      outputDirPath: `./zapps/${fileName}`,
      parseDirPath: `./zapps/${fileName}/parse`,
      isTest: true,
      testType: 'prelim',
    };
    mkDirs(options);

    const actual = {};

    // If the tester (dev) trusts the output and wants to write it to file, to become the 'expected' object for future tests.
    // TODO: use yargs to enforce an argument be passed with '--write'
    if (args.includes('--write') && args[args.indexOf('--write') + 1] === fileName) {
      itShouldWriteAnOutputFile(options, jsonFilePath, actual, consoleWarnings);
      continue;
    }

    /** Compare actual vs expected */
    const expected = readJsonFile(jsonFilePath);
    if (!expected.errorType) {
      itShouldCompareOutputs(options, expected, actual, consoleWarnings);
    } else {
      itShouldThrowAnError(options, expected);
    }
  }
});
