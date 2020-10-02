// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

contract Assignment {

  uint256 public a;

  function assign(uint256 value) public {
      uint sq = value ** 2;
      a = sq;
      a = sq + 5;
  }
}
