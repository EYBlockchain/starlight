// SPDX-License-Identifier: CC0

pragma solidity ^0.7.0;

import "./merkle-tree/MerkleTree.sol";
import "./verify/Verifier.sol";

contract AssignShield is MerkleTree {

  Verifier private verifier;

  mapping(uint256 => uint256) public nullifiers;
  mapping(uint256 => uint256) public roots;
  uint256 public latestRoot;

  constructor (
    address verifierAddress
) public {
    verifier = Verifier(verifierAddress);
}

  function assign(uint256[8] calldata proof, uint256 root, uint256 nullifier, uint256 commitment) public {
    if (nullifier == 0 && root == 0 && latestRoot == 0) {
      // user is correctly assigning for the first time
    } else if (nullifier != 0) {
      require(nullifiers[nullifier] == 0, "Nullifier already exists");
      require(roots[root] == root, "Root does not exist");
      nullifiers[nullifier] = nullifier;
    } else revert("Nullifier for latest commitment not defined");

    bool res = verifier.verifyTx([proof[0], proof[1]], [[proof[2], proof[3]], [proof[4], proof[5]]], [proof[6], proof[7]], [root, nullifier, commitment]); // assuming the verifier knows which vk and we deal with a public inputs hash later
    require(res, "The proof has not been verified by the contract");

    latestRoot = insertLeaf(commitment);
    roots[latestRoot] = latestRoot;
  }
}
