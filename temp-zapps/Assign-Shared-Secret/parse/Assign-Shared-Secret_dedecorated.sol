// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Swap {

mapping(address => uint256) public balances;
mapping(uint256 => address) public tokenOwners;
struct swapStruct{
uint256 swapAmountSent;
uint256 swapAmountRecieved;
uint256 swapTokenSent;
uint256 swapTokenRecieved;

}
uint256 pendingStatus;

mapping(address => swapStruct) swapProposals; 


function deposit(uint256 amount, uint256 tokenId) public {
balances[msg.sender] += amount;
tokenOwners[tokenId] = msg.sender;
}

function startSwap(address sharedAddress, uint256 amountSent, uint256 tokenIdSent, uint256 amountRecieved, uint256 tokenIdRecieved) public {

require(pendingStatus == 0);
swapProposals[sharedAddress].swapAmountSent += amountSent;
balances[msg.sender] -= amountSent; 
tokenOwners[tokenIdSent] = sharedAddress;
swapProposals[sharedAddress].swapTokenSent = tokenIdSent;
swapProposals[sharedAddress].swapAmountRecieved += amountRecieved;
swapProposals[sharedAddress].swapTokenRecieved = tokenIdRecieved;
pendingStatus = 1;

}

function completeSwap(address counterParty, address sharedAddress, uint256 amountSent, uint256 tokenIdSent, uint256 amountRecieved, uint256 tokenIdRecieved) public {

require(swapProposals[sharedAddress].swapAmountRecieved == amountSent && swapProposals[sharedAddress].swapTokenRecieved == tokenIdSent);
require(swapProposals[sharedAddress].swapAmountSent == amountRecieved && swapProposals[sharedAddress].swapTokenSent == tokenIdRecieved);
require(pendingStatus == 1);
swapProposals[sharedAddress].swapAmountSent -= amountRecieved;
swapProposals[sharedAddress].swapAmountRecieved -= amountSent;
balances[msg.sender] += amountRecieved - amountSent; 
balances[counterParty] += amountSent; 

tokenOwners[tokenIdSent] = counterParty;

tokenOwners[tokenIdRecieved] = msg.sender;
pendingStatus = 0;

}

function quitSwap(address sharedAddress, uint256 amountSent, uint256 tokenIdSent) public {

require(swapProposals[sharedAddress].swapAmountSent == amountSent && swapProposals[sharedAddress].swapTokenSent == tokenIdSent);
require(pendingStatus == 1);
swapProposals[sharedAddress].swapAmountSent -= amountSent;
balances[msg.sender] += amountSent; 
tokenOwners[tokenIdSent] = msg.sender;
swapProposals[sharedAddress].swapTokenSent = 0;
swapProposals[sharedAddress].swapTokenRecieved = 0;
swapProposals[sharedAddress].swapAmountRecieved = 0;
pendingStatus = 0;

}
}
