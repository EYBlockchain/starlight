// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Test {

uint256 private z;

function add(uint256 j) public {
uint256 i;
uint256 k;
for(i =0 ; i<5 ; i++) {
for(k=0; k<2; k++) {
z += j;
}
}
}
}
