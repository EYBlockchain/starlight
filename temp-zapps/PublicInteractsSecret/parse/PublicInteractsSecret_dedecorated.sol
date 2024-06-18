// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
uint256 private c;

uint256[] public b;

uint256 public index;
uint256 public j;

function add(uint256 value) public {
index++;
a += value + index;
index++;
index++;
c += value + j+index;
index++;
j++;
}

}
