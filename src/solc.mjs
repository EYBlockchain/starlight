import solc from 'solc';
import fs from 'fs';
import path from 'path';
// import config from 'config';
// import { releases } from './solc-versions-list';

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

function tidy(_line) {
  // trim whitespace
  let line = _line.replace(/\s+/g, ' ').replace(/^\s/, '');
  // remove comments
  if (line.startsWith('//')) return null;
  line = line.split('//')[0];
  return line;
}

const buildSources = (file, options) => {
  const sources = {};
  const contractsFiles = [];
  const rl = file.split('\n');
  if (!options.topDir) options.topDir = path.dirname(options.inputFilePath);

  rl.forEach(line => {
    line = tidy(line);
    if (line && line.startsWith('import')) {
      let relPath = line.substring(8, line.length - 3);

      const importPath = path.resolve(path.dirname(options.inputFilePath), relPath);

      relPath = path.relative(options.topDir, importPath);

      contractsFiles.push([importPath, relPath]);
    }
  });

  // console.log('CONTRACTSFILES:', contractsFiles);

  contractsFiles.forEach(contractPath => {
    if (path.extname(contractPath[0]) === '.sol') {
      const contractFile = fs.readFileSync(contractPath[0], 'utf8');
      sources[contractPath[1]] = {
        contents: contractFile,
      };
      const contractOptions = {
        inputFilePath: `${path.dirname(options.inputFilePath)}/${contractPath[1]}`,
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

const createSolcInput = solidityFile => {
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
  Compiles a solidity file and saves the output(s) (namely the AST) to file.
*/

const compile = (solidityFile, options) => {
  const sources = buildSources(solidityFile, options);
  const params = createSolcInput(solidityFile);
  function findImports(_import) {
    console.log(_import);
    if (sources[_import.toString()]) {
      return {
        contents: sources[_import.toString()].contents,
      };
    }
    return { error: 'File not found' };
  }
  const compiled = JSON.parse(solc.compile(JSON.stringify(params), { import: findImports }));
  console.log('compiled', compiled);

  const { ast } = compiled.sources.input;

  const astFilePath = `${options.parseDirPath}/${options.inputFileName}_desprinkled.sol_ast.json`;

  console.log('filepath', astFilePath);
  fs.writeFileSync(astFilePath, JSON.stringify(ast, null, 4));

  return ast;
};

export default compile;
