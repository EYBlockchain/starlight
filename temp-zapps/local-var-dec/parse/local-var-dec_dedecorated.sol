// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private x;

function assign(uint256 value) public {
uint256 y = value**2;
x = y;
}
}
