// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract FakeBank {

mapping(uint256 => uint256) public account;

function deposit(uint256 accountId, uint amountDeposit) public {
account[accountId] += amountDeposit;

}

function transfer(uint256 fromAccountId, uint256 toAccountId, uint256 amount) public {
account[fromAccountId] -= amount;
deposit(toAccountId, amount) ;
}

}
