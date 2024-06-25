// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Test {

uint256 public z;
uint256 private k;

function add(uint256 j) public {
uint256 i;
for(i =0; i<5; i++) {
z = j;
z = j+2;
if(z > 5) {
break;
}
else if(z < 10)
{
z= 4;
continue;
}
}
k= k+j;
}
}
