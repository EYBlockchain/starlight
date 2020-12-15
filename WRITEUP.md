# zappify :zap:

Generate a zApp from a Solidity contract.

---

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Induction :zap:](#induction-zap)
- [Overview](#overview)
- [Compiler](#compiler)
  - [Parse](#parse)
  - [Transform](#transform)
  - [Code Generation](#code-generation)
- [What we done did so far](#what-we-done-did-so-far)
  - [Commitment structure](#commitment-structure)
    - [To PK or not to PK](#to-pk-or-not-to-pk)
  - [State variable IDs](#state-variable-ids)
  - [Whole vs Partitioned states](#whole-vs-partitioned-states)
    - [(Un)Known](#unknown)
    - [Limitations](#limitations)
    - [Identification](#identification)
    - [Examples](#examples)
  - [Ownership](#ownership)
    - [Partitioned states](#partitioned-states)
    - [Whole states](#whole-states)
  - [Sharing private data](#sharing-private-data)
    - [`share <secret> with <address / placeholder>`](#share-secret-with-address--placeholder)
    - [Placeholders](#placeholders)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Induction :zap:

zApps are zero-knowledge applications. They're like dApps (decentralised applications), but with privacy. zApps are tricky to write, but Solidity contracts are lovely to write.

- Write a Solidity contract
- Add a few new privacy decorators to the contract (to get a 'zappable' Solidity contract)
- Zappify that baby
- Get a fully working zApp in return

Solidity Contract > zappable Solidity Contract > zappify > zApp

## Overview

From the user's perspective, they write a 'normal' smart contract, like this one:

```
// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

contract Assign {

  uint256 private a;

  function assign(uint256 value) public {
    a = value;
  }
}

```
Then add decorators to tell the compiler which variables they want to keep secret:
```
// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

contract Assign {

  secret uint256 private a;

  function assign(secret uint256 value) public {
    a = value;
  }
}

```
They run `zappify -i <path/to/file>` and get an entire standalone zapp in return:

<img src= "doc/zappdir.png" width="250">

Easy!

(Not for us though...)

## Compiler

To `zappify`, the compiler must take the decorated solidity file (a `.zsol` file) and complete the following (simplified) steps:
-   **parse**, takes the `zsol` code and analyses it
-   **transform**, changes the code into an abstract syntax tree (AST)
-   **transform** (again*), changes that AST into our special purpose ASTs
-   **generate code**, generates code for the output zApp

\* *since we are taking already working code and converting it into more working code of different language(s), this is technically a transpiler, not a compiler*

### Parse

In this case, when we first transform the `.zsol` file into an AST, we're actually using `solc` to compile it as if it were a normal `.sol` file. However, `solc` would throw a hundred errors at us if we kept the special decorators like `secret` in there.

So the parsing stage (unlike a 'normal' compiler) looks through the code line by line and identifies decorators. It removes those decorators, saving their place, to output a working `.sol` file. We can then use `solc compile` to get a nice, ready-made Solidity AST! [Here](doc/littleast.json)'s a (very abridged) version of what the AST for the above example looks like.

This is the JSON way of saying:

![ast](doc/ast.png)

The parsing stage has saved all the locations of special `zsol` decorators for us. So the above `dedecoratedAST` can be `redecorated`. We turn a secret variable node from something like:
```json
{
    "id": 3,
    "mutability": "mutable",
    "name": "a",
    "nodeType": "VariableDeclaration",
    "stateVariable": true,
    "visibility": "private",
}
```
To:
```json
{
    "id": 3,
    "mutability": "mutable",
    "name": "a",
    "nodeType": "VariableDeclaration",
    "stateVariable": true,
    "visibility": "private",
    "isSecret": true,
}
```
For each decorated variable, statement, parameter, and function. This output `zsol` AST is then *traversed*.

### Transform

Now onto the transform (again) step, we look at every node in the custom `zsol` AST and collect all the information we need for our zApp. Which variables are secret? How many functions are there? What should our commitments look like? Has the user written something really stupid?

This step answers those questions, and more, with the magic of *traversals*. Each traversal takes us through the entire AST and stores information based on certain rules. In later traversals, we gradually build up new ASTs which represent output zApp code by traversing the `zsol` AST.

For now, lets look at the initial traversals, which check for errors and find secrets.

Before traversing:

-   Initialise `path` - a `NodePath` class which represents the whole AST and has a ton of useful associated methods
-   Initialise `scope` at `path.scope` - another class, `Scope`, which keeps track of states and logs all their edits and references throughout the `zsol` contract
-   Import and 'explode' visitors - visitors contain rules for traversing, separated by `NodeType` (e.g. do this when we find a `VariableDeclaration` node)

Then we call: `path.traverse(explode(visitor))`.

The `traverse` method tells us which order to visit nodes in.

For example, a `VariableDeclaration` node will have no children, so we must go back up the tree until we find a node with a sibling we haven't visited. Meanwhile, a `FunctionDefinition` node has children in three categories (or containers); `parameters`, `returnParameters`, and `body`. The traverse method knows to visit parameters first, since that tells us what variables will be used in the function, then move back up and visit the other children.

Using the `path` and `scope` objects, we fill in indicators for each secret state. These include:

-   `isSecret` - whether the user marked this variable as secret
-   `isModified` - whether the state has been modified in the contract
-   `isConsulted` - whether the state has been referenced to in assigning a new state
-   `isIncremented` - whether the state has been incremented e.g. `a += value`
-   `isWhole` - whether the state will be hidden in one commitment, which is overwritten each time it's edited or...
-   `isPartitioned` - whether the state will be hidden in lots of commitments, like Nightfall

We also have variable indicators at the function scope level, such as `oldCommitmentReferenceRequired` and `nullifierRequired`. Secret states might need to be nullified in one function(e.g. Nightfall burn), but not another (e.g. Nightfall mint).

Below is a flow guide up to this step!

![guide](doc/guide.png)

### Code Generation

`TODO`

## What we done did so far

### Commitment structure

We hide the value of secret states in commitments of structure:

```
h(stateVarId, value, ownerPublicKey, salt)
```

To identify which secret state this commitment is referring to, we use a unique state variable ID (discussed below). The `value` field refers to the value of the entire state if it is whole, or the part of the state owned by `ownerPublicKey` if partitioned. The `salt` is a random integer chosen to (among other things) prevent duplicates.

If the state is a mapping, the `stateVarId` field becomes `h(stateVarId, key)`.

These commitments have nullifiers of structure:

```
h(ownerSecretKey, salt)
```

#### To PK or not to PK

We spent a lot of time thinking about whether to *always* include an owner public key in the commitment, or *sometimes*, or *never*.
-   *Always*: Ensures a nice uniform commitment structure for every state and forces us/the dev to think about who the secret is secret to. However, this means more hashing and having to infer who the owner of a state is with code, which may not be right.
-   *Sometimes*: We can add a public key whenever it is needed and save on hashing and complexity when it's not, but lose the uniform commitment structure.
-   *Never*: Less hashing and complexity everywhere, and introduces the rule of 'you know the salt, so you are the owner'. This has a few complicated problems (discussed below).

Even considering never having a PK in the commitment might seem silly. But it's not that silly. In many examples we discovered that if the secret state is tied to some identity, then the PK naturally turns up in the commitment as a mapping key anyway.

```
secret mapping(address => uint256) balances;
<...>
balances[msg.sender] += value;
```

This secret state would have commitments (if we weren't including a PK by default):

```
h( h(balancesID, key = address), value, salt)
```

The protocol would convert an Ethereum address (the mapping key) to the owner's public key anyway. We'd need a PoKoSK whenever we see `msg.sender` because a Zokrates circuit doesn't have a concept of owning an address - so proving that you are `msg.sender` (which happens in the background of calling a contract) becomes proving that you own the secret key corresponding to whatever public key is in the commitment.

In short: whenever we see `msg.sender` in the `.zsol` contract, we probably need a PoKoSK in the circuit. 'Probably' becomes 'definitely' if that code block deals with secret states.

That observation lead to the question: if we need a PK in the commitment, would they be added as a mapping key *anyway*? So do we need to bother with a separate PK field?

For example:

```
secret mapping(uint256 => uint256) myMapping;
fn1(value1, value2) {
  (known) myMapping[value1] = value2;
}
```

Since we are overwriting a value, we need to nullify a previous commitment to call `fn1`. So, the user would need to provide the correct salt to the circuit to update `mymapping[value1]`, which does the same job as a PK would.

If the `.zsol` developer wanted to restrict who can edit this state, they would add:
```
require(msg.sender === someAddress);
```
Which would translate to a PoKoSK in the circuit, again doing the same job as a PK in the commitment. In the example of a Nightfall-like zApp, the owner's PK would be added to the mapping key field, and would not be needed.

However, there is one key (haha) problem with never having a PK in the commitment - transferring of ownership. With Nightfall, the mapping key would be changed to the receiver's address, so the PoKoSK in the circuit would change accordingly - great! What about other secrets?

Let's say we have a secret state `a` which is represented by a commitment `h(aVarId, value, salt)`. The dev wants a user of the zApp to be able to transfer ownership (i.e. nullification rights) to an other user. That's fine - and a good use of the zApp - so we should allow it. With the 'no PK in the commitment' rule, ownership is transferred by messaging the new user the salt. This seems ok, because this is how Nightfall's token transfer happens, but the previous owner *still knows the preimage to the nullifer*, meaning they can nullify it at any time, including after transferring ownership. Even if they don't, they still know when the new owner nullifies the commitment.

*Never* adding a public key to the commitment means that the 'owner' of a secret owns it forever. This removes nice transferability from any secret state (which doesn't include a key in its commitment as a mapping key), and there are plenty of states like that which (reasonably) should be transferable.

Adding a public key *sometimes* solves this. It does mean that the compiler needs to detect when:
-   There is no PoKoSK for a `msg.sender` check
-   There is no address mapping key which restricts state editors*

\*Looking for any address as a mapping key isn't enough here - there could be a zApp which secretly stores customer information by their address, but is editable by (and owned by) a system admin.

*Sometimes* also means that commitment structures are not uniform, which could be confusing to a Solidity dev who isn't familiar with zkp (and it's not as pretty). Plus, it implies that some secrets are owned and some are not - which is even more confusing, because a secret has to be secret to *someone*, or it's not secret! If we don't specify that someone, then the secret state is nullifiable by anyone who knows the salt, which could be a long list of previous owners.

This is a long explanation of why we eventually went with *always*. We infer ownership by looking for who can initialise and nullify the state (discussed below).

Another good reason for always adding a PK to the commitment is 'Zexe does it'.

### State variable IDs

How do we ensure that commitments refer to the correct secret variable? We may have many secret states with values hidden in many commitments, so we don't want a user to be able to edit state `b` by proving they own state `a`. There are a few choices:

-   Store the state name in the commitment
-   Store the variable id
-   Add a check inside the circuit

The latter point requires some complexity (especially when representing functions which edit more than one state) to get working and is unnecessarily messy. Meanwhile, names may not be unique (a bad developer might name a function and a variable `x`) and require more coding to extract and hash.

Using unique variable IDs mirrors Ethereum's state storage and are easily found from the solc AST. They also allow us to have secret mappings with commitments `h( h(stateVarId, mappingKey), value, ownerPublicKey, salt)`.

Each node in our AST has an id.
```json
{
    "id": 3,
    "mutability": "mutable",
    "name": "a",
    "nodeType": "VariableDeclaration",
    "stateVariable": true,
    "visibility": "private",
    "isSecret": true,
}
```
Every other node that references this node has a field `referencedDeclarition: 3`.

### Whole vs Partitioned states

Secret states are either *whole* or *partitioned*.

Whole states are overwritten each time they are edited. This means that only one commitment referencing its value can exist at once, and so the previous commitment must be nullified.

```py
secret uint256 a;

function fn1(secret uint256 value) {
    a = value;
}
```
Here, `a` is overwritten each time `fn1` is called, so whoever calls this function must show that they can nullify the previous commitment.

Partitioned states can be incremented by users who do not own or know its value. An example of this is lots of users contributing to a charity pot; nobody needs to know how much money is in the pot to add to it.

```py
secret uint pot;
address admin;

function add(secret uint value) {
  unknown pot = pot + value;
}

function withdraw(secret uint value) {
  require(msg.sender === admin);
  pot = pot - value;
}
```

We know that the dev doesn't want the secret value `pot` to be overwritten by `pot + value` every time, because they have specified our keyword `unknown`. This signifies that the caller of `add()` doesn't have to know the value of `pot` and doesn't have to provide a nullifier, so the secret state is partitioned.

This zApp will have many commitments of the form `h(potVarId, value, ownerPublicKey, salt)` where all the `value`s add up to the total of the `pot`. Only the admin can remove money from the pot, so theirs is the PK we add to the commitment (more on this in the ownership section). The admin removes money by providing a nullifier/nullifiers in `withdraw`.

#### (Un)Known

The new decorators introduced here are *known* and *unknown*. While we wanted the compiler's `zsol` code to be as close to normal Solidity as possible, we needed a way for the dev to tell us whether the state would be whole or partitioned.

Consider this example:
```py
secret uint a;

function fn1(secret uint value) {
  a = a + value;
}
```

The dev writing this `.zsol` could feasibly want either of these:
-   `a` is whole and overwritten by `fn1()`, requiring a nullifier and new commitment hiding `a + value`
-   `a` is partitioned and incremented by `fn1()`, requiring no nullifier, creating a new commitment on each call hiding `value`

To distinguish between these two cases, the known/unknown decorators refer to whether the caller knows the value of the state. A dev may not know what we mean by whole or partitioned (and they don't have to), but they should have an idea in mind of what the caller of each function wants to (and is allowed to) do.

-   `known a = a + value` - the caller must know the value of `a` and therefore knows what `a + value` is, so we hide it in one commitment which belongs to them
-   `unknown a = a + value` - the caller doesn't have to know `a` and so wants to increment it by some `value`, so we create a new commitment each time the function is called

These decorators are only required on incrementing (`a += something`) statements. Other statements (overwrites or decrements) all require nullifiers, and so can only be called by the owner. Overwrites automatically count as known, whole states whereas decrements don't tell us enough about the state. We need to look at where the state is initialised when we see a decrement.

#### Limitations

Both whole and partitioned states have complexities we need to consider.

The main issue with whole states is initialisation. Consider this (very simple) example:
```py
contract Assign {

  secret uint256 private a;

  function assign(secret uint256 value) public {
    a = value;
  }
}
```

In normal Solidity land, anyone could call `assign()` and change the value of `a`. It would be a mental free for all. Since, in zkp land, `a` is secret, we can't have anyone calling the function and changing it to whatever they want (meaning that `a` is secret for however many minutes until the next person comes along and changes it to their secret). This is probably not what the dev wanted.

We have already decided that overwritten states need a nullifier and a new commitment on each edit. But how do we first edit such a state?

Initialisation of a whole state *does* need a nullifier. Otherwise, any two people could submit two rival 'first' commitments, creating two versions of the secret state. We don't have this problem with partitioned states because, there, it's okay for many different commitments to represent one state.

Using our nice, uniform commitment structure, `h(stateVarId, value, ownerPublicKey, salt)`, it follows that nullifiers should contain the owner's secret key: `h(ownerSecretKey, salt)`. But, we again have the rival commitment problem - anyone two users could initialise `a` with this structure and submit *both* nullifiers. The shield contract would allow this because both could correctly prove ownership of their public keys, preimage of the new commitment, and that the nullifier doesn't already exist.

So, we can't have a 'normal' nullifier for initialisation. In some cases, we may be able to. For example, if a publicly known admin owns a state (and is known to own it before deployment), then the first submitted nullifier *can* have the corresponding admin's secret key. But this is an edge case - the state must have the same, pre-decided owner throughout its life hardcoded into the contract. (I think this admin address *could* be changed, but it would then lead to complications if the address was changed and two admins submitted rival nullifiers...)
#### Identification
#### Examples

### Ownership
#### Partitioned states
#### Whole states

### Sharing private data

Most meaningful blockchain transactions require data to be transmitted to one or more people. 'Transfers' are a good example; a sender must transmit details of the amount they've paid to a particular recipient. Of course, the blockchain takes care of this data transmission for us, because it _stores_ such data publicly in the ledger for all to see (be it as proper 'storage' or as cheaper event logs). The recipient can just 'lookup' what they need.
If we start to think about zApp transactions, we now don't want secret state variables or parameters to be revealed on-chain. How, then, does a transactor  transmit secret data to a counterparty (or counterparties)?

We have two main options:
1. Use an off-chain end-to-end encrypted messaging service.
1. Encrypt the secret data and submit the encrypted message to the blockchain, for the counterparty to decrypt.

Option 1 includes solutions like the now-deprecated Whisper and its descendants. The main problems with this approach are:
- message delivery is not guaranteed (e.g. if a server crashes);
- the transactor is not _forced_ to send the information (and so may never do so).

Option 2 can be achieved by encrypting the data _within_ the transaction's snark circuit, thereby forcing the transactor to share an encrypted message containing the correct secret data. An often-claimed downside to this approach is that such messages might be decryptable long in the future, but the same is true for all encrypted messages, and they're still used everywhere.

#### `share <secret> with <address / placeholder>`

Zappify will generate zApp code in line with data sharing Option 2; submission of encrypted secret data to the blockchain.

To this end, we find we need some new `zsol` syntax...

Consider the below examples:

```Solidity
secret mapping(address => uint) balances;

function transfer(secret uint value, secret address recipient) {
  balances[msg.sender] -= value;
  unknown balances[recipient] += value;
}
```

To a human brain, we can fairly quickly realise that the secret `value` and its associated `salt` should be transmitted to the owner of the `recipient` address. And, indeed, the compiler _will_ be able to realise this without any new syntax, through several complex traversals:
- The mapping is secret;
- The mapping maps from an address;
- Seeing that whenever ths secret mapping is nullified, its key is `msg.sender`;
- Inferring from this that the owner of a commitment to such a mapping's value must be the mapping's key. I.e. that `comm = h(h(0, key = addr), value, ownerPK = addr, salt)`

Here, the compiler would generate zApp code to enforce the sharing of the secrets `value` and `salt` with the messaging public key of the `recipient`. (SEE <INSERT LINK TO SUBHEADING> SECTION ON LINKING ETH ADDRESSES, COMMITMENT OWNERSHIP PUBLIC KEYS, AND MESSAGING PUBLIC KEYS... a difficult topic in itself).

But in the below example, we see that a dev's intentions might not match the default inferences that the compiler would make:

```Solidity
secret mapping(address => uint) balances;
address admin;

function transfer(secret uint value, secret address recipient) {
  balances[msg.sender] -= value;
  unknown balances[recipient] += value;
}
```

Here, the compiler would make the same inference as the first example; to share secret data with the `recipient`'s messaging public key. But suppose the developer _also_ wanted to share data with the `admin`'s messaging public key? There's no Solidity syntax which is analogous to this concept of sharing data, because _all_ data is _always_ shared with vanilla Solidity.

We therefore introduce new syntax:

`share <secret> with <address / placeholder>` (the 'placeholder' concept will be discussed later).

So for the developer to convey their intentions (for the `value` and corresponding `salt` to be shared with the `admin`*), they would add:

`share value with admin;`:

```Solidity
secret mapping(address => uint) balances;
address admin;

function transfer(secret uint value, secret address recipient) {
  balances[msg.sender] -= value;
  unknown balances[recipient] += value;
  share value with admin;
}
```

*Note: the compiler will still include code for the secret to be shared with the `recipient` address, due to the layout of this code snippet.

Note, if the dev wrote something like `share balances[recipient] with admin`, an error must be thrown, because `balances[recipient]` is `unknown` to the transactor.


#### Placeholders

Note: this section is pretty complicated, and it's so niche that it'll probably be on the backlog for ages.

To ensure we're not over-fitting to nightfall, consider this partial code snippet, which doesn't use a `mapping(address => ...)`:

```
// balls in buckets, indexed by bucketId
secret mapping(uint256 => uint256) numberOfBalls;

function moveBallsToThreePlaces(
    secret uint256 bucketId1,
    secret uint256 bucketId2,
    secret uint256 bucketId3,
    secret uint256 bucketId4,
    secret uint256 amount2,
    secret uint256 amount3,
    secret uint256 amount4
) {
    numberOfBalls[bucketId1] -= ( amount2 + amount3 + amount4 );
    unknown numberOfBalls[bucketId2] += amount2;
    unknown numberOfBalls[bucketId3] += amount3;
    unknown numberOfBalls[bucketId4] += amount4;
}
```

Here, instead of transferring money between addresses, we're transferring balls between buckets. Ignore the fact that this code doesn't include a function to initialise a bucket of balls; we're being lazy.

Since we don't have the neat case of a mapping from an address (`mappng(address => ...)`) the compiler won't be able to infer who it should share secret data with without some syntactic help.
The dev should therefore add `share <secret> with <address>` syntax. But since there are no addresses whatsoever in this contract, the dev can adopt 'placeholder' syntax instead:

```
// balls in buckets, indexed by bucketId
secret mapping(uint256 => uint256) numberOfBalls;

function moveBallsToThreePlaces(
    secret uint256 bucketId1,
    secret uint256 bucketId2,
    secret uint256 bucketId3,
    secret uint256 bucketId4,
    secret uint256 amount2,
    secret uint256 amount3,
    secret uint256 amount4
) {
    numberOfBalls[bucketId1] -= ( amount2 + amount3 + amount4 );
    unknown numberOfBalls[bucketId2] += amount2;
    unknown numberOfBalls[bucketId3] += amount3;
    unknown numberOfBalls[bucketId4] += amount4;
    share amount2 with 'a
    share amount3 with 'b
    share amount4 with 'b
}
```

Here, the dev is saying "Permit the caller of this function to share `amount2` with anyone. Permit the caller of this function to share `amount3` with anyone, but force them to also share `amount4` with that same person."

Pretty obscure example.
