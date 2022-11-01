// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

uint256 private a;
address private admin;

constructor() {
admin = msg.sender;
}

function setAdmin(address newAdmin) public {
require(msg.sender == admin);
admin = newAdmin;
}


function assign(uint256 param1) public {
require(msg.sender == admin);
a = param1;
}
}
