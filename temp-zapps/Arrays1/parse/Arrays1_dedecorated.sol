// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;

uint256[] public b;

uint256 public index;

uint256 public j;

function add(uint256 value) public {
index++;
b[index] = index;
index++;
a = a + index;
index++;
b[index] = value;
}

function remove(uint256 value) public {
a -= value;
}
}