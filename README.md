# sprinkles :doughnut:

Sprinkling privacy syntax over smart contracts.

Converting 'sprinkled' Solidity into a ZKP protocol.

See (very incomplete) [preliminary notes](./doc/sprinkles-prelim-notes.md) for a flavour. The notes contain examples of inferring commitment and protocol structures from sprinkled Solidity.

---

## Miranda's test branch

To use this branch:

-   Point the start command in `package.json` to your sprinkled contract
-   Run `npm start`

This first runs the `desprinkler`, which removes and stores the sprinkled syntax in your contract. The desprinkled solidity file is saved as `my_contract_desprinkled.sol` in the `contracts` folder. Its compiled ast is saved as `ast.json` in the root (for now).

The `resprinkler` then adds back the sprinkled syntax to the ast, creating `sprinkled_ast.json`, also saved to root. Search for `sprinkle` in that new ast to find the syntax.
