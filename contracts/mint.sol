// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

contract Mint {

  uint256 private totalSupply;
  secret uint256 private balance;
  owned mapping (address => uint256) private balances;

  secret function mint() public {
    //balance = 5 - 6;
    secret balance = 6;
    totalSupply = 1;
    //balances[account] += amount;
  }
}
