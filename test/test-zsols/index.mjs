import fs from 'fs';
import assert from 'assert';
import chai from 'chai';

import testData from './testData.mjs';
import zappify from '../../src/index.mjs';

const options = {
  zappName: 'test-zol',
  inputFileName: 'test-zol',
  inputFilePath: './examples/cases/test-zol.zsol',
  outputDirPath: './zapps/test-zol',
  parseDirPath: './zapps/test-zol/parse',
  circuitsDirPath: './zapps/test-zol/circuits',
  contractsDirPath: './zapps/test-zol/contracts',
  orchestrationDirPath: './zapps/test-zol/orchestration',
  isTest: true,
}

function mkDirs({
  outputDirPath,
  parseDirPath,
  circuitsDirPath,
  contractsDirPath,
  orchestrationDirPath,
}) {
  try {
    fs.mkdirSync(outputDirPath, {
      recursive: true,
    });
  } catch (err) {
    throw new Error(`Failed to create the output directory ${outputDirPath}`);
  }

  if (!fs.existsSync(parseDirPath)) fs.mkdirSync(parseDirPath);
  if (!fs.existsSync(circuitsDirPath)) fs.mkdirSync(circuitsDirPath);
  if (!fs.existsSync(contractsDirPath)) fs.mkdirSync(contractsDirPath);
  if (!fs.existsSync(orchestrationDirPath)) fs.mkdirSync(orchestrationDirPath);
}

mkDirs(options);

describe('Test suits', function() {
  const expect = chai.expect;

  describe('Incorrect zols testing', function() {
    for (const zol of testData.errorZols) {
      it(`test zol:- ${zol.contract}`, function() {
        fs.writeFileSync(options.inputFilePath, zol.contract);
        const willTrrow = function() { zappify(options) };
        expect(willTrrow).to.throw(zol.errorMessage);
     });
   }
  });

  describe('Correct zols testing', function() {
    for (const zol of testData.correctZols) {
      it(`test zol:- ${zol.contract}`, function() {
        fs.writeFileSync(options.inputFilePath, zol.contract);
        const resultIndicators = zappify(options);

        for(const indicator of Object.values(resultIndicators)) {
          const testIndicator = zol.indicators[indicator.name];

          expect(indicator.referenceCount).to.be.equal(testIndicator.referenceCount);
          expect(indicator.modificationCount).to.be.equal(testIndicator.modificationCount);
          expect(indicator.oldCommitmentAccessRequired).to.be.equal(testIndicator.oldCommitmentAccessRequired);
          expect(indicator.isModified).to.be.equal(testIndicator.isModified);
          expect(indicator.newCommitmentRequired).to.be.equal(testIndicator.newCommitmentRequired);
          expect(indicator.isNullified).to.be.equal(testIndicator.isNullified);
          expect(indicator.initialisationRequired).to.be.equal(testIndicator.initialisationRequired);
          expect(indicator.isIncremented).to.be.equal(testIndicator.isIncremented);
          expect(indicator.isDecremented).to.be.equal(testIndicator.isDecremented);
          expect(indicator.isWhole).to.be.equal(testIndicator.isWhole);

          if (indicator.hasOwnProperty('isKnown')) {
            expect(indicator.isKnown).to.be.equal(testIndicator.isKnown);
          }
          if (indicator.hasOwnProperty('isPartitioned')) {
            expect(indicator.isPartitioned).to.be.equal(testIndicator.isPartitioned);
          }
          if (indicator.hasOwnProperty('isAccessed')) {
            expect(indicator.isAccessed).to.be.equal(testIndicator.isAccessed);
          }
        }
     });
   }
  });
});
