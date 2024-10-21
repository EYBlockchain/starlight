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
      assert.strictEqual(result+1, countorchestrationFiles);
    });
  });
});



// import assert from "assert";
// import fs from "fs";

// import path from 'path';
// import { fileURLToPath } from 'url';
// import { checkASThashes, checkCodeGen, checktestASTExists } from '../built/tests.js'
// import mkdirs from '../bin/mkdirs.mjs';
// import zappify from '../built/index.js';
// import logger from "../built/utils/logger.js";

// import { expect } from 'chai';
// //import { collectIncrements } from '../src/transformers/visitors/orchestrationVisitor'; 

// var files = fs.readdirSync('./test/contracts/')
// let options = {}


// describe("AST testing", function () {

//   describe("#testing zappify", function () {
//     it("zappifies each contract", function () {
//       this.timeout(100000);
//       files.forEach((file) => {
//         logger.info('zappifying', file);
//         options.inputFilePath = './test/contracts/'+file;
//         options.modifyAST = 'n';
//         options.inputFileName = path.parse(options.inputFilePath).name;
//         // commander converts 'zapp-name' to 'zappName'
//         options.zappName = options.inputFileName;
//         options.outputDirPath = `./temp-zapps/${options.zappName}`;
//         options.parseDirPath = `${options.outputDirPath}/parse`;
//         options.circuitsDirPath = `${options.outputDirPath}/circuits`;
//         options.contractsDirPath = `${options.outputDirPath}/contracts`;
//         options.orchestrationDirPath = `${options.outputDirPath}/orchestration`;
//         mkdirs(options);
//         zappify(options);
//       });
//     });
//   });

//   let chosenFile = files[Math.floor(Math.random() * files.length)]
//   const inputFilePath = './test/contracts/'+chosenFile;
//   const modifyAST = 'n';
//   const inputFileName = path.parse(inputFilePath).name;
//   // commander converts 'zapp-name' to 'zappName'
//   const zappName = inputFileName;
//   const outputDirPath = `./temp-zapps/${zappName}`;
//   const parseDirPath = `${outputDirPath}/parse`;
//   const circuitsDirPath = `${outputDirPath}/circuits`;
//   const contractsDirPath = `${outputDirPath}/contracts`;
//   const orchestrationDirPath = `${outputDirPath}/orchestration`;

//   logger.info('Testing', chosenFile);

//   options = {
//     zappName,
//     inputFileName,
//     inputFilePath,
//     outputDirPath,
//     parseDirPath,
//     circuitsDirPath,
//     contractsDirPath,
//     orchestrationDirPath,
//     modifyAST,
//   };

//   const validateOptions = ({
//     inputFilePath,
//   }) => {
//     if (!fs.existsSync(inputFilePath))
//       throw new FilingError(`inputFilePath "${inputFilePath}" does not exist.`);

//     if (path.parse(inputFilePath).ext !== '.zol')
//       if (path.parse(inputFilePath).ext === '.sol') {
//         console.warn(`We'd ordinarily expect a '.zol' file as input, but we'll try to compile this '.sol' file...`);
//       } else {
//         throw new FilingError(`Invalid input file extension. Expected '.zol' (a 'zappable' solidity file). Got '${path.parse(inputFilePath).ext}'.`);
//       }
//   };
  
//   validateOptions(options);

//   mkdirs(options);

//   zappify(options);

//   describe("#testing circuits", function () {
//     it("Checks whether test AST is present , if not copy from zapps", function () {
//       const result = checktestASTExists(options,'circuits');
//       assert.strictEqual(result, true );
//     });
//     it("Checks whether circuit AST is generated correctly", function () {
//       const result = checkASThashes(options,'circuits');
//       assert.strictEqual(result, 'true' );
//     });
//   });

//   describe("#testing contracts", function () {
//     it("Checks whether test AST is present , if not copy from zapps", function () {
//       const result = checktestASTExists(options,'contracts');
//       assert.strictEqual(result, true );
//     });
//     it("Checks whether contract AST is generated correctly", function () {
//       const result = checkASThashes(options,'contracts');
//       assert.strictEqual(result, 'true' );
//     });
//   });


//   describe("#testing orchestration", function () {
//     it("Checks whether test AST is present , if not copy from zapps", function () {
//       const result = checktestASTExists(options,'orchestration');
//       assert.strictEqual(result, true );
//     });
//     it("Checks whether contract AST is generated correctly", function () {
//       const result = checkASThashes(options,'orchestration');
//       assert.strictEqual(result, 'true' );
//     });
//   });
// });


// describe("Code Gen testing", function () {
//   describe("#testing circuits", function () {
//     it("Make sure circuits are generated for all zolidity functions", function () {
//       var zappDirectory = fs.readdirSync(options.outputDirPath+'/circuits/');
//       let countZokFiles = 0;
//       for(var i in zappDirectory) {
//         if(path.extname(zappDirectory[i]) === ".zok")
//         countZokFiles++;
//       }
//       const result = checkCodeGen(options,'circuits');
//       assert.strictEqual(result, countZokFiles );
//     });
//   });

//   describe("#testing orchestration", function () {
//     it("Make sure orchestartion files are generated for all zolidity functions", function () {
//       var zappDirectory = fs.readdirSync(options.outputDirPath+'/orchestration/');
//       let countorchestrationFiles = 0;
//       for(var i in zappDirectory) {
//         if(path.extname(zappDirectory[i]) === ".mjs")
//         countorchestrationFiles++;
//       }
//       const result = checkCodeGen(options,'orchestration');
//       assert.strictEqual(result+1, countorchestrationFiles);
//     });
//   });

  // Testing orchestration files: 
//   describe("#testing orchestration files", function () {
//     it("should generate orchestration files correctly", function () {
//         const result = checktestASTExists(options, 'orchestration');
//         assert.strictEqual(result, true);
//     });

//     it("should validate the structure of orchestration files", function () {
//         const structure = validateOrchestrationStructure(options);
//         assert.strictEqual(structure.isValid, true);
//         assert.deepStrictEqual(structure.errors, []); // Assuming `validateOrchestrationStructure` returns an object with validity and errors
//     });

//     it("should handle invalid input gracefully", function () {
//         // Example of testing error handling
//         const result = handleInvalidInput(options);
//         assert.strictEqual(result.success, false);
//         assert.strictEqual(result.message, "Expected error message");
//     });
// });

// describe("#testing orchestration files", function () {
    
//   // Check if orchestration files are generated correctly
//   it("should generate orchestration files correctly", function () {
//       const result = checktestASTExists(options, 'orchestration');
//       assert.strictEqual(result, true);
//   });

//   // Validate the structure of the generated orchestration files
//   it("should validate the structure of orchestration files", function () {
//       const structure = validateOrchestrationStructure(options);
//       assert.strictEqual(structure.isValid, true);
//       assert.deepStrictEqual(structure.errors, []); // Assuming `validateOrchestrationStructure` returns an object with validity and errors
//   });

//   // Handle invalid inputs gracefully
//   it("should handle invalid input gracefully", function () {
//       const invalidOptions = {
//           ...options,
//           orchestrationDirPath: './invalid/orchestration/path', // Intentionally wrong path
//       };
//       const result = handleInvalidInput(invalidOptions);
//       assert.strictEqual(result.success, false);
//       assert.strictEqual(result.message, "Expected error message");
//   });

//   // Check the existence and correctness of specific properties in orchestration files
//   it("should ensure necessary properties are present in orchestration files", function () {
//       const result = validateOrchestrationProperties(options);
//       assert.strictEqual(result.isValid, true);
//       assert.deepStrictEqual(result.missingProperties, []); // No missing properties
//   });

//   // Additional test to validate the content of generated orchestration files
//   it("should validate the content of orchestration files", function () {
//       const content = validateOrchestrationContent(options);
//       assert.strictEqual(content.isValid, true);
//       assert.deepStrictEqual(content.errors, []); // Assuming `validateOrchestrationContent` checks content-level validity
//   });
// });





// function validateOrchestrationStructure(options) {
//   const orchestrationFilePath = path.join(options.orchestrationDirPath, 'your-orchestration-file.mjs');
  
//   if (!fs.existsSync(orchestrationFilePath)) {
//       return { isValid: false, errors: ['Orchestration file not found'] };
//   }

//   const fileContent = fs.readFileSync(orchestrationFilePath, 'utf8');
//   // Here, parse the file or validate its structure (you could use AST parsing, regex, or other logic)
//   const isValidStructure = someStructureValidationFunction(fileContent); // Replace with actual validation logic

//   return {
//       isValid: isValidStructure,
//       errors: isValidStructure ? [] : ['Invalid structure']
//   };
// }

// function validateOrchestrationProperties(options) {
//   const orchestrationFilePath = path.join(options.orchestrationDirPath, 'your-orchestration-file.mjs');
  
//   const requiredProperties = ['property1', 'property2', 'property3']; // Replace with actual properties
//   const missingProperties = [];

//   if (!fs.existsSync(orchestrationFilePath)) {
//       return { isValid: false, missingProperties: requiredProperties };
//   }

//   const fileContent = fs.readFileSync(orchestrationFilePath, 'utf8');
//   requiredProperties.forEach((property) => {
//       if (!fileContent.includes(property)) {
//           missingProperties.push(property);
//       }
//   });

//   return {
//       isValid: missingProperties.length === 0,
//       missingProperties
//   };
// }

// function validateOrchestrationContent(options) {
//   const orchestrationFilePath = path.join(options.orchestrationDirPath, 'your-orchestration-file.mjs');
  
//   if (!fs.existsSync(orchestrationFilePath)) {
//       return { isValid: false, errors: ['Orchestration file not found'] };
//   }

//   const fileContent = fs.readFileSync(orchestrationFilePath, 'utf8');
//   const errors = [];

//   // Validate content: check for specific keywords, functions, or values
//   if (!fileContent.includes('expectedFunction')) {
//       errors.push('Missing expected function: expectedFunction');
//   }

//   // Add other content validation checks

//   return {
//       isValid: errors.length === 0,
//       errors
//   };
// }

// function handleInvalidInput(invalidOptions) {
//   try {
//       validateOptions(invalidOptions); // This should trigger an error
//       zappify(invalidOptions); // This should not run if the options are invalid
//       return { success: false, message: 'Error was expected but did not occur' };
//   } catch (error) {
//       return { success: false, message: error.message };
//   }
// }
// it("should throw an error if the orchestration file path is invalid", function () {
//   const invalidOptions = {
//       ...options,
//       orchestrationDirPath: './invalid/orchestration/path'
//   };

//   try {
//       validateOrchestrationStructure(invalidOptions);
//   } catch (error) {
//       assert.strictEqual(error.message, 'Orchestration file not found');
//   }
// });

/// Testing Incrementation code

// describe('collectIncrements', function() {
  
//   it('should return increments for a basic StateVariableIndicator', function() {
//     const mockStateVarIndicator = {
//       increments: [
//         { nodeType: 'IndexAccess', name: 'var1', precedingOperator: '+', value: true, modName: 'modVar1' },
//         { nodeType: 'MemberAccess', name: 'var2', precedingOperator: '+', value: false }
//       ],
//       decrements: [],
//       isStruct: false
//     };

//     const result = collectIncrements(mockStateVarIndicator);
    
//     expect(result.incrementsArray).to.deep.equal([
//       { name: 'var1', precedingOperator: '+', accessed: undefined },
//       { name: 'var2', precedingOperator: '+', accessed: undefined }
//     ]);
//     expect(result.incrementsString).to.equal('parseInt(modVar1, 10) + parseInt(var2.integer, 10)');
//   });
  
//   it('should handle struct StateVariableIndicator with MappingKey', function() {
//     const mockMappingKey = {
//       increments: [{ nodeType: 'IndexAccess', name: 'var1', precedingOperator: '+', value: true }],
//       isStruct: false,
//       structProperties: {}
//     };

//     const mockStateVarIndicator = {
//       isStruct: true,
//       referencingPaths: [{
//         getStructDeclaration: () => ({
//           members: [{ name: 'key1' }, { name: 'key2' }]
//         })
//       }],
//       structProperties: { key1: mockMappingKey, key2: {} },
//       increments: [],
//       decrements: []
//     };

//     const result = collectIncrements(mockStateVarIndicator);

//     expect(result.incrementsArray).to.deep.equal({ key1: [{ name: 'var1', precedingOperator: '+', accessed: undefined }], key2: [] });
//     expect(result.incrementsString).to.deep.equal({ key1: 'parseInt(var1, 10)', key2: '0' });
//   });

//   it('should return correct string for increments and decrements', function() {
//     const mockStateVarIndicator = {
//       increments: [
//         { nodeType: 'IndexAccess', name: 'var1', precedingOperator: '+', value: true, modName: 'modVar1' }
//       ],
//       decrements: [
//         { nodeType: 'IndexAccess', name: 'var2', precedingOperator: '-', value: true, modName: 'modVar2' }
//       ],
//       isStruct: false
//     };

//     const result = collectIncrements(mockStateVarIndicator);
    
//     expect(result.incrementsArray).to.deep.equal([
//       { name: 'var1', precedingOperator: '+', accessed: undefined },
//       { name: 'var2', precedingOperator: '-', accessed: undefined }
//     ]);
//     expect(result.incrementsString).to.equal('parseInt(modVar1, 10) + parseInt(modVar2, 10)');
//   });

// });


 


// // // Helper to convert __dirname for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Mocking external dependencies (example)
// const someExternalService = {
//   fetchData: () => Promise.resolve({ data: 'some data' })
// };

// describe("#extended unit testing of orchestration files", function () {
//   const orchestrationDirPath = options.orchestrationDirPath; // Ensure `options` is properly defined
//   const orchestrationFiles = fs.readdirSync(orchestrationDirPath).filter(file => file.endsWith('.mjs'));

//   orchestrationFiles.forEach(file => {
//     describe(`Testing functions in ${file}`, function () {
//       let orchestrationFile;

//       // Dynamically import the module before running the tests
//       // before(async function () {
//       //   try {
//       //     orchestrationFile = await import(path.join(__dirname, orchestrationDirPath, file));
//       //   } catch (err) {
//       //     this.skip(); // Skip all tests in this suite if import fails
//       //   }
//       // });

//     before(async function () {
//       try {
//         orchestrationFile = await import(path.join(__dirname, orchestrationDirPath, file));
//       } catch (err) {
//         assert.fail(`Failed to import ${file}: ${err.message}`);
//       }
//     });

//       // Ensure orchestrationFile is not undefined
//       it(`should import ${file} successfully`, function () {
//         assert(orchestrationFile, `Failed to import ${file}`);
//       });

//       (orchestrationFile ? Object.keys(orchestrationFile) : []).forEach(functionName => {
//         if (typeof orchestrationFile[functionName] === 'function') {
          
//           it(`should handle valid input for ${functionName}`, async function () {
//             const input = {};  // Define your valid input
//             const expectedOutput = 'expected output'; // Define expected output
//             const result = await orchestrationFile[functionName](input);
            
//             assert.strictEqual(result, expectedOutput, `Error in ${functionName} of ${file}`);
//           });

//           it(`should handle edge cases for ${functionName}`, async function () {
//             const edgeCaseInput = {}; // Define edge case input
//             const expectedEdgeCaseOutput = 'expected edge case output';
//             const result = await orchestrationFile[functionName](edgeCaseInput);
            
//             assert.strictEqual(result, expectedEdgeCaseOutput, `Error in ${functionName} for edge case`);
//           });

//           it(`should handle invalid input for ${functionName}`, async function () {
//             const invalidInput = {};  // Define invalid input
//             const resultPromise = orchestrationFile[functionName](invalidInput);
            
//             await assert.rejects(resultPromise, `Error in ${functionName} for invalid input`);
//           });

//           it(`should mock external service for ${functionName}`, async function () {
//             const stub = sinon.stub(someExternalService, 'fetchData').returns(Promise.resolve({ data: 'mocked data' }));
            
//             const result = await orchestrationFile[functionName]();
            
//             assert.strictEqual(result, 'mocked data', `Error in ${functionName} with mocked service`);

//             // Restore the original function after the test
//             stub.restore();
//           });

//         }
//       });
//     });
//   });
// });


});

