// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

// WARNING - the output shield contract is large and will not compile due to stack too deep
// removing intermediate variables works
// output zApp is still correct and all other components work

contract MyContract {

uint256 private a;
uint256 private b;

function setb(uint256 x) public {
b = x;
}

function incr(uint256 param1, uint256 param2) public {
a = a + param1 - param2;
}

function decr(uint256 param3) public {
a -= param3 - b;
}
}
