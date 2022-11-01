// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

uint256 private a;
uint256 private b;

function incr(uint256 param1) public {
a += param1;
b += param1;
}

function decr(uint256 param1) public {
a -= param1;
b += param1;
}
}
