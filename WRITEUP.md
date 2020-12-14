# zappify :zap:

Generate a zApp from a Solidity contract.

---

## Induction :zap:

zApps are zero-knowledge applications. They're like dApps (decentralised applications), but with privacy. zApps are tricky to write, but Solidity contracts are lovely to write.

- Write a Solidity contract
- Add a few new privacy decorators to the contract (to get a 'zappable' Solidity contract)
- Zappify that baby
- Get a fully working zApp in return

Solidity Contract > zappable Solidity Contract > zappify > zApp

### Overview

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

### Compiler

To `zappify`, the compiler must take the decorated solidity file (a `.zsol` file) and complete the following (simplified) steps:
-   **parse**, takes the `zsol` code and analyses it
-   **transform**, changes the code into an abstract syntax tree (AST)
-   **transform** (again*), changes that AST into our special purpose ASTs
-   **generate code**, generates code for the output zApp

\* *since we are taking already working code and converting it into more working code of different language(s), this is technically a transpiler, not a compiler*

#### Parse

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

#### Transform

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

#### Code Generation

`TODO`

### What we done did so far

#### Commitment structure

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

##### To PK or not to PK

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

#### State variable IDs

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

#### Whole vs Partitioned states

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

##### (Un)Known

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

These decorators are only required on incrementing (`a += something`) statements
##### Limitations
##### Identification
##### Examples

#### Ownership
##### Partitioned states
##### Whole states

#### Sharing private data
