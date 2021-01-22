/* eslint-disable func-names, global-require, import/no-dynamic-require */

const fs = require('fs');
const path = require('path');
const chai = require('chai');

/**
 * This is a massive hack.
 * mocha can only run common js (.cjs) files programmatically
 * (i.e. using the JS mocha package instead of from the command line).
 * But zappify is an ES module.
 * We can use the `esm` package to translate the mjs file into a cjs-readable
 * file, meaning this `.cjs` file can 'require' its functions and use them.
 * It has the down-side of being HIDEOUS.
 */
require = require('esm')(module);
const zappify = require('../../src/index.mjs').default;

const { expect } = chai;

const options = {
  zappName: 'test-zol',
  // inputFileName: 'test-zol',
  // inputFilePath: // this test loops through many input files
  outputDirPath: './zapps/test-zol',
  parseDirPath: './zapps/test-zol/parse',
  isTest: true,
  testType: 'prelim',
};

console.log('zappify', zappify)

// zappify(options);

console.log('process.cwd()', process.cwd())
console.log('__dirname', __dirname)

const testDataDir = `${__dirname}/test-data`;
const testDataFiles = fs.readdirSync(testDataDir);

function mkDirs({ outputDirPath, parseDirPath }) {
  try {
    fs.mkdirSync(outputDirPath, {
      recursive: true,
    });
  } catch (err) {
    throw new Error(`Failed to create the output directory ${outputDirPath}`);
  }

  if (!fs.existsSync(parseDirPath)) fs.mkdirSync(parseDirPath);
}

mkDirs(options);

/**

FOR ASSERTING FAILURES (ERRORS) AND CHECKING THE ERROR TYPE IS CORRECT
const assert = require('assert');
const { AssertionError } = require('assert');

const { functionundertest } = require('../index');

describe('Testing Error States', () => {
  it('Throws an error when called with missing arguments', () => {
    try {
      functionundertest(); // this should fail
      assert.fail('expected exception not thrown'); // this throws an AssertionError
    } catch (e) { // this catches all errors, those thrown by the function under test
                  // and those thrown by assert.fail
      if (e instanceof AssertionError) {
        // bubble up the assertion error
        throw e;
      }
      assert.equal(e.message, 'Invalid Arguments'); // Check error is as expected
    }
  });
});

*/

describe('Test suites', function () {
  describe('Incorrect zols testing', function () {
    for (const fileName of testDataFiles) {
      console.log('fileName:', fileName);
      const filePath = path.join(testDataDir, fileName);
      const obj = require(filePath);
      console.log('obj:', obj);
    }
   //  for (const zol of testData.errorZols) {
   //    it(`test zol:- ${zol.contract}`, function() {
   //      fs.writeFileSync(options.inputFilePath, zol.contract);
   //      const willTrrow = function() { zappify(options) };
   //      expect(willTrrow).to.throw(zol.errorMessage);
   //   });
   // }
  });

  // describe('Correct zols testing', function() {
  //   for (const zol of testData.correctZols) {
  //     it(`test zol:- ${zol.contract}`, function() {
  //       fs.writeFileSync(options.inputFilePath, zol.contract);
  //       const resultIndicators = zappify(options);
  //
  //       for(const indicator of Object.values(resultIndicators)) {
  //         const testIndicator = zol.indicators[indicator.name];
  //
  //         expect(indicator.referenceCount).to.be.equal(testIndicator.referenceCount);
  //         expect(indicator.modificationCount).to.be.equal(testIndicator.modificationCount);
  //         expect(indicator.oldCommitmentAccessRequired).to.be.equal(testIndicator.oldCommitmentAccessRequired);
  //         expect(indicator.isModified).to.be.equal(testIndicator.isModified);
  //         expect(indicator.newCommitmentRequired).to.be.equal(testIndicator.newCommitmentRequired);
  //         expect(indicator.isNullified).to.be.equal(testIndicator.isNullified);
  //         expect(indicator.initialisationRequired).to.be.equal(testIndicator.initialisationRequired);
  //         expect(indicator.isIncremented).to.be.equal(testIndicator.isIncremented);
  //         expect(indicator.isDecremented).to.be.equal(testIndicator.isDecremented);
  //         expect(indicator.isWhole).to.be.equal(testIndicator.isWhole);
  //
  //         if (indicator.hasOwnProperty('isKnown')) {
  //           expect(indicator.isKnown).to.be.equal(testIndicator.isKnown);
  //         }
  //         if (indicator.hasOwnProperty('isPartitioned')) {
  //           expect(indicator.isPartitioned).to.be.equal(testIndicator.isPartitioned);
  //         }
  //         if (indicator.hasOwnProperty('isAccessed')) {
  //           expect(indicator.isAccessed).to.be.equal(testIndicator.isAccessed);
  //         }
  //       }
  //    });
  //  }
  // });
});
