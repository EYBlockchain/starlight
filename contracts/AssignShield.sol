// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./merkle-tree/MerkleTree.sol";

import "./verify/Verifier_Interface.sol";

contract AssignShield is MerkleTree {

	Verifier_Interface private verifier;

	enum FunctionNames { assign }

	mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames):

	mapping(uint256 => uint256) public commitmentRoots;

	uint256 public latestRoot;

	mapping(uint256 => uint256) public  nullifiers;


	constructor (
		address verifierAddress,
		uint256[][] memory vk
	) {
		verifier = Verifier_Interface(verifierAddress);
		for (uint i = 0; i < vk.length; i++) {
			vks[0] = vk[0];
		}
	}

	function assign (uint256[] calldata proof, uint256 commitmentRoot, uint256[] calldata newNullifiers, uint256[] calldata newCommitments) external {

		for (uint i; i < newNullifiers.length; i++) {
			require(nullifiers[newNullifiers[i]] == 0, "Nullifier already exists");
			nullifiers[newNullifiers[i]] = newNullifiers[i];
		}

		require(commitmentRoots[commitmentRoot] == commitmentRoot, "Input commitmentRoot does not exist.");

		uint256[] memory inputs = new uint256[](1 + newNullifiers.length + newCommitments.length); // the '1' is the commitmentRoot

		uint k = 0;
		for (uint i = 0; i < newNullifiers.length; i++) {
			inputs[k++] = newNullifiers[i];
		}
		for (uint i = 0; i < newCommitments.length; i++) {
			inputs[k++] = newCommitments[i];
		}
		inputs[k++] = commitmentRoot;

		bool result = verifier.verify(proof, inputs, vks[uint(FunctionNames.assign)]);
		require(result, "The proof has not been verified by the contract");

		latestRoot = insertLeaves(newCommitments);
		commitmentRoots[latestRoot] = latestRoot;

	}
}
