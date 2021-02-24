// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./verify/Verifier_Interface.sol";

import "./merkle-tree/MerkleTree.sol";

import "./Escrow-imports/IERC20.sol"; // <<<<<<<<<<<<<<<<<< CUSTOM!

contract EscrowShield is MerkleTree {

	enum FunctionNames { deposit, transfer, withdraw } // <<< BPStatement

	Verifier_Interface private verifier;

	mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames):

	mapping(uint256 => uint256) public  nullifiers;

	mapping(uint256 => uint256) public commitmentRoots;

	uint256 public latestRoot;

	mapping(address => uint256) public zkpPublicKeys;

	struct Inputs {
		uint[] newNullifiers;
		uint commitmentRoot;
		uint[] newCommitments;
		uint[] customInputs;
	}

	IERC20 public erc20; // <<<<<<<<<<<<<<<<<< CUSTOM!

	constructor (
		address _erc20, // <<<<<<<<<<<<<<<<<< CUSTOM!
		address verifierAddress,
		uint256[][] memory vk
	) {
		erc20 = IERC20(_erc20); // <<<<<<<<<<<<<<<<<< CUSTOM!

		verifier = Verifier_Interface(verifierAddress);
		for (uint i = 0; i < vk.length; i++) {
			vks[i] = vk[i];
		}
	}

	// Can we somehow avoid this?
	function registerZKPPublicKey(uint256 pk) external {
		zkpPublicKeys[msg.sender] = pk;
	}

	function verify(
		uint256[] calldata proof,
		uint256 functionId,
		Inputs memory _inputs
	) private {

		uint commitmentRoot = _inputs.commitmentRoot;
		uint[] memory newNullifiers = _inputs.newNullifiers;
		uint[] memory newCommitments = _inputs.newCommitments;
		uint[] memory customInputs = _inputs.customInputs;

		require(commitmentRoots[commitmentRoot] == commitmentRoot, "Input commitmentRoot does not exist.");

		for (uint i; i < newNullifiers.length; i++) {
			uint n = newNullifiers[i];
			require(nullifiers[n] == 0, "Nullifier already exists");
			nullifiers[n] = n;
		}

		uint256[] memory inputs = new uint256[]((commitmentRoot > 0 ? 1 : 0) + newNullifiers.length + newCommitments.length + customInputs.length);

		// ORDER MUST MATCH THE CIRCUIT!!!
		uint k = 0;
		for (uint i = 0; i < customInputs.length; i++) {
			inputs[k++] = customInputs[i];
		}
		for (uint i = 0; i < newNullifiers.length; i++) {
			inputs[k++] = newNullifiers[i];
		}
		if (commitmentRoot > 0) inputs[k++] = commitmentRoot;
		for (uint i = 0; i < newCommitments.length; i++) {
			inputs[k++] = newCommitments[i];
		}

		bool result = verifier.verify(proof, inputs, vks[functionId]);
		require(result, "The proof has not been verified by the contract");

		if (newCommitments.length > 0) {
			latestRoot = insertLeaves(newCommitments);
			commitmentRoots[latestRoot] = latestRoot;
		}
	}

	function deposit(
		uint256 amount, // <<<<<<<<<<<<<<<<<< CUSTOM!
		uint256[] calldata newCommitments,
		uint256[] calldata proof
	) external {

		bool hasBalance = erc20.transferFrom(msg.sender, address(this), amount);
		require(hasBalance == true); // <<<<<<<<<<<<<<<<<< CUSTOM!

		Inputs memory inputs;
		inputs.newCommitments = newCommitments;
		inputs.customInputs = new uint[](1); // <<<<<<<<<<<<<<<<<< CUSTOM!
		inputs.customInputs[0] = amount;

		verify(proof, uint(FunctionNames.deposit), inputs);
	}

	function transfer(
		uint256 commitmentRoot,
		uint256[] calldata newNullifiers,
		uint256[] calldata newCommitments,
		uint256[] calldata proof
	) external {

		Inputs memory inputs;
		inputs.commitmentRoot = commitmentRoot;
		inputs.newNullifiers = newNullifiers;
		inputs.newCommitments = newCommitments;

		verify(proof, uint(FunctionNames.transfer), inputs);
	}

	function withdraw(
		uint256 amount, // <<<<<<<<<<<<<<<<<< CUSTOM!
		uint256 commitmentRoot,
		uint256[] memory newNullifiers,
		uint256[] calldata proof
	) external {

		bool success = erc20.transfer(msg.sender, amount);
		require(success, "ERC20 transfer failed"); // <<<<<<<<<<<<<<<<<< CUSTOM!

		Inputs memory inputs;
		inputs.commitmentRoot = commitmentRoot;
		inputs.newNullifiers = newNullifiers;
		inputs.customInputs = new uint[](1); // <<<<<<<<<<<<<<<<<< CUSTOM!
		inputs.customInputs[0] = amount;

		verify(proof, uint(FunctionNames.withdraw), inputs);
	}
}
