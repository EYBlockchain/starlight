// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

mapping(address => uint256) public x;
uint256 public z;
uint256 private a;
uint256 private b;

function assignA() public {
a += x[msg.sender];
}

function assignBZ() public {
b += z;
}
}
