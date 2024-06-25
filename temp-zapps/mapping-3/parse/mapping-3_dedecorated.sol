// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

mapping(address => uint256) private a;
uint256 private b;
address public admin;

function assign(address param1, uint256 param2) public {
a[param1] += param2;
}

function assign2(uint256 param3) public {
a[msg.sender] = a[msg.sender] - param3;
b += param3;
}

function assign3(uint256 param5) public {
require(msg.sender == admin);
b += param5;
}
}
