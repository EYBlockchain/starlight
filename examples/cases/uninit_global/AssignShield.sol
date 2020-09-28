// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

import "./MerkleTree.sol";
import "./Verifier_Interface.sol";

contract AssignShield is MerkleTree {

  Verifier_Interface private verifier;

  mapping(uint256 => uint256) public nullifiers;
  mapping(uint256 => uint256) public roots;
  uint256 public latestRoot;

  function assign(uint256 proof, uint256 root, uint256 nullifier, uint256 commitment) public {
    if (nullifier == 0 && root == 0 && latestRoot == 0) {
      // user is correctly assigning for the first time
    } else if (nullifier != 0) {
      require(nullifiers[nullifier] == 0, "Nullifier already exists");
      require(roots[root] == root, "Root does not exist");
      nullifiers[nullifier] = nullifier;
    } else revert("Nullifier for latest commitment not defined");

    bool res = verifier.verify(proof, [commitment, nullifier, root]); // assuming the verifier knows which vk and we deal with a public inputs hash later
    require(res, "The proof has not been verified by the contract");

    latestRoot = insertLeaf(commitment);
    roots[latestRoot] = latestRoot;
  }
}
