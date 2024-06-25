// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

mapping(address => uint256) private a;

function increment(uint256 param2) public {
a[msg.sender] += param2;
}

function decrement(uint256 param3) public {
a[msg.sender] -= param3;
}

}
