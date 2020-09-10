// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

contract Mint {

  uint256 private totalSupply;
  uint256 public balance;
  // mapping     (address => uint256) private balances;

  function mint(address account, uint256 amount) public {
    balance = 5;
    totalSupply = 6;
    // balances[account] += amount;
  }
}
