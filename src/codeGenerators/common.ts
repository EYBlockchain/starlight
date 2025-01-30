import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

export interface localFile {
  filepath: string,
  file: string,
}

/**
 * @param file - a stringified file
 * @param contextDirPath - the import statements of the `file` will be
 * relative to this dir. This path itself is relative to process.cwd().
 * @returns - { filepath: 'path/to/file.zok', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */

export const collectImportFiles = (
  file: string,
  context: string,
  contextDirPath?: string,
  fileName: string = '',
) => {
  const lines = file.split('\n');
  let ImportStatementList: string[];

  switch (context) {
    case 'circuit':
      ImportStatementList = lines.filter(line => line.startsWith('from'));
      break;
    case 'contract':
      ImportStatementList = lines.filter(line => line.startsWith('import'));
      break;
    case 'orchestration':
      ImportStatementList = lines.filter(
        line =>
          (line.includes(`.mjs`) ||
            line.includes(`.json`) ||
            line.includes(`deploy.js`)) &&
          !line.includes('return') &&
          line.includes('import'),
      );
      break;
    default:
      throw new Error(`No file context: ${context}`);
  }
  let localFiles: localFile[] = [];
  // parse for imports of local (non-zokrates-stdlib) files:
  let localFilePaths: string[];
  switch (context) {
    case 'circuit': {
      contextDirPath ??= path.resolve(fileURLToPath(import.meta.url), '../../../circuits/');
      localFilePaths = ImportStatementList.reduce((acc: string[], line: string) => {
      let importFilePath = line.match(/"(.*?)"/g)[0].replace(/"/g, ''); // get text between quotes; i.e. the import filepaths
      importFilePath += path.extname(importFilePath) === '.zok' ? '' : '.zok'; // ensure file extension.
      // We need to provide common files which _aren't_ included in the zokrates stdlib. Stdlib filepaths start with the following:

      if (
          !(
            importFilePath.startsWith('utils') ||
            importFilePath.startsWith('ecc') ||
            importFilePath.startsWith('hashes') ||
            importFilePath.startsWith('signatures')
          )
        )
          acc.push(importFilePath);
        return acc;
      }, []);
      break;
    }
    case 'contract': {
      contextDirPath ??= path.resolve(fileURLToPath(import.meta.url), '../../../contracts/');
      localFilePaths = ImportStatementList.reduce((acc: string[], line: string) => {
        let importFilePath = line.match(/"(.*?)"/g)[0].replace(/"/g, ''); // get text between quotes; i.e. the import filepaths
        importFilePath += path.extname(importFilePath) === '.sol' ? '' : '.sol'; // ensure file extension.
        if (importFilePath) acc.push(importFilePath);
        return acc;
      }, []);
      break;
    }
    case 'orchestration': {
      contextDirPath ??= path.resolve(fileURLToPath(import.meta.url), './../../../src/boilerplate/');
      localFilePaths = ImportStatementList.reduce((acc, line) => {
        const importFilePath = line.match(/'(.*?)'/g)[0].replace(/'/g, ''); // get text between quotes; i.e. the import filepaths
        acc.push(importFilePath);
        return acc;
      }, []);
      break;
    }
    default:
      throw new Error(`No file context: ${context}`);
  }
  // collect the import files and their paths:
  for (const p of localFilePaths) {
    if (p.includes('IVerifier')) {
      localFilePaths.push('./Migrations.sol'); // TODO fix bodge
    }
    const absPath = path.resolve(contextDirPath, p);
    const relPath = path.relative('.', absPath);
    const exists = fs.existsSync(relPath);
    if (!exists) continue;
    const f = fs.readFileSync(relPath, 'utf8');
    const n = path.basename(absPath, path.extname(absPath));
    const shortRelPath = path.relative(path.resolve(fileURLToPath(import.meta.url), '../../../'), absPath);
    const writePath = context === 'orchestration' ? path.join(
      'orchestration',
      path.relative('./src/boilerplate', shortRelPath)
      ) : shortRelPath;
    if (context === 'contract') {
      // if import is an interface, we need to deploy contract e.g. IERC20 -> deploy ERC20
      if (
        n.startsWith(`I`) &&
        f.replace(/{.*$/, '').includes('interface') &&
        fileName !== n.substring(1) // otherwise we're trying to import this file's interface
      ) {
        // if we import an interface, we must find the original contract
        // we assume that any interface begins with I (substring(1)) and the remaining chars are the original contract name
        const newLocalPath = p.replace(n, n.substring(1));
        const newPath = shortRelPath.replace(n, n.substring(1));
        const check = fs.existsSync(newPath);
        if (check) {
          localFilePaths.push(newLocalPath);
        }
      }
    }

    localFiles.push({
      filepath: writePath, // the path to which we'll copy the file.
      file: f,
    });

    localFiles = localFiles.concat(collectImportFiles(f, context, path.dirname(relPath), context === 'contract' ? n : ''));
  }

  // remove duplicate files after recursion:
  const uniqueLocalFiles = localFiles.filter((obj, i, self) => {
    return self.indexOf(obj) === i;
  });

  return uniqueLocalFiles;
};
