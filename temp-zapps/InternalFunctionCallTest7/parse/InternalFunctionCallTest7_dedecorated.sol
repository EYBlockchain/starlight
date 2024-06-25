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
function remove( uint256 value, uint256 value1 ) public {
addA(value1);
addB( value, value1);
}

function remove1( uint256 value, uint256 value1 ) public {
b += value +a;
addA(value1);
addB( value, value1);
}

function remove2( uint256 value, uint256 value1 ) public {
b += value +a;
a += value;
addA(value1);
addB( value, value1);
b += value +a;
}




}