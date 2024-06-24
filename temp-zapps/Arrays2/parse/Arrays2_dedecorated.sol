// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;

uint256[] public b;

uint256 public index;

uint256 public j;

function add(uint256 value) public {
index++;
a += value + index;
b[index] = 0;
index = index +1;
b[index] = value;
index++;
j++;
b[index] = value +index +j;
index += 1;
a += value + index;
b[index] = value + index;
index++;
j++;
}

function remove(uint256 value) public {
a -= value;
}
}