// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Test {

uint256 private z;
uint256 private k;


function add(uint256 y) public {
if (y > 5) {
z = y + 3;
k = z + 4;
} else {
z = y + 1;
k = z + 5;
}
}

}