// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;

uint256[] public b;

uint256 public index;


function add(uint256 value) public {
a += value;
b[index] = 0;
index++;
b[index] = value;
}

function remove(uint256 value) public {
a -= value;
}
}
