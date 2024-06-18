// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Test {

uint256 private z;

function add(uint256 j) public {
for(uint256 i =0 ; i<5 ; i++) {
for(uint256 k=0; k<2; k++) {
z += j;
}
}
}
}
