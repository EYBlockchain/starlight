// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

// WARNING - the output shield contract is large and will not compile due to stack too deep
// removing intermediate variables works
// output zApp is still correct and all other components work

contract MyContract {

mapping(address => uint256) public x;
address public y;
uint256 public z;
uint256 private a;
uint256 private b;
uint256 private c;

function incrb() public {
a += x[msg.sender];
b += x[y];
b += z;
c = x[y];
}
}
