import solc from 'solc';
import fs from 'fs';
import path from 'path';
import logger from './utils/logger.js';
import { FilingError } from './error/errors.js';
// import config from 'config';
// import { releases } from './solc-versions-list';

// TODO: get this version getter working again...
// const getSolcVersion = contractName => {
//   console.log('getSolcVersion...');
//   const contractsFiles = fs.readdirSync(contractsPath);
//   const source = {};
//   console.log('CONTRACTSFILES:', contractsFiles);
//
//   contractsFiles.forEach(fileName => {
//     if (contractName === path.basename(fileName, '.sol')) {
//       // filename without '.sol'
//       const contractFullPath = path.resolve(contractsPath, fileName);
//       source[fileName] = {
//         content: fs.readFileSync(contractFullPath, 'utf8'),
//       };
//     }
//   });
//
//   // console.log('source:', source);
//
//   if (Object.keys(source).length === 0 && source.constructor === Object)
//     throw new Error(`Contract ${contractName} not found in ${contractsPath}.`);
//
//   const sourceCodeString = JSON.stringify(source);
//   const regex = new RegExp(/(?<=pragma solidity .)(0).*?(?=;)/g);
//   const solcVersion = sourceCodeString.match(regex);
//   console.log(`solcVersion for ${contractName} is ${solcVersion}`);
//   return solcVersion;
// };

function tidy(_line: string) {
  // trim whitespace
  let line = _line.replace(/\s+/g, ' ').replace(/^\s/, '');
  // remove comments
  if (line.startsWith('//')) return null;
  [line] = line.split('//');
  return line;
}

const buildSources = (file: any, options: any) => {
  const sources = {};
  const contractsFiles = [];
  const rl = file.split('\n');
  if (!options.topDir) options.topDir = path.dirname(options.inputFilePath);

  rl.forEach((line: string) => {
    line = tidy(line);
    if (line && line.startsWith('import')) {
      let relPath = line.match(/"([^"]+)"/)[1];
      if(!relPath.includes('@openzeppelin')) {

      const importPath = path.resolve(path.dirname(options.inputFilePath), relPath);

      relPath = path.relative(options.topDir, importPath);

      contractsFiles.push([importPath, relPath]);
      }
    }
  });

  // console.log('CONTRACTSFILES:', contractsFiles);

  contractsFiles.forEach(contractPath => {
    if (path.extname(contractPath[0]) === '.sol' && !contractPath[1].includes('@openzeppelin')) {
      const contractFile = fs.readFileSync(contractPath[0], 'utf8');

      // if import is an interface, we need to have contract e.g. IERC20 -> deploy ERC20
      const importContractName = path.basename(
        contractPath[1],
        path.extname(contractPath[1]),
      );

      

      if (
        importContractName.startsWith(`I`) &&
        contractFile.replace(/{.*$/, '').includes('interface')
      ) {
        const relPath = contractPath[1].replace(
          importContractName,
          importContractName.substring(1),
          );
        const importPath =   contractPath[0].replace(
          importContractName,
          importContractName.substring(1),
          );
          if(fs.existsSync(importPath)){
          sources[relPath] = {
            contents: fs.readFileSync(importPath, 'utf8'),
          };
        }
      }

      sources[contractPath[1]] = {
        contents: contractFile,
      };
      const contractOptions = {
        inputFilePath: contractPath[0],
        topDir: options.topDir,
      };
      const contractFileSources = buildSources(contractFile, contractOptions);
      Object.keys(contractFileSources).forEach(innerPath => {
        sources[innerPath] = {
          contents: contractFileSources[innerPath].contents,
        };
      });
    }
  });

  // console.log('SOURCES:', sources);

  return sources;
};


const createSolcInput = (solidityFile: string): any => {
  const input = {
    language: 'Solidity',
    sources: {
      input: {
        content: solidityFile,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': [],
          '': ['ast'],
        },
      },
    },
  };
  return input;
};

// const loadRemoteVersionAsync = async solcVersionRelease => {
//   return new Promise((resolve, reject) => {
//     solc.loadRemoteVersion(solcVersionRelease, (err, solcInstance) => {
//       if (err) {
//         reject(err);
//       } else resolve(solcInstance);
//     });
//   });
// };

/**
 * Shows when there were errors during compilation.
 * @param {Object} compiled - the output object from running solc
 */
const errorHandling = (compiled: any) => {
  if (!compiled) {
    throw new FilingError(`solc didn't create any output...`);
  } else if (compiled.errors) {
    // something went wrong.
    logger.error(`solc errors:`);
    compiled.errors.map((error: any) => logger.error(error.formattedMessage));
    throw new FilingError(
      `Solc Compilation Error: Make sure your .sol contract compiles without Zappify decorators.`
    );
  }
};

/**
  Compiles a solidity file and saves the output(s) (namely the AST) to file.
*/
const compile = (solidityFile: string, options: any) => {
  const sources = buildSources(solidityFile, options);
  const params = createSolcInput(solidityFile);
  const findImports = (_import: any) => {
    logger.debug('import:', _import);
    const importString = _import.toString();
    if (sources[importString] && !importString.includes('@openzeppelin')) {
      return {
        contents: sources[importString].contents,
      };
    } 
    if (importString.includes('@openzeppelin')) {
      const newimportString = 'node_modules/' + importString;
      return {
        contents: fs.readFileSync(newimportString, 'utf8'),
      };
    }
    throw new FilingError(`We couldn't find the import ${_import}`);
  };


  

  const compiled = JSON.parse(
    solc.compile(JSON.stringify(params), { import: findImports }),
  );
  logger.debug('compiled', compiled);
  errorHandling(compiled);
  

  const { ast } = compiled.sources.input;

  const astFilePath = `${options.parseDirPath}/${options.inputFileName}_dedecorated.sol_ast.json`;
 
  logger.debug('filepath', astFilePath);
  fs.writeFileSync(astFilePath, JSON.stringify(ast, null, 4));
  Object.keys(sources).forEach((importString) => { 
    const innerDir = path.dirname(importString);
    if (!fs.existsSync(`${options.contractsDirPath}/${innerDir}`)) {
      fs.mkdirSync(`${options.contractsDirPath}/${innerDir}`, { recursive: true });
    }
    const importFilePath = `${options.contractsDirPath}/${importString}`;
    fs.writeFileSync(importFilePath, sources[importString].contents);
  });

  return ast;
};

export default compile;

