// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {
uint256 private a;
event eventFunction(uint id);
function deposit(uint fid) public payable { 
a +=2; 
emit eventFunction(fid);
}
}
