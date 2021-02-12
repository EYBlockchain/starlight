// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./verify/Verifier_Interface.sol";

import "./merkle-tree/MerkleTree.sol";

import "./Escrow-imports/IERC20.sol"; // <<<<<<<<<<<<<<<<<< CUSTOM!

contract EscrowShield is MerkleTree {

	enum FunctionNames { deposit, transfer, withdraw }

	Verifier_Interface private verifier;

	mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames):

	mapping(uint256 => uint256) public  nullifiers;

	mapping(uint256 => uint256) public commitmentRoots;

	uint256 public latestRoot;

	mapping(address => uint256) public zkpPublicKeys;

	IERC20 public erc20; // <<<<<<<<<<<<<<<<<< CUSTOM!


	constructor (
		address verifierAddress,
		uint256[][] memory vk,
		address _erc20 // <<<<<<<<<<<<<<<<<< CUSTOM!
	) {
		verifier = Verifier_Interface(verifierAddress);
		for (uint i = 0; i < vk.length; i++) {
			vks[0] = vk[0];
		}

		erc20 = IERC20(_erc20); // <<<<<<<<<<<<<<<<<< CUSTOM!
	}

	// Can we somehow avoid this?
	function registerKey(uint256 key) external {
		zkpPublicKeys[msg.sender] = key;
	}

	function deposit(
		uint256 amount, // <<<<<<<<<<<<<<<<<< CUSTOM!
		uint256[] calldata newCommitments,
		uint256[] calldata proof
	) external {

		bool hasBalance = erc20.transferFrom(msg.sender, address(this), amount);
		require(hasBalance == true); // <<<<<<<<<<<<<<<<<< CUSTOM!

		uint256[] memory inputs = new uint256[](1 + newCommitments.length); // The first literal is the number of custom inputs.

		// ORDER MUST MATCH THE CIRCUIT!!!
		uint k = 0;
		inputs[k++] = amount; // <<<<<<<<<<<<<<<<<< CUSTOM!
		for (uint i = 0; i < newCommitments.length; i++) {
			inputs[k++] = newCommitments[i];
		}

		bool result = verifier.verify(proof, inputs, vks[uint(FunctionNames.deposit)]);
		require(result, "The proof has not been verified by the contract");

		latestRoot = insertLeaves(newCommitments);
		commitmentRoots[latestRoot] = latestRoot;
	}


	function transfer(
		uint256[] calldata newNullifiers,
		uint256 commitmentRoot,
		uint256[] calldata newCommitments,
		uint256[] calldata proof
	) external {

		for (uint i; i < newNullifiers.length; i++) {
			require(nullifiers[newNullifiers[i]] == 0, "Nullifier already exists");
			nullifiers[newNullifiers[i]] = newNullifiers[i];
		}

		require(commitmentRoots[commitmentRoot] == commitmentRoot, "Input commitmentRoot does not exist.");

		uint256[] memory inputs = new uint256[](1 + 1 + newNullifiers.length + newCommitments.length); // The first literal is the number of custom inputs. The second (`1`) is the commitmentRoot. // <<<<<<<<<<<<<<<<<< CUSTOM!

		// ORDER MUST MATCH THE CIRCUIT!!!
		uint k = 0;
		for (uint i = 0; i < newNullifiers.length; i++) {
			inputs[k++] = newNullifiers[i];
		}
		for (uint i = 0; i < newCommitments.length; i++) {
			inputs[k++] = newCommitments[i];
		}
		inputs[k++] = commitmentRoot;

		bool result = verifier.verify(proof, inputs, vks[uint(FunctionNames.transfer)]);
		require(result, "The proof has not been verified by the contract");

		latestRoot = insertLeaves(newCommitments);
		commitmentRoots[latestRoot] = latestRoot;
	}

	function withdraw(
		uint256 amount,
		uint256[] calldata newNullifiers,
		uint256 commitmentRoot,
		uint256[] calldata proof
	) external {

		bool success = erc20.transfer(msg.sender, amount);
		require(success, "ERC20 transfer failed"); // <<<<<<<<<<<<<<<<<< CUSTOM!

		for (uint i; i < newNullifiers.length; i++) {
			require(nullifiers[newNullifiers[i]] == 0, "Nullifier already exists");
			nullifiers[newNullifiers[i]] = newNullifiers[i];
		}

		require(commitmentRoots[commitmentRoot] == commitmentRoot, "Input commitmentRoot does not exist.");

		uint256[] memory inputs = new uint256[](1 + 1 + newNullifiers.length); // The first literal is the number of custom inputs. The second (`1`) is the commitmentRoot. // <<<<<<<<<<<<<<<<<< CUSTOM!

		// ORDER MUST MATCH THE CIRCUIT!!!
		uint k = 0;
		for (uint i = 0; i < newNullifiers.length; i++) {
			inputs[k++] = newNullifiers[i];
		}
		inputs[k++] = commitmentRoot;

		bool result = verifier.verify(proof, inputs, vks[uint(FunctionNames.withdraw)]);
		require(result, "The proof has not been verified by the contract");
	}

}
