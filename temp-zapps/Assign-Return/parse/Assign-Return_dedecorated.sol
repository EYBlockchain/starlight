// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
uint256 private b;

function add( uint256 value) public returns (bool, uint256) {
a += value;
return (true, 5);
}

function remove(uint256 value, uint256 value1) public returns (uint256, uint256) {

b -= value1;
a -= value;
return (b, a);
}
}
