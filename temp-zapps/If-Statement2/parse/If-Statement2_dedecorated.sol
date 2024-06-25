// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Test {

mapping (address => uint) private x;
uint private z;
uint public a;

function fn1( uint y) public {
a = y;
if (x[msg.sender] == 5) {
z = y + 3;
} else {
x[msg.sender] = y + 1;
}
}

function fn2(uint p) public {
if (a == 0) {
z += p;
} else {
z = p + 1;
}
}

}
