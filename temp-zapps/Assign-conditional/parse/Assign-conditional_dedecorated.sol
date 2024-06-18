// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
uint256 public b;
uint256 public c;
uint256 private result;
function add(uint256 value) public {
a += value;
result = (c > b? c: b);
} 
}
