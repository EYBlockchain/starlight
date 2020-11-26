***********************************************

ASSIGN TO UNINITIALISED GLOBAL

secret uint a;

function assign(secret uint value) {
    a = value;
}

***********************************************

ASSIGN TO INITIALISED GLOBAL

secret uint a = 1234;
//              ^^^

function assign(secret uint value) {
    a = value;
}

***********************************************

ASSIGN TO MULTIPLE UNINITIALISED GLOBALS

secret uint a;
secret uint b; // <<<

function assign(secret uint value1, secret uint value2) {
//                                               ^^^
    a = value;
    b = value; // <<<
}

***********************************************

ASSIGN WITH A PUBLIC VALUE

secret uint a;

function assign(uint value) {
//              ^^^
    a = value;
}

***********************************************

ASSIGN WITH SOME PUBLIC / SOME SECRET VALUES

secret uint a;
secret uint b; // <<<

function assign(secret uint value1, uint value2) {
//               ^^^               ^^^
    a = value;
    b = value; // <<<
}

***********************************************

ONLYOWNER MODIFIER - PUBLIC OWNER

secret uint a;
address owner; // <<<  _publicly visible_ owner address

function assign(secret uint value) {
    require(msg.sender == owner, "Not permitted to edit this state"); // <<<
    a = value;
}

***********************************************

ONLYOWNER MODIFIER - SECRET OWNER

secret uint a;
secret address owner; // _secret_ owner address
// ^^^

function assign(secret uint value) {
    require(msg.sender == owner, "Not permitted to edit this state");
    a = value;
}

***********************************************

INCREMENT AN UNINITIALISED GLOBAL

secret uint a;

function assign(secret uint value) {
    a += value;
//   ^^^
}

***********************************************
(Make sure incrementing `+=` works for all cases as with assignment `=`)
***********************************************

DECREMENT AN UNINITIALISED GLOBAL

secret uint a;

function assign(secret uint value) {
    a -= value;
//   ^^^
}

***********************************************
(Make sure decrementing `-=` works for all cases as with assignment `=`)
***********************************************

ASSIGN TO A MAPPING[uint256]

secret mapping(uint256 => uint256) myMapping;

function setMapping(uint256 value, uint256 key) {
//                                         ^^^
    myMapping[key] = value;
//            ^^^
}

***********************************************
(Make sure assignment to a `mapping` works for all cases as with a `uint256` state)
***********************************************

ASSIGN TO A MAPPING[msg.sender]

secret mapping(address => uint256) myMapping;

function setMapping(uint256 value) {
    myMapping[msg.sender] = value;
}

// NOTE: mappings from _addresses_ should be considered as very different from assignments from _uint256_. The former implies a proof of knowledge of secret key might be required; or that the state being accessed is known/unknown to the caller.

***********************************************

ASSIGN TO A MAPPING[someAddress]

secret mapping(address => uint256) myMapping;

function setMapping(uint256 value, address someAddress) {
//                                             ^^^
    myMapping[someAddress] = value;
//               ^^^
}

***********************************************
(Make sure assignment to a `mapping` works for all cases as with a `uint256` state)
***********************************************

INCREMENT A MAPPING[msg.sender]

secret mapping(address => uint256) myMapping;

function incrementMapping(secret uint256 increment) {
    myMapping[msg.sender] += increment;
//                        ^^^
//  myMapping[msg.sender] = myMapping[msg.sender] + increment;
}

***********************************************
(Make sure incrementing a `mapping` works for all cases as with a `uint256` state)
***********************************************

INCREMENT A MAPPING[someAddress] (i.e. potentially someone else's secret state)

secret mapping(address => uint256) myMapping;

function incrementMapping(
    secret uint256 increment,
    secret address someAddress
) {
    myMapping[someAddress] = myMapping[someAddress] + increment;
//                ^^^                      ^^^
}

(This might need additional syntax to specify whether myMapping[someAddress] should be known or `unknown` to the msg.sender)

***********************************************

BEGINNINGS OF A TRANSFER

secret mapping(address => uint256) myMapping;

function incrementMapping(
  secret uint256 increment,
  secret address someAddress
) {
    myMapping[msg.sender] = myMapping[msg.sender] - increment; // <<<
    myMapping[someAddress] = myMapping[someAddress] + increment;
}

***********************************************

MULTIPLE FUNCTIONS!

Combinations of all of the above functions, in one contract.
