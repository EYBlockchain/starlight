// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Owner {
uint256 private gm_account;
uint256 private admin12;
address private admin;
address private gamer;

constructor() {
admin = msg.sender;
gamer = msg.sender;
}
modifier onlyOwner(address _account , address _player) {
gm_account =gm_account+3;
admin12 = 3;
require(msg.sender ==admin);
require(msg.sender ==gamer);
_;
}
function alpha() private onlyOwner(admin , gamer) {
gm_account =gm_account+3;
admin12 = 3;
require(msg.sender ==admin);
require(msg.sender ==gamer);

admin12+=1;
}
}