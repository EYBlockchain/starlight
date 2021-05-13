# starlight :night_with_stars:

Generate a zApp from a Solidity contract.

---

## Introduction

zApps are zero-knowledge applications. They're like dApps (decentralised applications), but with privacy. zApps are tricky to write, but Solidity contracts are lovely to write. So why not try to write a zApp with Solidity? `starlight` helps developers do just this...

- Write a Solidity contract
- Add a few new privacy decorators to the contract (to get a 'Zolidity' contract)
- Run `zappify`
- Get a fully working zApp in return

_Solidity contract --> Zolidity contract --> zappify --> zApp_

See [here](./doc/WRITEUP.md) for an enormously detailed explanation of everything.

---

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Quick User Guide](#quick-user-guide)
- [Install](#install)
- [Run](#run)
  - [CLI options](#cli-options)
- [Troubleshooting](#troubleshooting)
- [Developer](#developer)
  - [Testing](#testing)
    - [full zapp](#full-zapp)
    - [Preliminary traversals](#preliminary-traversals)
      - [To test a single file:](#to-test-a-single-file)
      - [Adding new test cases](#adding-new-test-cases)
      - [Updating test cases](#updating-test-cases)
      - [Adding/Updating _all_ test cases](#addingupdating-_all_-test-cases)
    - [circuit](#circuit)
- [Acknowledgements](#acknowledgements)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Requirements

To run the `zappify` command:
- Node.js v15 or higher.  
  (Known issues with v13).

To run the resulting zApp:
- Node.js v15 or higher.  
- Docker (with 16GB RAM recommended)

---

## Quick User Guide

Take a 'normal' smart contract, like this one:

```solidity
// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

  uint256 private a;

  function assign(uint256 value) public {
    a = value;
  }
}
```

Then add `secret` in front of each declaration you want to keep secret:
```solidity
// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

  secret uint256 private a; // <--- secret

  function assign(secret uint256 value) public { // <--- secret
    a = value;
  }
}
```

Save this decorated file with a `.zol` extension ('zolidity').

Run `zappify -i <./path/to/file>.zol` and get an entire standalone zapp in return!


---
## Install

Whilst the package is in early development, it isn't hosted on npm. To install:

Clone the repo.

`cd starlight`

`npm i`

`npm i -g ./`

This will create a symlink to your node.js bin, allowing you to run the commands specified in the `"bin":` field of the `package.json`; namely the `zappify` command.

## Run

`zappify -i ./path/to/MyZolidityContract.zol`

... converts a Zolidity contract into a zApp. By default, the zApp is output to a `./zapps/` folder.

### CLI options

| option  | abbr.  | description  |
|:--|:--|:--|
| `--input <./path/to/contract.zol>`  | `-i`  | Specify an input contract file with a `.zol` extension.  |
| `--output <./custom/output/dir/>`  | `-o`  | Specify an output directory for the zApp. By default, the zApp is output to a `./zapps/` folder.  |
| `--zapp-name <customZappName>` | `-z`  | Otherwise files get output to a folder with name matching that of the input file.  |
| `--log-level <debug>`  | -  | Specify a Winston log level type.  |
| `--help`  | `-h`  | CLI help.  |


---

## Troubleshooting

### Installation

If the `zappify` command isn't working, try the [Install](#install) steps again. You might need to try `npm i --force -g ./`.

In very rare cases, you might need to navigate to your node.js innards and delete zappify from the `bin` and `lib/node_modules`.
To find where your npm lib is, type `npm` and it will tell you the path.

E.g.:
```
~/.nvm/versions/node/v15.0.1/lib/node_modules/npm
                              ^
                              lib
                              ^
                              bin is also at this level
```

### Compilation

If you find errors to do with 'knownness' or 'unknownness', try to mark incrementations. If you have any secret states which can be **incremented** by other users, mark those incrementations as `unknown` (since the value may be unknown to the caller).

```solidity
// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

  secret uint256 private a; // <--- secret

  function add(secret uint256 value) public { // <--- secret
    unknown a += value; // <--- may be unknown to the caller
  }

  function remove(secret uint256 value) public { // <--- secret
    a -= value;
  }
}
```

However, if you want the incrementation to only be completed by the secret owner, mark it as known:

```solidity
// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

  secret uint256 private a; // <--- secret

  function add(secret uint256 value) public { // <--- secret
    known a += value; // <--- must be known to the caller
  }

  function remove(secret uint256 value) public { // <--- secret
    a -= value;
  }
}
```

Failing to mark incrementations will throw an error, because the transpiler won't know what to do with the state. See the [write up](./doc/WRITEUP.md) for more details.

If your input contract has any external imports, make sure those are stored in the `./contracts` directory (in root) and compile with `solc` 0.8.0.


---

## Developer

### Testing

#### full zapp

To test an entire zApp, which has been output by the transpiler:

Having already run `zappify`, the newly-created zApp will be located in the output dir you specified (or in a dir called `./zapps`, by default). Step into that directory:

`cd zapps/MyContract/`

Install dependencies:

`npm install`

Start docker.

(At this stage, you might need to run `chmod +x ./bin/setup && chmod +x ./bin/startup` for permission to execute the newly created shell scripts)

Run trusted setups on all circuit files:

`./bin/setup` <-- this can take quite a while!

Finally, run a test, which executes the function privately, using some test parameters:

`npm test` <-- you may need to edit the test file (`zapps/MyContract/orchestration/test.mjs`) with appropriate parameters before running!

It's impossible for a transpiler to tell which order functions must be called in, or the range of inputs that will work. Don't worry - If you know how to test the input Zolidity contract, you'll know how to test the zApp. The signatures of the original functions are the same as the output nodejs functions. There are instructions in the output `test.mjs` on how to edit it.

All the above use Docker in the background. If you'd like to see the Docker logging, run `docker-compose -f docker-compose.zapp.yml up` in another window before running.

**NB: rerunning the test will not work**, as the test script restarts the containers to ensure it runs an initialisation, removing the relevant dbs. If you'd like to rerun it from scratch, down the containers with `docker-compose -f docker-compose.zapp.yml down` and delete the file `zapps/myContract/orchestration/common/db/preimage.json` before rerunning `npm test`.

#### Preliminary traversals

Preliminary traversals populate the `binding` and `indicator` classes. This is some complex code, which is easy to break (when adding new functionality). To ensure none of this code gets accidentally broken, we have a test which compares actual vs expected objects, for a range of input contracts. (See code [here](./test/prelim-traversals/index.mjs))

`npm run-script test-prelim`  

##### To test a single file:

`npm run-script test-prelim -- --input fileName.zol`

(Note all test-prelim files are stored in `./test/prelim-traversals/test-data` so no path is needed as input).

##### Adding new test cases

You can automate the creation of 'expected outputs' for these tests.

1. Create a `.zol` file, around which you'd like a test to be created. For this example, suppose it's called `example-1.zol`.
1. Save it in `./test/prelim-traversals/test-data`.
1. Run `npm run-script test-prelim -- --write example-1`. This will run `zappify` on the file, and write output data to a file called `example-1.json`.
1. Future tests will use `example-1.json` as the 'expected' outcome of the test.

##### Updating test cases

Run the steps above.  
**Warning:** this will overwrite existing 'expected' data with new data.

##### Adding/Updating _all_ test cases

Use the flag `--write-all` instead of `--write <fileName`.  
**Warning:** this will overwrite all 'expected' test files. Only use if you know what you're doing.

#### circuit

`cd ./path/to/myCircuit.zok`

`docker run -v $PWD:/app/code -ti docker.pkg.github.com/eyblockchain/zokrates-worker/zokrates_worker:1.0.8 /bin/bash`

`./zokrates compile --light -i code/myCircuit.zok` <-- it should compile


---

## Acknowledgements

- [solc](https://github.com/ethereum/solc-js)
- [zokrates](https://github.com/Zokrates/ZoKrates)

Authors:

 - MirandaWood
 - iAmMichaelConnor

Inspirational works:
- [Babel handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-scopes)
- [The Super Tiny Compiler](https://github.com/jamiebuilds/the-super-tiny-compiler)
