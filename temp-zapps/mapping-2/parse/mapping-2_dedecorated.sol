// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

mapping(address => uint256) private a;
address public admin;

constructor () {
admin = msg.sender;
}

function increment(uint256 param2) public {
a[msg.sender] += param2;
}

function decrement(address addr, uint256 param3) public {
require(msg.sender == admin);
a[addr] -= param3;
}

}
