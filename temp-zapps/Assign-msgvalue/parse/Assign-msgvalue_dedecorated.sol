// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
function add(uint256 value) payable public {
a += value + msg.value;
}
}
