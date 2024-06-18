// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Receipt {

mapping (address => Rct) private total;

struct Rct {
uint256 amount;
uint256 tax;
}

Rct public cmt;

function add(Rct memory myrct) public {
total[msg.sender].amount += myrct.amount;
total[msg.sender].tax += myrct.tax;
cmt.amount += myrct.amount;
cmt.tax += myrct.tax;
}

function remove(Rct memory myrct) public {
total[msg.sender].amount -= myrct.amount;
total[msg.sender].tax -= myrct.tax;
cmt.amount -= myrct.amount;
cmt.tax -= myrct.tax;
}
}
