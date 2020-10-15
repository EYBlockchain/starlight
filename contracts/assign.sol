// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

contract Assignment {

  secret uint256 public a;

  function assign(uint256 value) public {
      a = value;
  }
}
