// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./verify/IVerifier.sol";
import "./merkle-tree/MerkleTree.sol";

contract AssignShield is MerkleTree {


          enum FunctionNames { add }

          IVerifier private verifier;

          mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames)

          uint256 public latestRoot;

          mapping(address => uint256) public zkpPublicKeys;

          struct Inputs {
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

          uint[] memory newCommitments = _inputs.newCommitments;

            uint256[] memory inputs = new uint256[](customInputs.length + newCommitments.length);
          
          if (functionId == uint(FunctionNames.add)) {
            uint k = 0;
            
            inputs[k++] = newCommitments[0];
            inputs[k++] = 1;
            
          }
          
          bool result = verifier.verify(proof, inputs, vks[functionId]);

          require(result, "The proof has not been verified by the contract");

            insertLeaves(newCommitments);
        }





        uint256 public j;


        uint256 public len;


      function add (uint256[] calldata newCommitments, uint256[] calldata proof) public  {

        
          Inputs memory inputs;

          inputs.customInputs = new uint[](1);
        	inputs.customInputs[0] = 1;

          inputs.newCommitments = newCommitments;

           verify(proof, uint(FunctionNames.add), inputs);
 do { 
          len ++;
j /= 10;
        } while(j != 0);

      }
}