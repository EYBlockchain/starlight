# zappify :zap:

Generate a zApp from a Solidity contract.

_"So good it Hertz."_

_"An electrifying experience."_

_"I was shocked."_

_"Watts up?"_

_"Join the privacy resistance"_

_"Current privacy tech at its best."_

_"Ohm my gosh!"_

_"Free of charge"_

_"A brilliantly conducted project."_

_"Creates circuits; but not electrical ones."_

_"There's a clever pun around secure key vaults and volts to be had..."_

_"Do complicated maths, while staying grounded!"_

_"Static, yet moving forward."_

_"Received positively, with thunderous applause!"_

_"Danger, danger! High vault (us)age!"_ ...there it is

_"Contains a battery of new ideas!"_

_"An easy cell to developers that increases their capacity to develop Zero Knowledge solutions."_"

---

## Induction :zap:

zApps are zero-knowledge applications. They're like dApps (decentralised applications), but with privacy. zApps are tricky to write, but Solidity contracts are lovely to write.

- Write a Solidity contract
- Add a few new privacy decorators to the contract (to get a 'zappable' Solidity contract)
- Zappify that baby
- Get a fully working zApp in return

Solidity Contract --> zappable Solidity Contract --> zappify --> zApp

See [here](./WRITEUP.md) for an enormously detailed explanation of everything.

---

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Install](#install)
- [Run](#run)
  - [other options](#other-options)
- [Troubleshooting](#troubleshooting)
- [Developer](#developer)
  - [Testing](#testing)
    - [full zapp](#full-zapp)
    - [preliminary traversals](#preliminary-traversals)
      - [Adding new test cases](#adding-new-test-cases)
      - [Updating test cases](#updating-test-cases)
    - [circuit](#circuit)
  - [R&D Notes & Ideas](#rd-notes--ideas)
- [Acknowledgements](#acknowledgements)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Requirements

- Tested with Node.js v15 or higher.
  (Known issues with v13).

---

## Install

Whilst the package is in early development, it isn't hosted on npm. To install:

`cd zappify`

`npm i`

`npm i -g ./`

This will create a symlink to your node.js bin, allowing you to run the commands specified in the '`"bin":`' field of the `package.json`; namely the `zappify` command.

## Run

`zappify -i ./path/to/MyZappableContract.zsol`

... converts a zappable Solidity contract into a zApp. By default, the zApp is output to a `./zapps/` folder.

### CLI options

| option  | abbr.  | description  |
|:--|:--|:--|
| `--input <./path/to/contract.zsol>`  | `-i`  | Specify an input contract file with a `.zsol` extension.  |
| `--output <./custom/output/dir/>`  | `-o`  | Specify an output directory for the zApp. By default, the zApp is output to a `./zapps/` folder.  |
| `--zapp-name <customZappName>` | `-z`  | Otherwise files get output to a folder with name matching that of the input file.  |
| `--log-level <debug>`  | -  | Specify a Winston log level type.  |
| `--help`  | `-h`  | CLI help.  |


---

## Troubleshooting

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



---

## Developer

### Testing

#### full zapp

To test an entire output zApp:

Having already run `zappify`, the newly-created zApp will be located in the output dir you specified (or in a dir called `./zapps`, by default). Step into that directory:

`cd zapps/MyContract/`

Install dependencies:

`npm install`

Start docker.

(At this stage, you might need to run `chmod +x ./bin/setup && chmod +x ./bin/startup` for permission to execute the newly created shell scripts)

Run trusted setups on all circuit files:

`./bin/setup` <-- this can take quite a while!

Finally, run a test, which executes the function privately, using some test parameters:

`npm test`

All the above use Docker in the background. If you'd like to see the Docker logging, run `docker-compose -f docker-compose.zapp.yml up` in another window before running.

**NB: rerunning the test will not work**, as the test script restarts the containers to ensure it runs an initialisation, removing the relevant dbs. If you'd like to rerun it from scratch, down the containers with `docker-compose -f docker-compose.zapp.yml down` and delete the file `zapps/myContract/orchestration/common/db/preimage.json` before rerunning `npm test`.

#### preliminary traversals

Preliminary traversals populate the `binding` and `indicator` objects. This is some complex code, which is easy to break (when adding new functionality). To ensure none of this code gets accidentally broken, we have a test which compares actual vs expected objects, for a range of input contracts. (See code [here](./test/prelim-traversals/index.mjs))

`npm run-script test-prelim`  

##### To test a single file:

`npm run-script test-prelim -- --input fileName.zsol`

(Note all test-prelim files are stored in `./test/prelim-traversals/test-data` so no path is needed as input).

##### Adding new test cases

You can automate the creation of 'expected outputs' for these tests.

1. Create a `.zsol` file, around which you'd like a test to be created. For this example, suppose it's called `example-1.zsol`.
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

`./zokrates compile --light -i code/assign.zok` <-- it should compile



---

### R&D Notes & Ideas

See (very incomplete) [preliminary notes](./doc/sprinkles-prelim-notes.md) for a flavour. The notes contain examples of inferring commitment and protocol structures from decorated Solidity.

---

## Acknowledgements

- solc
- zokrates

Inspirational works:
- [Babel handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-scopes)
- [The Super Tiny Compiler](https://github.com/jamiebuilds/the-super-tiny-compiler)
