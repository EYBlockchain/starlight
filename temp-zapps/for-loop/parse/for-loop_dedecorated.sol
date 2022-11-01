// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

uint256 private a;
mapping(uint256 => uint256) private b;

function assign(uint256 param1, uint256 key, uint256 c) public {
a += param1;
b[key] += c;
}

function decra(uint256 param2) public {
a -= param2;
}

function decrb(uint256 param2, uint256 key) public {
b[key] -= param2;
}

function incra(uint256 param3) public {
a += param3;
}
}
