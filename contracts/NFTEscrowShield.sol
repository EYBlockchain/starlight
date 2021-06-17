// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./verify/IVerifier.sol";
import "./merkle-tree/MerkleTree.sol";

import "./Escrow-imports/IERC721.sol";

contract EscrowShield is MerkleTree {


          enum FunctionNames { deposit, transfer, withdraw }

          IVerifier private verifier;

          mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames)

          mapping(uint256 => uint256) public nullifiers;

          mapping(uint256 => uint256) public commitmentRoots;

          uint256 public latestRoot;

          mapping(address => uint256) public zkpPublicKeys;

          struct Inputs {
            uint[] newNullifiers;
						uint commitmentRoot;
						uint[] newCommitments;
						uint[] customInputs;
          }


        function registerZKPPublicKey(uint256 pk) external {
      		zkpPublicKeys[msg.sender] = pk;
      	}



        function verify(
      		uint256[] calldata proof,
      		uint256 functionId,
      		Inputs memory _inputs
      	) private {

          uint[] memory customInputs = _inputs.customInputs;

          uint[] memory newNullifiers = _inputs.newNullifiers;

          uint commitmentRoot = _inputs.commitmentRoot;

          uint[] memory newCommitments = _inputs.newCommitments;

          for (uint i; i < newNullifiers.length; i++) {
      			uint n = newNullifiers[i];
      			require(nullifiers[n] == 0, "Nullifier already exists");
      			nullifiers[n] = n;
      		}

          require(commitmentRoots[commitmentRoot] == commitmentRoot, "Input commitmentRoot does not exist.");

          uint256[] memory inputs = new uint256[](customInputs.length + newNullifiers.length + (newNullifiers.length > 0 ? 1 : 0) + newCommitments.length);

          uint k = 0;

          for (uint i = 0; i < customInputs.length; i++) {
    			  inputs[k++] = customInputs[i];
    		  }

          for (uint i = 0; i < newNullifiers.length; i++) {
    			  inputs[k++] = newNullifiers[i];
    		  }

          if (newNullifiers.length > 0) inputs[k++] = commitmentRoot;

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


        mapping(address => uint256) public balances;


        IERC721 public erc721;


        constructor  (address _erc721, address verifierAddress, uint256[][] memory vk)  {

          erc721 = IERC721(_erc721);
verifier = IVerifier(verifierAddress);
    		  for (uint i = 0; i < vk.length; i++) {
    			  vks[i] = vk[i];
    		  }

        }


        function deposit (uint256 tokenId, uint256[] calldata newCommitments, uint256[] calldata proof) external {


          bool success = erc721.transferFrom(msg.sender, address(this), tokenId);
          require(success == true);

          Inputs memory inputs;

          inputs.customInputs = new uint[](1);
        	inputs.customInputs[0] = tokenId;

          inputs.newCommitments = newCommitments;

          verify(proof, uint(FunctionNames.deposit), inputs);

        }


        function transfer (uint256[] calldata newNullifiers, uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata proof) external {

          Inputs memory inputs;

          inputs.newNullifiers = newNullifiers;

          inputs.commitmentRoot = commitmentRoot;

          inputs.newCommitments = newCommitments;

          verify(proof, uint(FunctionNames.transfer), inputs);

        }


        function withdraw (uint256 tokenId, uint256[] calldata newNullifiers, uint256 commitmentRoot, uint256[] calldata proof) external {

          bool success = erc721.transferFrom(address(this), msg.sender, tokenId);
          require(success, "ERC721 transfer failed");

          Inputs memory inputs;

          inputs.customInputs = new uint[](1);
        	inputs.customInputs[0] = tokenId;

          inputs.newNullifiers = newNullifiers;

          inputs.commitmentRoot = commitmentRoot;

          verify(proof, uint(FunctionNames.withdraw), inputs);

        }
}
