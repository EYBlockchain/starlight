# sprinkles :doughnut:

Sprinkling privacy syntax over smart contracts.

Converting 'sprinkled' Solidity into a ZKP protocol.

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
