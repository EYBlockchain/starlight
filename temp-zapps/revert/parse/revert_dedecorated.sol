// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

uint256 private a;
address private admin;


constructor() {
admin = msg.sender;
}

function setAdmin(address newAdmin) public {
if(msg.sender == admin) {
revert(" revert ");
}
admin = newAdmin;
a+= 1;
}
}
