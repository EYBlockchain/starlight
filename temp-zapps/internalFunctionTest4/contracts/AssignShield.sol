// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./verify/IVerifier.sol";
import "./merkle-tree/MerkleTree.sol";

contract AssignShield is MerkleTree {


          enum FunctionNames { addB, addA, remove, addfn }

          IVerifier private verifier;

          mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames)

          uint256 public newNullifierRoot;

          mapping(uint256 => uint256) public commitmentRoots;

          uint256 public latestRoot;

          mapping(address => uint256) public zkpPublicKeys;

          struct Inputs {
            uint nullifierRoot; 
              uint latestNullifierRoot; 
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

          newNullifierRoot = Initial_NullifierRoot;

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

          require(commitmentRoots[_inputs.commitmentRoot] == _inputs.commitmentRoot, "Input commitmentRoot does not exist.");

            uint256[] memory inputs = new uint256[](customInputs.length + newNullifiers.length + (newNullifiers.length > 0 ? 3 : 0) + newCommitments.length);
          
          if (functionId == uint(FunctionNames.addB)) {
            uint k = 0;
            
            inputs[k++] = newCommitments[0];
            inputs[k++] = 1;
            
          }

          if (functionId == uint(FunctionNames.addA)) {
            uint k = 0;
             
            require(newNullifierRoot == _inputs.nullifierRoot, "Input NullifierRoot does not exist.");
            inputs[k++] = _inputs.nullifierRoot;
            inputs[k++] = _inputs.latestNullifierRoot;
            inputs[k++] = newNullifiers[0];
            inputs[k++] = _inputs.commitmentRoot;
            inputs[k++] = newCommitments[0];
            inputs[k++] = 1;
            
          }

          if (functionId == uint(FunctionNames.remove)) {
            uint k = 0;
             
            require(newNullifierRoot == _inputs.nullifierRoot, "Input NullifierRoot does not exist.");
            inputs[k++] = newCommitments[0];
            inputs[k++] = _inputs.nullifierRoot;
            inputs[k++] = _inputs.latestNullifierRoot;
            inputs[k++] = newNullifiers[0];
            inputs[k++] = _inputs.commitmentRoot;
            inputs[k++] = newCommitments[1];
            inputs[k++] = 1;
            
          }

          if (functionId == uint(FunctionNames.addfn)) {
            uint k = 0;
             
            require(newNullifierRoot == _inputs.nullifierRoot, "Input NullifierRoot does not exist.");
            inputs[k++] = _inputs.nullifierRoot;
            inputs[k++] = _inputs.latestNullifierRoot;
            inputs[k++] = newNullifiers[0];
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

       if (newNullifiers.length > 0) {
        newNullifierRoot = _inputs.latestNullifierRoot;
      }
        }







      function addB (uint256[] calldata newCommitments, uint256[] calldata proof) public  {

        
          Inputs memory inputs;

          inputs.customInputs = new uint[](1);
        	inputs.customInputs[0] = 1;

          inputs.newCommitments = newCommitments;

          bytes4 sig = bytes4(keccak256("addB(uint256[],uint256[])")) ;  
 	 	 	 if (sig == msg.sig)

          verify(proof, uint(FunctionNames.addB), inputs);

      }


      function addA (uint256 nullifierRoot, uint256 latestNullifierRoot,uint256[] calldata newNullifiers, uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata proof) public  {

        
          Inputs memory inputs;

          inputs.customInputs = new uint[](1);
        	inputs.customInputs[0] = 1;

        inputs.nullifierRoot = nullifierRoot; 

        inputs.latestNullifierRoot = latestNullifierRoot; 

          inputs.newNullifiers = newNullifiers;
           

          inputs.commitmentRoot = commitmentRoot;

          inputs.newCommitments = newCommitments;

          bytes4 sig = bytes4(keccak256("addA(uint256,uint256,uint256[],uint256,uint256[],uint256[])")) ;  
 	 	 	 if (sig == msg.sig)

          verify(proof, uint(FunctionNames.addA), inputs);

      }


      function remove (uint256 nullifierRoot, uint256 latestNullifierRoot,uint256[] calldata newNullifiers, uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata proof) public  {

        
          Inputs memory inputs;

          inputs.customInputs = new uint[](1);
        	inputs.customInputs[0] = 1;

        inputs.nullifierRoot = nullifierRoot; 

        inputs.latestNullifierRoot = latestNullifierRoot; 

          inputs.newNullifiers = newNullifiers;
           

          inputs.commitmentRoot = commitmentRoot;

          inputs.newCommitments = newCommitments;

           verify(proof, uint(FunctionNames.remove), inputs);
	 	 	 	 addB (newCommitments,proof);
	 	 	 	 addA (nullifierRoot,latestNullifierRoot,newNullifiers,commitmentRoot,newCommitments,proof);
      }


      function addfn (uint256 nullifierRoot, uint256 latestNullifierRoot,uint256[] calldata newNullifiers, uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata proof) public  {

        
          Inputs memory inputs;

          inputs.customInputs = new uint[](1);
        	inputs.customInputs[0] = 1;

        inputs.nullifierRoot = nullifierRoot; 

        inputs.latestNullifierRoot = latestNullifierRoot; 

          inputs.newNullifiers = newNullifiers;
           

          inputs.commitmentRoot = commitmentRoot;

          inputs.newCommitments = newCommitments;

           verify(proof, uint(FunctionNames.addfn), inputs);
	 	 	 	 addA (nullifierRoot,latestNullifierRoot,newNullifiers,commitmentRoot,newCommitments,proof);
      }
}