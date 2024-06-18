// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
uint256 private b;
function add(uint256 value1, uint256 value2) public {
a += value1;
b += value2;
}

function remove(uint256 value) public {
if(a > b){
a -= value;
}

}
}
