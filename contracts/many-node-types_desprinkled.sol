// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

contract Assignment {

  uint256 public global1;
  address public global2;
  mapping(address => uint256) public mapping1;

  function function1(uint256 param1_1) public {
      uint local1_1 = param1_1 * 2;
      global1 = local1 ** 2;
  }

  function function2(uint256 param2_1, address param2_2) public {
      mapping1[param2_1] = param2_1;
  }

  function function3(uint256 param3_1) public {
      mapping1[msg.sender] = param3_1;
  }

  function function4(uint256 param4_1) public {
    for (uint i = 0; i < param4_1; i++) {
      global1 = param4_1 ** 2;
    }
  }

  function function5(uint256 param5_1, uint256 param5_2) public {
    if (param5_1 < param5_2) {
      global1 = param5_1;
    } else {
      global1 = param5_2;
    }
  }

  function function6(uint256 param6_1) public {
    for (uint i = 0; i < 5; i++) {
      global1 = param4_1 ** 2;
    }
  }
}
