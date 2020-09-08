# Sprinkles

Sprinkling privacy over regular smart contracts.

Mike's high-level notes.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Contents

- [Objective](#objective)
- [`secret`, `owned`, `known`, `anon` keywords](#secret-owned-known-anon-keywords)
  - [`secret`](#secret)
    - [secret to whom/who?](#secret-to-whomwho)
  - [`owned`](#owned)
  - [`known`](#known)
  - [`anon`](#anon)
- [Important cases](#important-cases)
  - [accumulate vs increment](#accumulate-vs-increment)
  - [One state editor or multiple state editors?](#one-state-editor-or-multiple-state-editors)
  - [Can we combine multiple secret variables into a single commitment?](#can-we-combine-multiple-secret-variables-into-a-single-commitment)
- [Inferring commitment structures from sprinkled solidity contracts](#inferring-commitment-structures-from-sprinkled-solidity-contracts)
  - [Example 0.1](#example-01)
    - [Example 0.2](#example-02)
  - [Example 1.1](#example-11)
    - [Example 1.2](#example-12)
    - [Example 1.3](#example-13)
    - [Example 1.4](#example-14)
    - [Example 1.5](#example-15)
    - [Example 1.6](#example-16)
  - [Example 2](#example-2)
  - [Example 3](#example-3)
  - [Example 4.1](#example-41)
    - [Example 4.2](#example-42)
  - [Example 5](#example-5)
  - [Example 6.1](#example-61)
    - [Example 6.2](#example-62)
  - [Example 7.1](#example-71)
    - [Example 7.2](#example-72)
  - [Example 8](#example-8)
  - [Example 9](#example-9)
  - [Example 10](#example-10)
  - [Example 11](#example-11)
  - [Example 12](#example-12)
  - [Example 13](#example-13)
  - [Example 14](#example-14)
  - [Example 15](#example-15)
  - [Example 16](#example-16)
  - [Example 17](#example-17)
  - [Example 18](#example-18)
- [Incomplete Discussion](#incomplete-discussion)
  - [Example 1](#example-1)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Objective

- Write a regular smart contract, with the functionality you want.

- Sprinkle the new keywords `secret`, `owned`, `known`, `anon` throughout the smart contract.

- Click ‘transpile’.

- Get the following zvm-compatible code:
  - zk-SNARK circuits
  - Node.js boilerplate to call the midnight client
  - extension contracts
  - (I.e. something which looks very much like a zApp's directory of files like we have in `midnight-demo` today)


## `secret`, `owned`, `known`, `anon` keywords

We introduce new keywords to Solidity. Let's call it 'Sprinkled Solidity'.

**NOTE** the more I think about it, we might be able to use `private` and `anonymous` as keywords, instead of the less-nice `secret` and `anon` words. I'd initially chosen `secret` and `anon` to avoid collisions with solidity's existing reserved keywords `private` and `anonymous`. But I think the context of (i.e. the location where we sprinkle) `private` and `anonymous` might be unambiguous, so the compiler might be able to distinguish them. Of course, that might be more of a headache, so distinct words might make life easier.

### `secret`

The `secret` keyword is a decorator for:
- _global_ storage declarations.
  - Not required for in-function memory or local stack declarations.
- function parameters
- functions

A variable declared as `secret` will be transpiled into a private, variable state, within a commitment.
A function declared as `secret` will be hidden via the ZVM's recursion.

Examples:

```solidity
contract MyContract {
  secret uint myStorageVariable;
// ^^^ secret state (will be wrapped in a commitment)

  secret function myFunction(secret uint myParam) external {
// ^^^ hide function          ^^^ secret parameter - will be
//     through ZVM.               privately used inside a circuit.
    myValue += myParam;

    /*
     * ! Unnecessary `secret` decorator for a local stack variable declaration.
     * Should flag a warning at compile time.
     * Local stack variables will be included in a SNARK circuit automatically  
     * if they interact with a `secret` storage variable or function parameter.
     */
    secret uint localStackVariable;

    /*
     * ! Unnecessary `secret` decorator for a memory variable declaration.
     * Should flag a warning at compile time.
     * `memory` variables will be included in a SNARK circuit automatically  
     * if they interact with a `secret` storage variable or function parameter.
     */
    secret uint[] memory localMemoryVariable;
  }
}
```

#### secret to whom/who?

A secret state MUST become secret to all observers of the blockchain. The secret state might be shared (off-chain) with multiple (trusted) parties; that's at the discretion of the secret holder.

**But who is the secret holder? To whom does a secret state _belong_?**

A secret state ‘belongs’ to the person(s) with editing rights to the state.

**How do we decide who can edit a secret state?**

To understand that, let's explore who can edit a conventional smart contract state. Permission to edit a state is dictated by `msg.sender`/`tx.origin` validation checks within in the functions of a smart contract.

A `msg.sender` who passes a function's validation checks should be able to edit a secret state.

Within a given function, for each assignment to a secret state, the transpiler should check the rest of the function body to see if there are any validation checks relating to `msg.sender`. If it finds such a validation check, the compiler will need to be wrap the private state in a commitment which gives editing rights to this `msg.sender`.

**How to we restrict editing rights to a secret state?**

We wrap the secret state in a commitment, and include the public key(s) of the editor(s) in the commitment's preimage too. Notice that a secret state might require multiple editors, depending on the application.

When do we need to prove we have permission (with a PoKoSK (proof of knowledge of secret key)) to update a secret state vs prove we know its preimage (without a PoKoSK)?If someone else is allowed to increment our secret state at some point, we’ll need a PoKoSK in order to use that state in future (e.g. when we’re transferred value vs when we want to transfer value).

**Some rough rules of thumb:**

If a secret state is used on the RHS of an equality, we need to prove that we know it (i.e. that we know the preimage of the commitment) – so we need to do a commitment preimage proof AND a merkle inclusion proof.

If a secret state is written to on the LHS of an equality, we need to prove that we have permission to update it.

### `owned`
See examples below. On lines where a `secret` variable is assigned to (edited), the variable being edited can be decorated with `owned` to tell the compiler that the caller of the function must _own_ the secret state which is being edited. This can cause the resulting commitment structure to hold _accumulated_ values, rather than _incremented_ values.

### `known`
Not too many examples, but feels important. See limited examples below. On lines where a `secret` variable is assigned to (edited), the variable being edited can be decorated with `known` to tell the compiler that the caller of the function must _know_ the secret state which is being edited (but might not necessarily _own_ the secret state being edited). The resulting protocol would include a check to ensure the executor of the function _knows_ the 'known' state (i.e. knows the commitment's preimage). Not sure if useful yet...

### `anon`

**Possibly too complex to implement in 'Phase 1' of development. And with newer thinking around the ZVM, this decorator might not be needed anymore.**

When a function is declared as `anon`, observers should not be able to learn who has actually called the function.

Decorator for function declarations.

Declared alongside the ‘visibility’ and ‘state mutability’ keywords.

Only worthwhile for ‘mutable’ functions (i.e. not used for `view` or `pure` functions).

Functions declared as `anon` will enforce that some/all references to `msg.sender` & `tx.origin` (etc.) get removed from the body of the function at transpilation!We MUST always assume that `anon` functions will be called by a relayer. Hence the eventual caller (executor) of the function on-chain (i.e. `msg.sender`/`tx.origin`) might not relate to the person with permission to change the state.

If a non-secret state is edited, and the back-trace of that assignment depends on `msg.sender`, then the reference to `msg.sender` MUST be removed during transpilation (because we MUST assume a relayer is being used when the `anon` decorator is used). The reference to `msg.sender` will need to be replaced with a new function parameter of type `address`. In cases where this reference to `msg.sender` is as a call to some other function, we can get a suggested name of this parameter from the function signature.

If a secret state is edited, and the trace of that assignment depends on `msg.sender`, then the reference to `msg.sender` MUST be removed during transpilation (because we MUST assume a relayer is being used). The reference to `msg.sender` will need to be replaced with a `zkpPublicKey` instead (with a corresponding PoKoSK in the accompanying circuit). Such references (to secret state edits derived from `msg.sender`) might ONLY BE when `msg.sender` is being mapped from (within a mapping)!
In most cases, `msg.sender` is "the person with knowledge of a secret key with permission to update some state".

## Important cases

### accumulate vs increment
**'Accumulate'**: the 'current state' of a secret state is contained inside a single commitment.
**'Increment'**: the 'current state' of a secret state is split across _multiple_ commitments; each commitment containing an 'incremental' value from a transaction which incremented the state. The 'current state' can therefore only be deduced by considering _all_ incremented states at once. This is similar to Nightfall; a user's balance is the sum of un-nullified commitments; each commitment containing an 'increment' to their global balance.

Back-trace all assignments of the secret variable.
If it’s inferred that the `msg.sender` can edit someone else’s secret state _(i.e. a secret state for which - on some line of code in the contract - it has been inferred that the state is edited directly from `msg.sender` (and hence ownership has been inferred), which on some other line of code is edited by, but does not necessarily belong to, `msg.sender`)_, then each incrementation of that state must sit in its own commitment. I.e. we break up the secret state into increments.

_“If `msg.sender` can edit states that aren’t his”_ – then **incrementing** is required.

_“If a secret state is only ever edited by its owner”_ – then **accumulating** is possible.

### One state editor or multiple state editors?
If the same secret state can be edited by more than one `msg.sender` (and direct ownership of the state hasn’t been ascribed to anyone), we need more than one state editor’s `zkpPublicKey` in the commitment.
_“If many `msg.senders` can edit the same state”_ (but still a closed group of msg.senders overall) - multiple `zkpPublicKey`s; one per member of the closed group of secret state editors. NOT QUITE: e.g. Nightfall transfers; anyone can _increment_ anoyone else's balance.
_“If only one `msg.sender` can edit a same state”_ - only 1 public key.

<!-- ### When DOESN'T a commitment need a publicKey inside?
If an incrementation of a commitment can be done by someone who isn’t the owner, then that person might know all of the contents of the commitment (e.g. the salt, value). Therefore we might need `zkpPublicKeyOfOwner` inside the commitment, so that only the owner can use it in future!
_"If anyone (not just the owner) can increment a secret state"_ - we might need the owner's `zkpPublicKey` inside the commitment.
_"If only the owner can increment a secret state"_ - (the commitment can hold an accumulated value, and...) the commitment might not need a secret state inside?????? -->

### Can we combine multiple secret variables into a single commitment?
We can, but that’s an optimization task, rather than a transpilation task.
If the many states could always sit next to each other in the merkle tree. (I.e. if they could always share a common path to the root!)
Whether or not to combine secret states will depend on the hashing functions used, the height of the tree, the number of states, the number of constants within a commitment, etc.



## Inferring commitment structures from sprinkled solidity contracts

Let's give some examples for how the compiler might decide on a commitment's structure (i.e. the values to be contained in the commitment's preimage).

Changes in code from the prior example are highlighted with arrows `<<<` or `^^^`.

### Example 0.1

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function setMapping
    (
        uint256 value
    )
    {
        myMapping[msg.sender] = value;
    }
}
```
Resulting commitment structure for an element of `myMapping`:
```
commitment = h(mappingID=0, key=zkpPublicKey, accValue, salt)
```
Resulting sketch protocol for the function:
```
- PoKoSK(zkpPublicKey)
- PoKo Preimage(commitment)
- Membership proof of commitment in accumulator (e.g. merkle tree)
- Calculate nullifier
- accValue = value
- Calculate new commitment
- // possible function hiding step, if the function is `secret`
- Non-membership proof of the nullifier (e.g. on-chain nullifier mapping == 0)
- Add new commitment to accumulator (e.g. merkle tree)
```
(Note: depending on whether this is a `secret` function (which uses the ZVM's `executePrivateFunction()`), these steps might spread across different circuits/node.js/solidity code.

#### Example 0.2

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function setMapping
    (
        uint256 value,
        address someAddress // <<<
    )
    {
        myMapping[someAddress] = value;
        //           ^^^
    }
}
```
Throw a compile error. Contradiction: `myMapping` cannot be `secret`, whilst also being entirely 'settable' by anyone. Either remove the `secret` decorator (to make it public); or add permissioning before assignment to `myMapping` (so that a 'secret holder' (owner) may be inferred - see Example 0); or change the assignment to an _incrementing_ of the value of `myMapping` (so that anyone can call this function and affect the secret state in a limited way - see Example x).


### Example 1.1

See also: [discussion](#incomplete-discussion).

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping // <<<
    (
        secret uint256 increment // <<<
    )
    {
        myMapping[msg.sender] = myMapping[msg.sender] + increment; // <<<
    }
}
```
Resulting commitment structure for an element of `myMapping`:
```
commitment = h(mappingID=0, key=zkpPublicKey, accValue, salt)
```
**Accumulate vs increment:** Accumulate, because references to elements of `myMapping` are always by `msg.sender`; so the secret state is only ever edited by its owner (the 'secret holder'), who by definition knows the entire secret state.
**One secret state editor or multiple secret state editors?** One, the owner of the state (`msg.sender`) is also the editor of the state.

Resulting sketch protocol for the function:
```
- PoKoSK(zkpPublicKey)
- PoKo Preimage(commitment)
- Membership proof of commitment in accumulator (e.g. merkle tree)
- Calculate nullifier
- accValue = accValue + increment
- // 'addition operator' => overflow checks required?
- Calculate new commitment
- // possible function hiding step, if the function is `secret`
- Non-membership proof of the nullifier (e.g. on-chain nullifier mapping == 0)
- Add new commitment to accumulator (e.g. merkle tree)
```
(Note: depending on whether this is a `secret` function (which uses the ZVM's `executePrivateFunction()`), these steps might spread across different circuits/node.js/solidity code.

#### Example 1.2

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping
    (
        uint256 increment // <<< `secret` removed
    )
    {
        myMapping[msg.sender] = myMapping[msg.sender] + increment;
    }
}
```
Note in this example, the increment is _public_ (not `secret`), and so would need to be _visible_ when executed on-chain.

#### Example 1.3

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping
    (
        uint256 increment
    )
    anon // <<< `anon` function decorator
    {
        myMapping[msg.sender] = myMapping[msg.sender] + increment;
    }
}
```
This function is decorated as `anon`, and so references to `msg.sender` need to be removed from any on-chain code.

#### Example 1.4

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping
    (
        uint256 increment
    )
    secret // <<< `secret` function decorator
    {
        myMapping[msg.sender] = myMapping[msg.sender] + increment;
    }
}
```
Probably throw a compiler error, stating that all parameters to a `secret` function MUST be `secret`. (Notice how `increment` doesn't have the `secret` decorator). (If the parameters were visible (not `secret`) when this function is executed, then the function itself wouldn't be `secret`, so there's a contradiction that needs to be resolved by the developer).

#### Example 1.5

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping
    (
        secret uint256 increment // <<< `secret` parameter decorator
    )
    secret
    {
        myMapping[msg.sender] = myMapping[msg.sender] + increment;
    }
}
```
Labelling a function as `secret` means the function MUST be hidden through recursion (e.g. using the ZVM).

Throw a compiler error on any `secret` function which tries to communicate with an external smart contract. (Difficult to deduce).

#### Example 1.6

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping
    (
        secret uint256 increment
    )
    secret anon // <<< `secret` AND `anon` function decorators
    {
        myMapping[msg.sender] = myMapping[msg.sender] + increment;
    }
}
```
In this example the `anon` decorator is superfluous. If the function is `secret`, then everything about the function must be hidden; including references to `msg.sender`.

Maybe log a compiler warning explaining, but this can still compile.


### Example 2

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress // <<<
    )
    {
        myMapping[msg.sender] = myMapping[someAddress] + increment;
        //                                    ^^^
    }
}
```

Here, the caller of the function (`msg.sender`) is updating a secret state that they own (`myMapping[msg.sender]`) by reference to _any other_ secret state (`myMapping[someAddress]`). This only makes sense (and is only possible) if the secret state (`myMapping[someAddress]`) is also _known_ to the `msg.sender`, (otherwise they wouldn't know the value `myMapping[someAddress]`). Importantly, it doesn't necessarily require the secret state (`myMapping[someAddress]`) to be _owned_ by the `msg.sender`.

Resulting commitment structure for `myMapping`:
```
commitment = h(mappingId=0, key=zkpPublicKey, accValue, salt)
```

**Accumulate vs increment:** Accumulate, because edits to elements of `myMapping` always back-trace to being performed by `msg.sender`; so the secret state is only ever edited by its owner (the 'secret holder'), who by definition knows the entire secret state. _Maybe the criterion for choosing 'accumulate' is "Because there's no need to increment"?_.
**One secret state editor or multiple secret state editors?** One, the owner of the state (`msg.sender`) is also the editor of the state.

Resulting sketch protocol for the function:
```
- PoKoSK(zkpPublicKey1) // prove ownership (editing rights) of myMapping[msg.sender]
- // notice how we don't need to prove ownership of myMapping[someAddress]; just knowledge of its contents
- PoKo Preimage(commitment1) // analogue to myMapping[someAddress]
- PoKo Preimage(commitment2) // analogue to myMapping[msg.sender]
- Membership proof of commitment1 in accumulator (e.g. merkle tree)
- Membership proof of commitment2 in accumulator (e.g. merkle tree)
- Calculate nullifier2
- accValue2 = accValue1 + increment
- // 'addition operator' => overflow checks required?
- Calculate newCommitment2
- // possible function hiding step, if the function is `secret`
- Non-membership proof of nullifier2 (e.g. on-chain nullifier mapping == 0)
- Add newCommitment2 to accumulator (e.g. merkle tree)
```


### Example 3

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        myMapping[someAddress] = myMapping[msg.sender] + increment;
        //           ^^^                      ^^^     <<< switched
    }
}
```
Here, the caller of the function (`msg.sender`) is updating a secret state that they _do not_ necessarily own (`myMapping[someAddress]`) by reference to a secret state that they _do_ own (`myMapping[msg.sender]`).

There's an ambiguity that the developer must address:

1. If `myMapping[someAddress]` is assumed to always be _owned by_ the `msg.sender`, then each commitment (for an element of `myMapping`) can be an _accumulated_ value. But it can only be an _accumulated_ value if the caller of the function is always allowed to edit the state `myMapping[someAddress]`.
1. If, on the other hand, `myMapping[someAddress]` might not necessarily be _owned by_ the `msg.sender`, then each commitment (for an element of `myMapping`) must be an _incremented_ value, so that anyone can increment the secret state, without having editing rights to the entire secret state (i.e. we preserve the secrecy of the secret state).
1. If, on the other other hand, we want to assume that `myMapping[someAddress]` is _known to_ the caller, but not necessarily _owned by_ the caller (i.e. the caller knows the contents of the secret state, but doesn't necessarily have editing rights), then each commitment (for an element of `myMapping`) must also be an _incremented_ value (as per (2.)), so that anyone can increment the secret state, without having editing rights to the entire secret state.

To resolve this ambiguity, we need to add two new keywords/decorators: `owned` or `known`.

We can rewrite the code in this Example 2:

1.
```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        owned myMapping[someAddress] = myMapping[msg.sender] + increment;
    //   ^^^
    }
}
```
The keyword `owned` makes clear that the secret state `myMapping[someAddress]` must be _owned_ by the caller of this function. With this keyword, the compiler can create commitments of accumulated values (because the compiler can be confident that the caller of this function will know the entire state, and has permission to edit the entire state):
```
commitment = h(mappingId=0, key=zkpPublicKey, accValue, salt)
```

Resulting sketch protocol for the function:
```
- PoKoSK(zkpPublicKey1) // prove ownership (editing rights) of myMapping[someAddress]
- PoKoSK(zkpPublicKey2) // prove ownership (editing rights) of myMapping[msg.sender]
- PoKo Preimage(commitment1) // analogue to myMapping[someAddress]
- PoKo Preimage(commitment2) // analogue to myMapping[msg.sender]
- Membership proof of commitment1 in accumulator (e.g. merkle tree)
- Membership proof of commitment2 in accumulator (e.g. merkle tree)
- Calculate nullifier2
- accValue2 = accValue1 + increment
- // 'addition operator' => overflow checks required?
- Calculate newCommitment2
- // possible function hiding step, if the function is `secret`
- Non-membership proof of nullifier2 (e.g. on-chain nullifier mapping == 0)
- Add newCommitment2 to accumulator (e.g. merkle tree)
```

2.
```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        myMapping[someAddress] = myMapping[msg.sender] + increment;
    }
}
```
Without the keyword `owned`, the caller of this function is assumed to not own the secret state `myMapping[someAddress]`. The compiler must err on the side of privacy and can create commitments of incremented values:
```
commitment = h(mappingId=0, key=zkpPublicKey, incrValue, salt)
```
Resulting sketch protocol for the function:
```
- PoKoSK(zkpPublicKey1) // prove ownership of myMapping[msg.sender]
- // notice how we don't need to prove ownership of myMapping[someAddress]; nor do we need to demonstrate knowledge of its contents, because its contents are assumed to not be `known`...
- PoKo Preimage(commitment1) // analogue to myMapping[msg.sender]
- Membership proof of commitment1 in accumulator (e.g. merkle tree)
- Membership proof of commitment2 in accumulator (e.g. merkle tree)
- Calculate nullifier1
- accValue2 = accValue1 + increment
- // 'addition operator' => overflow checks required?
- Calculate newCommitment
- // possible function hiding step, if the function is `secret`
- Non-membership proof of nullifier2 (e.g. on-chain nullifier mapping == 0)
- Add newCommitment2 to accumulator (e.g. merkle tree)
```

3.
```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        known myMapping[someAddress] = myMapping[msg.sender] + increment;
    //   ^^^
    }
}
```
With the keyword `known`, the caller of this function must demonstrate that they're 'know' the secret state `myMapping[someAddress]`; not that they're the _owner_ of the secret state. But if they're not the owner, then they don't have editing rights, and so the only effect we can permit them to have on the state is to _increment_ the secret state, not to edit an accumulation of the state. So the compiler must create commitments of incremented values.
BUT, there's a difficulty here. The caller can't demonstrate they 'know' an 'incremented' state, without demonstrating knowledge of _all_ un-nullified incremental commitments which make-up the 'whole' secret state. Creating a protocol for this would be _expensive_ in terms of constraints & gas cost. _For now, this should throw a compile error: too complex._


### Example 4.1

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        myMapping[someAddress] = myMapping[someAddress] + increment;
        //            ^^^                     ^^^
    }
}
```

Here, the elements of `myMapping` are declared as `secret`, and there's no `msg.sender`-related code to check permission to edit the state. Looking at the LHS of the assignment `=`, the caller of the function is trying to edit a secret state which they might not _own_. Perhaps, then, the compiler should only allow the caller to _increment_ the secret state; thereby preserving privacy; the caller doesn't need to know the secret state to edit it. Looking at the RHS, it might seem (at first glace) like the caller needs to _know_ the secret state `myMapping[someAddress]` in order to do the calculation, but if we store each incrementation of the state in a separate commitment, then the caller doesn't need to know the secret state at all; they can just submit an increment!

The resulting commitment structure for `myMapping` would be:
```
commitment = h(mappingId=0, key=zkpPublicKey, incrValue, salt)
```
Resulting sketch protocol for the function:
```
- // notice how we don't need to prove ownership of myMapping[someAddress]; nor do we need to demonstrate knowledge of its contents, because its contents are assumed to not necessarily be `known`...
- Calculate a newCommitment containing the increment, and the zkpPublicKey of the actual _owner_ of the secret state myMapping[someAddress]
- // possible function hiding step, if the function is `secret`
- Add newCommitment to accumulator (e.g. merkle tree)
```

Let's dwell on this a little longer. This example is very similar to Example 2 above, where we had `myMapping[msg.sender] = myMapping[someAddress] + increment;`. Notice how both examples have `myMapping[someAddress]` on the RHS, but in Example 2, we deduced that such a function would _only make sense_ if the caller _knew_ the state `myMapping[someAddress]`, and so in that case each commitment may contain an _accumulated_ value. The difference is that in Example 2, the states on the LHS and RHS didn't match, whereas in _this_ example, the LHS and RHS states _do_ match, so this example is effectively a simple `+=` incrementation, which a caller can do without knowing the state if we structure the commitments to be incrementations.

#### Example 4.2

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        owned myMapping[someAddress] = myMapping[someAddress] + increment;
    //   ^^^
    }
}
```

Here, we've added the `owned` keyword to indicate that the caller of the function must demonstrate that thet _own_ the secret state `myMapping[someAddress]` in order edit it. With this `owned` decorator, the compiler is able to create commitments containing _accumulated_ values, because it can be confident that the caller of the function will always know the contents of the entire secret state, and will have permission to edit the entire secret state.

The resulting commitment structure for `myMapping` would be:
```
commitment = h(mappingId=0, key=zkpPublicKey, accValue, salt)
```
Resulting sketch protocol for the function:
```
- PoKoSK(zkpPublicKey) // prove knowledge of myMapping[someAddress]
- PoKo Preimage(commitment) // analogue to myMapping[someAddress]
- Membership proof of commitment in accumulator (e.g. merkle tree)
- Calculate nullifier
- accValue2 = accValue1 + increment
- // 'addition operator' => overflow checks required?
- Calculate a newCommitment containing the increment, and the zkpPublicKey of the actual _owner_ of the secret state myMapping[someAddress]
- // possible function hiding step, if the function is `secret`
- Non-membership proof of nullifier (e.g. on-chain nullifier mapping == 0)
- Add newCommitment to accumulator (e.g. merkle tree)
```

A very different protocol has emerged, just because of the `owned` keyword.

Similarly to example 3, if we used the `known` keyword instead of `owned`, the protocol becomes so complicated that the compiler should just throw an error, for now.

### Example 5

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret address myAddress; // <<<

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        require(msg.sender == myAddress); // <<<
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }
}
```

This looks very similar to Example 4, with the addition of a check that `msg.sender == myAddress`.

It's a bit complicated, and I haven't settled on how this should compile (if at all).

It looks like only one person may execute this function (the owner of `myAddress`). But `myAddress` is declared as `secret`, which means the value can't be stored on-chain, and can't be hard-coded in a circuit (since circuit code will be shared with anyone who needs it). So how do we check this? We could wrap `myAddress` in its own commitment. But we'd need to somehow establish who `myAddress` is secret _to_ (i.e. who the _owner_ of the secret state `_myAddress` would be), in order to include their zkpPublicKey in the commitment.

Given that `myMapping` is only ever assigned-to in _this_ function, we might infer that all elements of `myMapping` are _owned_ entirely by the owner of `myAddress`, and therefore that we can hide a reference to `myAddress` inside the commitment(s) for `myMapping`. I.e. we'd create a zkpPublicKey analogue to `myAddress`, and we'd use that as the 'editing rights' key (or 'ownership' key).

Possible commitment structure for `myMapping`:
```
commitment = h(mappingId=0, key=someAddress, accValue, editorKey=zkpPublicKey (for myAddress), salt)
```
`zkpPublicKey` is included to restrict editing of the state.

A missing piece of the puzzle (and of the example code snippet) is how this data first gets submitted to the smart contract. We need to know how `myAddress` is first assigned. If (once the appropriate code to 'set' `myAddress` is added), control over editing `myAddress` is separate from editing rights to `myMapping`, then `myAddress` might need to reside in a separate commitment:
```
commitment for myAddress = h(stateId = 1, value of myAddress, zkpPublicKey of editor, salt)
```

If `myAddress` wasn't declared as `secret`, then it could be a public state in the public state tree (if using the ZVM). If the function was declared as `secret`, then the `myAddress` state could be privately referred to within a circuit. Otherwise, a check against `myAddress` could remain on-chain.

### Example 6.1

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret address myAddress;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        myMapping[msg.sender] = myMapping[msg.sender] - increment; // <<<
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }
}
```
Similar to transferring a balance using Nightfall's `transfer` function.

Resulting commitment structure for `myMapping`:
```
commitment = h(mappingId=0, key=zkpPublicKey, incrValue, salt)
```

#### Example 6.2

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret address myAddress;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        myMapping[msg.sender] = myMapping[msg.sender] - increment;
        owned myMapping[someAddress] = myMapping[someAddress] + increment;
    //   ^^^
    }
}
```
With the `owned` keyword, we can _accumulate_ values, because the caller of the function must now _own_ the secret state `myMapping[someAddress]`, and so will have knowledge of the entire secret state. Notice, we don't need to decorate `myMapping[msg.sender]` as `owned`; it's implicity owned because `msg.sender` is the key.

Resulting commitment structure for `myMapping`:
```
commitment = h(mappingId=0, key=zkpPublicKey, accValue, salt)
```

### Example 7.1

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret address myAddress;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        require(msg.sender == myAddress); // <<<
        myMapping[msg.sender] = myMapping[msg.sender] - increment;
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }
}
```
Similar complexity to Example 5. A lot depends on how `myAddress` is set, and edited, which is missing from this code snippet.

Resulting commitment structure for `myMapping`:
```
commitment = h(mappingId=0, key=zkpPublicKey, incrValue, salt)
```
(Or perhaps an error is thrown, because we need more code to know how `myAddress` is set?)

#### Example 7.2

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret address myAddress;

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        require(msg.sender == myAddress);
        myMapping[msg.sender] = myMapping[msg.sender] - increment;
        owned myMapping[someAddress] = myMapping[someAddress] + increment;
    //   ^^^
    }
}
```
With the `owned` keyword, we can _accumulate_ values, because the caller of the function must now _own_ the secret state `myMapping[someAddress]`, and so will have knowledge of the entire secret state. Notice, we don't need to decorate `myMapping[msg.sender]` as `owned`; it's implicity owned because `msg.sender` is the key.

Resulting commitment structure for `myMapping`:
```
commitment = h(mappingId=0, key=zkpPublicKey, accValue, salt)
```
(Or perhaps an error is thrown, because we need more code to know how `myAddress` is set?)

### Example 8

```solidity
contract Example {

    secret mapping(uint256 => uint256) myMapping;
    //               ^^^

    function incrementMapping (
        secret uint256 increment,
        secret uint256 key // <<<
    )
    {
        myMapping[key] = myMapping[key] + increment;
        //        ^^^              ^^^
    }
}
```

### Example 9

```solidity
contract Example {

    secret mapping(uint256 => uint256) myMapping;
    secret address myAddress; // <<<

    function incrementMapping (
        secret uint256 increment,
        secret uint256 key
    )
    {
        require(msg.sender == myAddress); // <<<
        myMapping[key] = myMapping[key] + increment;
    }
}
```

```
commitment = h(mappingId=0, key, accValue, salt)
```

The `require` statement restricts only 1 person to execute this function; the person with the secret key to `myAddress`. So only 1 person can satisfy this `msg.sender` criterion. Given that `myMapping` doesn't appear in any other functions, it can only ever get updated by this 1 person. So `myMapping` is controlled entirely by 1 person. Therefore we can safely make _all elements_ of `myMapping` secret to this 1 person. So we don't need to have zkpPublicKey _inside_ the commitment; only a PoKoSK check somewhere inside the circuit. And because no one else updates it in any other function, we can make it accumulated.


### Example 10

```solidity
contract Example {

    secret mapping(uint256 => uint256) myMapping;
    secret address myAddress;

    function incrementMapping (
        secret uint256 increment,
        secret uint256 key1,
        secret uint256 key2 // <<<
    ) {
        require(msg.sender == myAddress);
        myMapping[key1] = myMapping[key1] + increment;
        myMapping[key2] = myMapping[key2] + increment; // <<<
    }
}
```


### Example 11

```solidity
contract Example {

    secret mapping(uint256 => uint256) myMapping;
    // <<<

    function incrementMapping (
        secret uint256 increment,
        secret uint256 key1,
        secret uint256 key2
    )
    {
        // <<<
        myMapping[key1] = myMapping[key1] + increment;
        myMapping[key2] = myMapping[key2] + increment;
    }
}
```

### Example 12

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping1 (
        uint256 increment
    )
    {
        myMapping[msg.sender] = myMapping[msg.sender] + increment;
    }

    function incrementMapping2 (
        secret uint256 increment,
        secret address someAddress
    )
    {
        myMapping[msg.sender] = myMapping[msg.sender] - increment;
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }
}
```

### Example 13

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret myAddress1;
    secret myAddress2;

    function incrementMapping1 (
        secret uint256 increment,
        secret uint256 key
    )
    {
        require(msg.sender == myAddress1);
        myMapping[key] = myMapping[key] + increment;
    }

    function incrementMapping2 (
        secret uint256 increment,
        secret uint256 key
    )
    {
        require(msg.sender == myAddress2);
        myMapping[key] = myMapping[key] + increment;
    }
}
```

AMBIGUOUS!

This is missing code to show how `myAddress1` and `myAddress2` are set.

RAMBLINGS:

Either:
```
commitment = h(mappingId=0, key, accValue, zkpPublicKey1, zkpPublicKey2, salt)
```
where `zkpPublicKey1` is the `zkp` analogue of `myAddress1`.
or:
```
commitment = h(mappingId=0, key, incrValue, salt)
```
or:
```
commitment = h(mappingId=0, key, accValue, salt)
```

Across both functions, permission is relative to two storage states (`myAddress1` or `myAddress2`). So (at most) only 2 people can satisfy these msg.sender criteria at any 1 time. Although `myMapping` is secret (to someone), it doesn't appear in any other functions, so it only ever gets updated by (at most) 2 people. Therefore we can safely make it secret to these people. In fact, every state mapped to by this mapping is controlled by these 2 people.

Do we need to have their zkpPublicKey1 & zkpPublicKey2 _inside_ the commitments?
Or merely a PoKoSK check somewhere inside the circuit?

And because no one else updates it in any other function, we can make it accumulated.

THERE IS AN AMBIGUITY, that I don't think can be overcome through inference (without more refined syntax for declaring secret stuff / more code).

ALSO, IS THIS (myAddress1/2) A SECRET STATE? (WE'LL ASSUME YES!!!)
// What changes if it is vs isn't? If it isn't, then this check MUST remain in the contract, and this function cannot be anonymous? There's a contradiction. We can't compare a secret thing (msg.sender is secret when the function is laballed 'anon') against a public thing (myAddress1) without revealing the secret thing! When there's a contradiction, we give up the secrecy? So this function cannot be anon?

Resulting commitment structure for `myMapping`:
```
commitment = h(mappingId=0, key=zkpPublicKey, accValue, salt)
```

### Example 14

```solidity
contract Example {

    secret mapping(address => uint256) myMapping1;
    secret mapping(address => uint256) myMapping2;
    secret address myAddress1;
    secret address myAddress2;

    function incrementMapping (
        secret uint256 increment,
        secret uint256 key
    ) {
        require(msg.sender == myAddress1);
        owned myMapping1[key] = myMapping1[key] + increment;
        owned myMapping2[key] = myMapping2[key] + increment;
    }

    function incrementMapping (
        secret uint256 increment,
        secret uint256 key
    ) {
        require(msg.sender == myAddress2);
        myMapping1[key] = myMapping1[key] + increment;
        myMapping2[key] = myMapping2[key] + increment;
    }
}
```

// What syntax could we use to distinguish the following ambiguous possibilities (or do they even need to be disambiguated)?:
// mappings 1 & 2 secret to both.
// mapping 1 owned by 1; 2 owned by 2.
// both mappings owned by 1.



### Example 15

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;

    function incrementMapping (
        secret uint256 increment,
        secret uint256 key1
    ) {
        require(msg.sender == myAddress);
        myMapping[key1] = myMapping[key1] + increment;
    }

    function incrementMapping (
        secret uint256 increment,
        secret uint256 key1
    ) {
        myMapping[key1] = myMapping[key1] + increment;
    }
}
```
Resulting commitment structure for `myMapping`:
```
commitment = h(mappingId=0, key, accValue, salt)
```
or:
```
commitment = h(mappingId=0, key, incrValue, salt)
```
// In the 2nd function, it's secret, but anyone can edit it? The first person to edit the state is the only person who can update it in future (because they'll be the only person who knows the salt)? How do we prevent someone else from re-'initialising' this variable into another commitment? Preventifier?

### Example 16

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret address myAddress1;
    secret address myAddress2;

    function incrementMapping (
        secret `uint256 increment,
        secret `uint256 someAddress
    )
    {
        require(msg.sender == myAddress1);
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        require(msg.sender == myAddress2);
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }
}
```

### Example 17

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret address myAddress1;
    secret address myAddress2;

    function incrementMapping (
        secret `uint256 increment,
        secret `uint256 someAddress
    )
    {
        require(msg.sender == myAddress1);
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        require(msg.sender == myAddress2);
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }

    function incrementMapping (
        secret `uint256 increment
    )
    {
        myMapping[msg.sender] = myMapping[someAddress] + increment;
    }

}
```

### Example 18

```solidity
contract Example {

    secret mapping(address => uint256) myMapping;
    secret address myAddress1;
    secret address myAddress2;

    function incrementMapping (
        secret uint256 increment,
        secret uint256 someAddress
    )
    {
        require(msg.sender == myAddress1);
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }

    function incrementMapping (
        secret uint256 increment,
        secret address someAddress
    )
    {
        require(msg.sender == myAddress2);
        myMapping[someAddress] = myMapping[someAddress] + increment;
    }

    function incrementMapping (
        secret uint256 increment
    )
    {
        require(msg.sender == myAddress2);
        myMapping[msg.sender] = myMapping[someAddress] + increment;
    }
}
```

## Incomplete Discussion

### Example 1

- `mappingID`: when there are multiple states in a contract, this will distinguish between them.
- `key`: We're converting a mapping; this is its key; the thing which maps to the state. In this case it's a `zkpPublicKey` to replace `msg.sender`.
- `accValue`: The private state. In this example, we're able to hold the _accumulated_ value in a single commitment, because the owner of the state is always the person who edits the state. In other examples, we'll need to hold the state across many commitments; holding just an _incremented_ value in each commitment. In such latter cases, knowledge of all of the incrementations will constitute knowledge of the state. (E.g. private transfers).
- `salt`: always required to prevent dictionary/rainbow attacks.

Let's try to deduce this commitment structure purely from the Solidity above.
- `mappingID:` There's only one mapping. This can be `0`. In fact, since there's only one mapping in the entire contract, this mappingID could be omitted altogether (a future optimization).
-

The compiler must consider the entire contract as a whole.
The developer wishes for `myMapping` to be secret (line (A)). So we'll need to decide on commitment structures to hold the values of `myMapping`. To decide (infer) this, we'll need to read more code in the contract.
- Find where `myMapping` is _edited_ in the contract. (I.e. look for `myMapping` on the LHS of the `=` assignment operator.)
  - Found within the function `incrementMapping` (line (B)).
    - Are there any references to `msg.sender` in the function?
      - Yes.
        - Deduce whether these references restrict permission to edit this `myMapping` state (difficult).
        - Is an element of `myMapping` ever _mapped-to_ by `msg.sender` (i.e. mappings of the form `myMapping[msg.sender]`)?
          - Yes.
          - Then each element of `myMapping` is editable by a different, individual user, so each element must be wrapped in its own commitment.
          - Then permission to edit a particular element of `myMapping`'s secret state will need to be restricted through a `zkpPublicKey` within a circuit. Whether that `zkpPublicKey` should be inside the commitment or outside it, merely within the circuit, requires more parsing.
- Is `myMapping` ever accessed via any key other than `msg.sender`?
  - No
    - Then the editor of the state doesn't need to refer to any other elements of `myMapping`. And each element in `myMapping` can become an accumulated value in a commitment.
