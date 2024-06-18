// SPDX-License-Identifier: CC0
pragma solidity ^0.8.0;
contract Assign {
uint256 private a;
uint256 private b;
uint256 public c;
function addB(uint256 value) public {
b += value;
}
function addC() public {
c += 2;
}
function addA(uint256 value) public {
a += value;
}
function remove(uint256 value) public {
addB(value);
addA(value);
addC();
}
}
