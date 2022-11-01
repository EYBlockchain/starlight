// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./verify/IVerifier.sol";
import "./merkle-tree/MerkleTree.sol";

contract MyContractShield is MerkleTree {


          enum FunctionNames { assignA, assignBZ, joinCommitments }

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


        constructor (
      		address verifierAddress,
      		uint256[][] memory vk
      	) {
      		verifier = IVerifier(verifierAddress);
      		for (uint i = 0; i < vk.length; i++) {
      			vks[i] = vk[i];
      		}
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

          uint[] memory newCommitments = _inputs.newCommitments;

          for (uint i; i < newNullifiers.length; i++) {
      			uint n = newNullifiers[i];
      			require(nullifiers[n] == 0, "Nullifier already exists");
      			nullifiers[n] = n;
      		}

          require(commitmentRoots[_inputs.commitmentRoot] == _inputs.commitmentRoot, "Input commitmentRoot does not exist.");

            uint256[] memory inputs = new uint256[](customInputs.length + newNullifiers.length + (newNullifiers.length > 0 ? 1 : 0) + newCommitments.length);
          
          if (functionId == uint(FunctionNames.assignA)) {
            uint k = 0;
            
            inputs[k++] = customInputs[0];
            inputs[k++] = customInputs[1];
            inputs[k++] = newCommitments[0];  
  						 	 inputs[k++] = 1;
          }

          if (functionId == uint(FunctionNames.assignBZ)) {
            uint k = 0;
            
            inputs[k++] = customInputs[0];
            inputs[k++] = newNullifiers[0];
            inputs[k++] = _inputs.commitmentRoot;
            inputs[k++] = newCommitments[0];  
  						 	 inputs[k++] = 1;
          }


         if (functionId == uint(FunctionNames.joinCommitments)) {
           uint k = 0;

           inputs[k++] = newNullifiers[0];
           inputs[k++] = newNullifiers[1];
           inputs[k++] = _inputs.commitmentRoot;
           inputs[k++] = newCommitments[0];
                inputs[k++] = 1;
         }
          
          bool result = verifier.verify(proof, inputs, vks[functionId]);

          require(result, "The proof has not been verified by the contract");

          if (newCommitments.length > 0) {
      			latestRoot = insertLeaves(newCommitments);
      			commitmentRoots[latestRoot] = latestRoot;
      		}
        }

           function joinCommitments(uint256[] calldata newNullifiers, uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata proof) public {

            bytes4 sig = bytes4(keccak256("joinCommitments(uint256[],uint256,uint256[],uint256[])"));

            Inputs memory inputs;

            inputs.customInputs = new uint[](1);
            inputs.customInputs[0] = 1;

            inputs.newNullifiers = newNullifiers;

            inputs.commitmentRoot = commitmentRoot;

            inputs.newCommitments = newCommitments;

            verify(proof, uint(FunctionNames.joinCommitments), inputs);
        }


        mapping(address => uint256) public x;


        uint256 public z;






      function assignA (uint256[] calldata newCommitments, uint256[] calldata proof) public  {

        

          Inputs memory inputs;

          inputs.customInputs = new uint[](3);
        	inputs.customInputs[0] = uint256(uint160(address(msg.sender)));
inputs.customInputs[1] = x[msg.sender];
inputs.customInputs[2] = 1;

          inputs.newCommitments = newCommitments;

          bytes4 sig = bytes4(keccak256("assignA(,uint256[],uint256[])")) ;  
 	 	 	 if (sig == msg.sig)

          verify(proof, uint(FunctionNames.assignA), inputs);
      }


      function assignBZ (uint256[] calldata newNullifiers, uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata proof) public  {

        

          Inputs memory inputs;

          inputs.customInputs = new uint[](2);
        	inputs.customInputs[0] = z;
inputs.customInputs[1] = 1;

          inputs.newNullifiers = newNullifiers;

          inputs.commitmentRoot = commitmentRoot;

          inputs.newCommitments = newCommitments;

          bytes4 sig = bytes4(keccak256("assignBZ(,uint256[],uint256,uint256[],uint256[])")) ;  
 	 	 	 if (sig == msg.sig)

          verify(proof, uint(FunctionNames.assignBZ), inputs);
      }
}