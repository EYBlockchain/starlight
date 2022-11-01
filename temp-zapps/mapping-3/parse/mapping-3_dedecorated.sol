// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Owner {
uint256 private a;
address private admin;
address private adminstartor;

constructor() {
admin = msg.sender;
adminstartor = msg.sender;
}
modifier onlyOwner() {
a+=3;
require(msg.sender == admin);
_;
}
modifier onlyUser() {
require(msg.sender == adminstartor);
_;
}
function alpha() private onlyOwner onlyUser {
require(msg.sender == adminstartor);

a+=3;
require(msg.sender == admin);

a+=1;
}
function beta() private onlyOwner onlyUser {
require(msg.sender == adminstartor);

a+=3;
require(msg.sender == admin);

a+=2;
}
}