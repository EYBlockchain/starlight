// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
uint256 private b;
uint256 public index;


function add() public {
index=0;
a = index;
index = 10;
b = index; 
}

}