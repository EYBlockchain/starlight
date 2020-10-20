import solc from 'solc';
import fs from 'fs';

/**
  Compiles a solidity file and saves the output(s) (namely the AST) to file.
*/
const compile = (solidityFile, options) => {
  const params = {
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

  const compiled = JSON.parse(solc.compile(JSON.stringify(params)));

  const { ast } = compiled.sources.input;

  const astFilePath = `${options.parseDirPath}/${options.inputFileName}_desprinkled.sol_ast.json`;
  fs.writeFileSync(astFilePath, JSON.stringify(ast, null, 4));

  return ast;
};

export default compile;
