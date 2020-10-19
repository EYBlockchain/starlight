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

`zappify -i ./path/to/MyZappableContract.zsol -o ./custom/output/dir/`

`zappify -h` for help.

---

## R&D Notes & Ideas

See (very incomplete) [preliminary notes](./doc/sprinkles-prelim-notes.md) for a flavour. The notes contain examples of inferring commitment and protocol structures from sprinkled Solidity.

---

## Miranda's test branch

To use this branch:

### Testing resprinkler

-   Point the start command in `package.json` to your sprinkled contract
-   Run `npm start`

This first runs the `desprinkler`, which removes and stores the sprinkled syntax in your contract. The desprinkled solidity file is saved as `my_contract_desprinkled.sol` in the `contracts` folder. Its compiled ast is saved as `ast.json` in the root (for now).

The `resprinkler` then adds back the sprinkled syntax to the ast, creating `sprinkled_ast.json`, also saved to root. Search for `sprinkle` in that new ast to find the syntax.

### Testing compiler output


In `examples/cases`, there are collections of example output ZApps depending on the sprinkled contract input. At the moment only an uninitiated global is completed. To test:

- Run `truffle compile`
- Run `docker-compose build`
-   Run `./bin/setup` (this runs the trusted setup for the output.zok file, and stores the output vk in `db`)
-   Run `npm test` (this assigns and reassigns the private global variable)

Once assigned, the variable's private information is stored in `db/preimage.json`. Any further assignments use this information to nullify the last commitment. So if you have closed the containers or want to test the initial assignment, be sure to delete this file.
