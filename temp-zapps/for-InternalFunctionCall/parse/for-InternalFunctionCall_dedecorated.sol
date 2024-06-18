// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;

function remove(uint256 value) public {
a -= value;
uint k;
for(k =0; k<6; k++) {
add(value);
}
}
function add(uint256 value) public {
a += value;
}
}
