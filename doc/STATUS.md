# starlight :stars:

_Generate a zApp from a Solidity contract._

This document explains what Solidity functionality you can input to `starlight`, and what's on the horizon.


**Authors:** Michael Connor, Miranda Wood

---

## Example Contracts

You can find example `.zol` contracts ready to compile in the `./test/contracts` directory [here](../test/contracts/). These are all simple and illustrative of what the compiler can do. Meanwhile, we have some more familiar looking real world contracts in `./test/real-world-zapps` [here](../test/real-world-zapps/).

Do note that `NFT_Escrow.zol` and `LoanSimple.zol` don't currently compile - we are actively working on these!

## Current Functionality

 - Any combination of:
    - Any number of functions:
      - Standalone functions can be compiled, but note that functions cannot currently call each other.
      - External function calls are supported, as long as secret states aren't involved.
      - Some 'special' function calls, like `require()` are supported for public and secret states.
      - Constructors are supported, but be aware that the output shield contract will contain a constructor combining the `.zol` constructor and some extra functionality. If the constructor edits a secret state, note that it will create a one-time use zero knowledge circuit to perform the edit.
      - Functions can have any number of secret or public parameters of the types below.
    - Any number of states, secret or public:
      - Secret states can have types `uint256`, `address`, and `mapping`.
        - Keys of secret mappings can be `uint256` or `address`.
      - All other types (e.g. `bool`, `u32`) can be used as long as they aren't secret or interact with secret states.
      - Public and secret states *can* interact within functions, but this may break the output zApp or render its privacy useless.
      - Secret states can be *overwritten* on each edit (i.e. they are whole) or *incremented* on each edit (i.e. they are partitioned) - the compiler will work this out for you based on what states are known or unknown to the caller.
        - Don't worry if you're unsure where/what to mark - if you've missed something the compiler will let you know!
    - Operations:
      - Secret states can be calculated/be involved in calculations with `*`, `/`, `+`, `-`, `*=`, `+=`, `-=`.
        - Be aware of dividing integers - the output zApp will not know how to deal with decimals.
    - If Statements:
      - As long as you are *not* using a secret condition to edit a public state, if statements are supported.
    - Imports:
      - Any number of contracts can be imported into your .zol file, but as above, external calls with secret states aren't supported.
      - Interfaces are supported, just make sure your interface (e.g. `IERC20.sol`) is named `I` + the original contract name (e.g. `ERC20.sol`).
      - Note that `starlight` doesn't know if you have external contracts which require constructor arguments, make sure the resulting zApps migrations file is configured correctly.
        - We have hardcoded the constructor imports for `ERC20.sol` and `ERC721.sol`, since these are commonly used standard contracts.
    - Modifiers:
      - The compiler as is does not support modifiers such as `ownerOnly`, but it does support permissioning:
        - The AST nodes for modifiers can be pretty complicated, whereas nodes representing `require(msg.sender = someAddress)` aren't.
        - If possible, edit your modifiers to require statements like this at the beginning of each relevant function - they are a bit messier, but they do the same job.

## Unsupported Solidity

  Here we summarise the as of yet unsupported Solidity syntax. Some of these can be integrated relatively easily ('simple implementation') or are intrinsically complex ('complex implementation').

### Simple Implementation (Simplementation?)

- Require statements on secret states:
  - While we have [completed work](https://github.com/EYBlockchain/starlight/pull/91) on this, complex conditions inside the require call may not be transpilable to circuit code, so be aware.

- Enums and structs:
  - Public enums and structs would be easy to add - however, if these interact with secret states, we must have a robust system to convert them into something both nodejs and Zokrates understand.
  - Secret structs would require an extension of the current commitment scheme to involve more than one secret value hidden inside the commitment. This adds extra hashing (therefore constraints) and extra fields to check at each nullification.

  ### Complex Implementation


- If statements:
    - As long as the condition is secret and the computations on secret states, if statements are [supported](https://github.com/EYBlockchain/starlight/issues/33). However mixing a secret condition editing a public state is more complex.
- Assembly:
  - Inline assembly is often used in Solidity to save gas and/or perform complex operations. Copying over entirely public assembly to the output contract wouldn't be too difficult, whereas compiling assembly to Zokrates and possibly nodejs would be.
- Sharing secret data:
- Re-initialising whole secret states:
  - See the [writeup](./WRITEUP.md) sections on these for more details.
