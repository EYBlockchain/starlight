// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Receipt {

mapping (address => uint256) private total;

struct Rct {
uint256 amount;
uint256 tax;
}

Rct public cmt;

function add(Rct memory myrct) public {
total[msg.sender] += myrct.amount + myrct.tax;
cmt .amount = myrct.amount;
cmt .tax = myrct.tax;
}

function remove(Rct memory invalidrct) public {
total[msg.sender] -= invalidrct.amount + invalidrct.tax;
cmt.amount = 0;
cmt.tax = 0;
}
}
