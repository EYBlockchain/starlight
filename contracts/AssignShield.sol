// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

import "./merkle-tree/MerkleTree.sol";
import "./verify/Verifier_Interface.sol";

contract AssignShield is MerkleTree {

  Verifier_Interface private verifier;

  mapping(uint256 => uint256) public nullifiers;
  mapping(uint256 => uint256) public roots;
  mapping(uint256 => uint256[]) public vk;
  uint256 public latestRoot;

  constructor (
    address verifierAddress,
    uint256[] memory _vk
) {
    verifier = Verifier_Interface(verifierAddress);
    vk[0] = _vk;
}

  // function getVK() public view returns (uint256[] memory) {
  //   return vk[msg.sender];
  // }

  // function registerVk(uint256[] calldata _vk) public {
  //   vk[msg.sender] = _vk;
  // }

  function assign(uint256[] memory proof, uint256 root, uint256 nullifier, uint256 commitment) public {
    if (nullifier == 0 && root == 0 && latestRoot == 0) {
      // user is correctly assigning for the first time
    } else if (nullifier != 0) {
      require(nullifiers[nullifier] == 0, "Nullifier already exists");
      require(roots[root] == root, "Root does not exist");
      nullifiers[nullifier] = nullifier;
    } else revert("Nullifier for latest commitment not defined");

    uint256[] memory inputs = new uint256[](3);
    inputs[0] = root;
    inputs[1] = nullifier;
    inputs[2] = commitment;

    bool res = verifier.verify(proof, inputs, vk[0]);
    require(res, "The proof has not been verified by the contract");

    latestRoot = insertLeaf(commitment);
    roots[latestRoot] = latestRoot;
  }
}
