
import assert from "assert";
import fs from "fs";
import path from 'path';
import { checkASThashes, checkCodeGen, checktestASTExists } from '../built/tests.js'
import mkdirs from '../bin/mkdirs.mjs';
import zappify from '../built/index.js';
import logger from "../built/utils/logger.js";

var files = fs.readdirSync('./test/contracts/')
let options = {}


describe("AST testing", function () {

  describe("#testing zappify", function () {
    it("zappifies each contract", function () {
      this.timeout(100000);
      files.forEach((file) => {
        logger.info('zappifying', file);
        options.inputFilePath = './test/contracts/'+file;
        options.modifyAST = 'n';
        options.inputFileName = path.parse(options.inputFilePath).name;
        // commander converts 'zapp-name' to 'zappName'
        options.zappName = options.inputFileName;
        options.outputDirPath = `./temp-zapps/${options.zappName}`;
        options.parseDirPath = `${options.outputDirPath}/parse`;
        options.circuitsDirPath = `${options.outputDirPath}/circuits`;
        options.contractsDirPath = `${options.outputDirPath}/contracts`;
        options.orchestrationDirPath = `${options.outputDirPath}/orchestration`;
        mkdirs(options);
        zappify(options);
      });
    });
  });

  let chosenFile = files[Math.floor(Math.random() * files.length)]
  const inputFilePath = './test/contracts/'+chosenFile;
  const modifyAST = 'n';
  const inputFileName = path.parse(inputFilePath).name;
  // commander converts 'zapp-name' to 'zappName'
  const zappName = inputFileName;
  const outputDirPath = `./temp-zapps/${zappName}`;
  const parseDirPath = `${outputDirPath}/parse`;
  const circuitsDirPath = `${outputDirPath}/circuits`;
  const contractsDirPath = `${outputDirPath}/contracts`;
  const orchestrationDirPath = `${outputDirPath}/orchestration`;

  logger.info('Testing', chosenFile);

  options = {
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

  const validateOptions = ({
    inputFilePath,
  }) => {
    if (!fs.existsSync(inputFilePath))
      throw new FilingError(`inputFilePath "${inputFilePath}" does not exist.`);

    if (path.parse(inputFilePath).ext !== '.zol')
      if (path.parse(inputFilePath).ext === '.sol') {
        console.warn(`We'd ordinarily expect a '.zol' file as input, but we'll try to compile this '.sol' file...`);
      } else {
        throw new FilingError(`Invalid input file extension. Expected '.zol' (a 'zappable' solidity file). Got '${path.parse(inputFilePath).ext}'.`);
      }
  };

  validateOptions(options);

  mkdirs(options);

  zappify(options);

  describe("#testing circuits", function () {
    it("Checks whether test AST is present , if not copy from zapps", function () {
      const result = checktestASTExists(options,'circuits');
      assert.strictEqual(result, true );
    });
    it("Checks whether circuit AST is generated correctly", function () {
      const result = checkASThashes(options,'circuits');
      assert.strictEqual(result, 'true' );
    });
  });

  describe("#testing contracts", function () {
    it("Checks whether test AST is present , if not copy from zapps", function () {
      const result = checktestASTExists(options,'contracts');
      assert.strictEqual(result, true );
    });
    it("Checks whether contract AST is generated correctly", function () {
      const result = checkASThashes(options,'contracts');
      assert.strictEqual(result, 'true' );
    });
  });


  describe("#testing orchestration", function () {
    it("Checks whether test AST is present , if not copy from zapps", function () {
      const result = checktestASTExists(options,'orchestration');
      assert.strictEqual(result, true );
    });
    it("Checks whether contract AST is generated correctly", function () {
      const result = checkASThashes(options,'orchestration');
      assert.strictEqual(result, 'true' );
    });
  });
});


describe("Code Gen testing", function () {
  describe("#testing circuits", function () {
    it("Make sure circuits are generated for all zolidity functions", function () {
      var zappDirectory = fs.readdirSync(options.outputDirPath+'/circuits/');
      let countZokFiles = 0;
      for(var i in zappDirectory) {
        if(path.extname(zappDirectory[i]) === ".zok")
        countZokFiles++;
      }
      const result = checkCodeGen(options,'circuits');
      assert.strictEqual(result, countZokFiles );
    });
  });

  describe("#testing orchestration", function () {
    it("Make sure orchestartion files are generated for all zolidity functions", function () {
      var zappDirectory = fs.readdirSync(options.outputDirPath+'/orchestration/');
      let countorchestrationFiles = 0;
      for(var i in zappDirectory) {
        if(path.extname(zappDirectory[i]) === ".mjs")
        countorchestrationFiles++;
      }
      const result = checkCodeGen(options,'orchestration');
      assert.strictEqual(result, countorchestrationFiles );
    });
  });
});
