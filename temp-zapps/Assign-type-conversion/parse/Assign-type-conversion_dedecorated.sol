// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint private a;

uint public b;

function add(uint256 addval) public {
a += uint(uint128(addval));
}

function remove(uint256 remval) public {
b -= uint(uint128(remval));
}
}
