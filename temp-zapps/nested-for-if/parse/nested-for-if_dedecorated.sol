// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Test {

uint256 private total;
mapping (address => SomeStruct) public structs;

struct SomeStruct {
uint256 a;
uint256 b;
address c;
}

function add(uint256 j, bool iterate) public {
uint256 i;
for(i =0 ; i<5 ; i++) {
if(iterate == true) {
total += j;
structs[msg.sender].a = 5*j;
structs[msg.sender].b = total;
structs[msg.sender].c = msg.sender;
}
}
if (iterate == false) {
total = j;
structs[msg.sender].a = j;
structs[msg.sender].b = total;
structs[msg.sender].c = msg.sender;
}
}

}
