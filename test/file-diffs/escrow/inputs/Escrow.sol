// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./IERC20.sol";

contract Escrow {

    address owner;
    mapping(address => uint256) balances;
    IERC20 public erc20;

    constructor(address _erc20) {
        owner = msg.sender;
        erc20 = IERC20(_erc20);
    }

    function deposit(uint amount) public {
        bool hasBalance = erc20.transferFrom(msg.sender, address(this), amount);
        require(hasBalance);
        balances[msg.sender] += amount;
    }

    function transfer(address recipient, uint256 amount) public {
        balances[msg.sender] -= amount;
        balances[recipient] += amount;
    }

    function withdraw(uint256 amount) public {
        balances[msg.sender] -= amount;
        bool success = erc20.transfer(msg.sender, amount);
        require(success, "ERC20 transfer failed");
    }
}
