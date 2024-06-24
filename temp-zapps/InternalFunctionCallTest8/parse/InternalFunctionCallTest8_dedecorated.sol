// SPDX-License-Identifier: CC0
pragma solidity ^0.8.0;
contract Assign {
uint256 private a;
uint256 private b;
uint256 public c;

function addB( uint256 value, uint256 value1) public {
c += value1;
a += value;
}
function addA( uint256 value) public {
a += value;
}

function remove3( uint256 value, uint256 value1 ) public {
b += value +a;
addA(value1);
b += value +a;
addB( value, value1);
a += value;
}

function remove4( uint256 value, uint256 value1 ) public {
b += value +a;
a += value;
addA(value1);
a += value;
addB( value, value1);
a += value;
b += value +a;
}



}