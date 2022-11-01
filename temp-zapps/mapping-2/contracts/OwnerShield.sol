// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./verify/IVerifier.sol";
import "./merkle-tree/MerkleTree.sol";

contract OwnerShield is MerkleTree {


          enum FunctionNames { cnstrctr, alpha }

          IVerifier private verifier;

          mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames)

          mapping(uint256 => uint256) public nullifiers;

          mapping(uint256 => uint256) public commitmentRoots;

          uint256 public latestRoot;

          mapping(address => uint256) public zkpPublicKeys;

          struct Inputs {
            uint[] newNullifiers;
						uint[] checkNullifiers;
						uint commitmentRoot;
						uint[] newCommitments;
						uint[] customInputs;
          }


        function registerZKPPublicKey(uint256 pk) external {
      		zkpPublicKeys[msg.sender] = pk;
      	}
        


        function verify(
      		uint256[] memory proof,
      		uint256 functionId,
      		Inputs memory _inputs
      	) private {
        
          uint[] memory customInputs = _inputs.customInputs;

          uint[] memory newNullifiers = _inputs.newNullifiers;

          uint[] memory checkNullifiers = _inputs.checkNullifiers;

          uint[] memory newCommitments = _inputs.newCommitments;

          for (uint i; i < newNullifiers.length; i++) {
      			uint n = newNullifiers[i];
      			require(nullifiers[n] == 0, "Nullifier already exists");
      			nullifiers[n] = n;
      		}

          for (uint i; i < checkNullifiers.length; i++) {
            uint n = checkNullifiers[i];
            require(nullifiers[n] == 0, "Nullifier already exists");
          }

          require(commitmentRoots[_inputs.commitmentRoot] == _inputs.commitmentRoot, "Input commitmentRoot does not exist.");

            uint256[] memory inputs = new uint256[](customInputs.length + newNullifiers.length + checkNullifiers.length + (newNullifiers.length > 0 ? 1 : 0) + newCommitments.length);
          
          if (functionId == uint(FunctionNames.cnstrctr)) {
            uint k = 0;
            
            inputs[k++] = customInputs[0];
            inputs[k++] = newNullifiers[0];
            inputs[k++] = _inputs.commitmentRoot;
            inputs[k++] = newCommitments[0];
            inputs[k++] = newNullifiers[1];
            inputs[k++] = newCommitments[1];  
  						 	 inputs[k++] = 1;
          }

          if (functionId == uint(FunctionNames.alpha)) {
            uint k = 0;
            
            inputs[k++] = customInputs[0];
            inputs[k++] = newNullifiers[0];
            inputs[k++] = _inputs.commitmentRoot;
            inputs[k++] = newCommitments[0];
            inputs[k++] = newNullifiers[1];
            inputs[k++] = newCommitments[1];
            inputs[k++] = checkNullifiers[0];
            inputs[k++] = checkNullifiers[1];  
  						 	 inputs[k++] = 1;
          }
          
          bool result = verifier.verify(proof, inputs, vks[functionId]);

          require(result, "The proof has not been verified by the contract");

          if (newCommitments.length > 0) {
      			latestRoot = insertLeaves(newCommitments);
      			commitmentRoots[latestRoot] = latestRoot;
      		}
        }











      constructor  (address verifierAddress, uint256[][] memory vk, uint256[] memory newNullifiers, uint256 commitmentRoot, uint256[] memory newCommitments, uint256[] memory proof)   {

        verifier = IVerifier(verifierAddress);
    		  for (uint i = 0; i < vk.length; i++) {
    			  vks[i] = vk[i];
    		  }



          Inputs memory inputs;

          inputs.customInputs = new uint[](2);
        	inputs.customInputs[0] = uint256(uint160(address(msg.sender)));
inputs.customInputs[1] = 1;

          inputs.newNullifiers = newNullifiers;

          inputs.commitmentRoot = commitmentRoot;

          inputs.newCommitments = newCommitments;

          

          verify(proof, uint(FunctionNames.cnstrctr), inputs);
      }


      function alpha (uint256[] calldata newNullifiers, uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata checkNullifiers, uint256[] calldata proof) public  {

        





          Inputs memory inputs;

          inputs.customInputs = new uint[](2);
        	inputs.customInputs[0] = uint256(uint160(address(msg.sender)));
inputs.customInputs[1] = 1;

          inputs.newNullifiers = newNullifiers;

          inputs.checkNullifiers = checkNullifiers;

          inputs.commitmentRoot = commitmentRoot;

          inputs.newCommitments = newCommitments;

          bytes4 sig = bytes4(keccak256("alpha(uint256[],uint256,uint256[],uint256[],uint256[])")) ;  
 	 	 	 if (sig == msg.sig)

          verify(proof, uint(FunctionNames.alpha), inputs);
      }
}