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

_"Danger, danger! High vault (us)age!"_

---

## Induction :zap:

zApps are zero-knowledge applications. They're like dApps (decentralised applications), but with privacy. zApps are tricky to write, but Solidity contracts are lovely to write.

- Write a Solidity contract
- Add a few new privacy decorators to the contract (to get a 'zappable' Solidity contract)
- Zappify that baby
- Get a fully working zApp in return

Solidity Contract > zappable Solidity Contract > zappify > zApp

### Install

Whilst the package is in early development, it isn't hosted on npm. To install:

`cd zappify`
`npm i -g ./`

This will create a symlink to your node.js bin, allowing you to run the commands specified in the `"bin":` field of the `package.json`; namely the `zappify` command.


### zappify

`zappify -i ./path/to/MyZappableContract.zsol`
Converts a zappable Solidity contract into a zApp. By default, the zApp is output to a `./zapps/` folder.

#### other options

`-o ./custom/output/dir/`
`-z customZappName` - otherwise files get output to a folder with name matching that of the input file.

`-h` for help.

## Developer

### Testing outputs

#### circuit

`zappify -i ./examples/cases/uninit_global/assign.zsol`

`cd zapps/assign/circuits`

`docker run -v $PWD:/app/code -ti docker.pkg.github.com/eyblockchain/zokrates-worker/zokrates_worker:1.0.8 /bin/bash`

`./zokrates compile --light -i code/assign.zok` <-- it should compile

### full zapp

`zappify -i ./examples/cases/uninit_global/assign.zsol`

`cd zapps/assign/`

`npm install`

(At this stage, you might need to run `chmod +x ./bin/setup && chmod +x ./bin/startup` for permission to execute the newly created shell scripts)

Start docker.

`./bin/setup` <-- this can take quite a while!

`npm test`

All the above use Docker in the background. If you'd like to see the Docker logging, run `docker-compose -f docker-compose.zapp.yml up` in another window before running.

NB: rerunning the test will not work, as the test script restarts the containers to ensure it runs an initialisation, removing the relevant dbs. If you'd like to rerun it from scratch, down the containers with `docker-compose -f docker-compose.zapp.yml down` and delete the file `zapps/assign/orchestration/common/db/preimage.json` before `npm test`.

---

## R&D Notes & Ideas

See (very incomplete) [preliminary notes](./doc/sprinkles-prelim-notes.md) for a flavour. The notes contain examples of inferring commitment and protocol structures from decorated Solidity.

---

## Miranda's test branch

To use this branch:

### Testing `removeDecorators`

-   Point the start command in `package.json` to your decorated contract
-   Run `npm start`

This first runs the `dedecorator`, which removes and stores the decorated syntax in your contract. The decorated solidity file is saved as `my_contract_dedecorated.sol` in the `contracts` folder. Its compiled ast is saved as `ast.json` in the root (for now).

The `redecorator` then adds back the decorated syntax to the ast, creating `my_contract_ast.json`, also saved to root.

### Testing compiler output


In `examples/cases`, there are collections of example output ZApps depending on the sprinkled contract input. At the moment only an uninitiated global is completed. To test:

- Run `truffle compile`
- Run `docker-compose build`
-   Run `./bin/setup` (this runs the trusted setup for the output.zok file, and stores the output vk in `db`)
-   Run `npm test` (this assigns and reassigns the private global variable)

Once assigned, the variable's private information is stored in `db/preimage.json`. Any further assignments use this information to nullify the last commitment. So if you have closed the containers or want to test the initial assignment, be sure to delete this file.


## Acknowledgements

- [Babel](https://babeljs.io)
