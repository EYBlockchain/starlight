// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Test {

mapping (address => uint) private x;
uint private z;
uint public a;
uint public b;

function add( uint y) public {
if (x[msg.sender] > 5) {
z = y + 3;
} else {
x[msg.sender] = y + 1;
}
}

function donw(uint p) public {
if (a > 5) {
b += p;
uint q;
q = q+2;
} else {
b = p + 1;
}
}

}
