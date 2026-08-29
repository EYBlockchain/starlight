import assert from 'assert';
import path from 'path';
import { toImportKey } from '../built/solc.js';

/**
 * Regression tests for import-path resolution in src/solc.ts (buildSources).
 *
 * solc's `findImports` callback always receives '/'-separated paths, so the keys
 * we register in the sources map must use '/' too. `path.relative` returns
 * OS-native separators, so `toImportKey` normalises them. The Windows case is
 * exercised with `path.win32` explicitly, so it runs identically on a Linux CI
 * and FAILS without the `.split(p.sep).join('/')` normalisation.
 */
describe('solc import-path key normalisation', function () {
  const importPathPosix = '/home/dev/contracts/Escrow-imports/IERC20.sol';
  const topDirPosix = '/home/dev/contracts';

  const importPathWin = 'C:\\Users\\dev\\contracts\\Escrow-imports\\IERC20.sol';
  const topDirWin = 'C:\\Users\\dev\\contracts';

  const expected = 'Escrow-imports/IERC20.sol';

  it('Linux/POSIX: yields a forward-slash import key', function () {
    const key = toImportKey(topDirPosix, importPathPosix, path.posix);
    assert.strictEqual(key, expected);
  });

  it('Windows: yields a forward-slash import key (fails without the fix)', function () {
    // Without normalisation this would be 'Escrow-imports\\IERC20.sol', which
    // never matches solc's '/'-separated key -> "couldn't find the import".
    const key = toImportKey(topDirWin, importPathWin, path.win32);
    assert.strictEqual(key, expected);
  });
});
