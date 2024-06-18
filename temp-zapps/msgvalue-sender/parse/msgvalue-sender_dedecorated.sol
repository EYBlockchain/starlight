// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
address private admin;

function add(uint256 value) payable public {
admin = msg.sender;
a += value + msg.value;
}
}
