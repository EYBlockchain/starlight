// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract MyContract {

uint256 private a;
address public admin;

constructor() {
admin = msg.sender;
}

function assign(uint256 param1) public {
require(msg.sender == admin);
a = param1;
}
}
