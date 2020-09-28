import yargs from 'yargs';
import fs from 'fs';
import solc from 'solc';
// import processLineByLine from './preprocessor.mjs';
import desprinkleLineByLine from './desprinkler.mjs';
import resprinkleAst from './resprinkler.mjs';
// import { node, solidity, zokrates } from './state.mjs';
import logger from './utils/logger.mjs';

const { argv } = yargs.usage('Usage: $0 -i <input file>').demandOption(['i']);
const sprinkled = fs.createReadStream(argv.i, 'utf-8');

const resprinkle = async (astPath, toResprinkle) => {
  console.log(toResprinkle);
  const newAst = await resprinkleAst(astPath, toResprinkle);
  fs.writeFileSync('./sprinkled_ast.json', JSON.stringify(newAst, null, 4));
};

const desprinkle = async () => {
  const res = await desprinkleLineByLine(argv.i);
  const [desprinkled, toResprinkle] = [res.desprinkledFile, res.toResprinkle];
  const params = {
    language: 'Solidity',
    sources: {
      input: {
        content: fs.readFileSync(desprinkled, 'utf-8'),
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

  // console.log(compiled);

  fs.writeFileSync('./ast.json', JSON.stringify(compiled.sources.input.ast, null, 4));

  // processLineByLine(desprinkled).then(() => {
  //   logger.info(`Node code generated:\n${node.src}`);
  //   logger.info(`Solidity code generated:\n${solidity.src}`);
  //   logger.info(`Zokrates code generated:\n${zokrates.src}`);
  // });

  await resprinkle('./ast.json', toResprinkle);
};

desprinkle();
