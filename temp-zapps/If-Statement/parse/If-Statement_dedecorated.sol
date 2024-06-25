// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Test {

uint256 private z;
uint256 public a;
uint256 public b;

function add(uint256 y) public {
if (y > 5) {
z = y + 3;
} else {
z = y + 1;
}
if (a > 5) {
b += y;
}
}

}
