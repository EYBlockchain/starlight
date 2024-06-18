// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;

uint256[5] public b;


function add(uint256[5] calldata value, uint256[5] calldata publicValue) public {
b = publicValue;
for (uint256 index = 0; index < 5; index++) {
a += value[index];
}
}

function remove(uint256 value) public {
a -= value;
}
}
