// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;

function add(uint256 value) public {
a = a + 2 * value;
}

function remove(uint256 value) public {
add(value); // no oldCommitmentAccessRequired but the contract does for function remove
a -= value;

}



}
