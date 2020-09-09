// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

contract Mint {

  uint256 private totalSupply;
  // mapping     (address => uint256) private balances;

  constructor(){
    totalSupply = 10;
  }

  function mint(address account, uint256 amount) public {
    totalSupply += amount;
    // balances[account] += amount;
  }
}
