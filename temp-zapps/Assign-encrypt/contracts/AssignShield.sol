// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

import "./verify/IVerifier.sol";
import "./merkle-tree/MerkleTree.sol";

contract AssignShield is MerkleTree {


          enum FunctionNames { add, remove }

          IVerifier private verifier;

          mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames)

          event EncryptedData(uint256[] cipherText, uint256[2] ephPublicKey);

          uint256 public latestRoot;

          mapping(address => uint256) public zkpPublicKeys;

          struct Inputs {
            uint[] newCommitments;
						uint[][] cipherText;
						uint[2][] encKeys;
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

          uint encInputsLen = 0;

          for (uint i; i < _inputs.cipherText.length; i++) {
            encInputsLen += _inputs.cipherText[i].length + 2;
          }

            uint256[] memory inputs = new uint256[](customInputs.length + newCommitments.length + encInputsLen);
          
          if (functionId == uint(FunctionNames.add)) {
            uint k = 0;
            
            inputs[k++] = newCommitments[0];
              for (uint j; j < _inputs.cipherText[0].length; j++) {
              inputs[k++] = _inputs.cipherText[0][j];
            }
              inputs[k++] = _inputs.encKeys[0][0];
              inputs[k++] = _inputs.encKeys[0][1];
            
          }

          if (functionId == uint(FunctionNames.remove)) {
            uint k = 0;
            
            inputs[k++] = newCommitments[0];
            inputs[k++] = newCommitments[1];
              for (uint j; j < _inputs.cipherText[0].length; j++) {
              inputs[k++] = _inputs.cipherText[0][j];
            }
              inputs[k++] = _inputs.encKeys[0][0];
              inputs[k++] = _inputs.encKeys[0][1];
            
          }
          
          bool result = verifier.verify(proof, inputs, vks[functionId]);

          require(result, "The proof has not been verified by the contract");

            insertLeaves(newCommitments);
        }







      function add (uint256[] calldata newCommitments, uint256[][] calldata cipherText, uint256[2][] calldata ephPubKeys, uint256[] calldata proof) public  {

        
          Inputs memory inputs;

          inputs.newCommitments = newCommitments;

          inputs.cipherText = cipherText;

          inputs.encKeys = ephPubKeys;

          bytes4 sig = bytes4(keccak256("add(uint256[],uint256[][],uint256[2][],uint256[])")) ;  
 	 	 	 if (sig == msg.sig)

          verify(proof, uint(FunctionNames.add), inputs);

          for (uint j; j < cipherText.length; j++) {
            // this seems silly (it is) but its the only way to get the event to emit properly
            uint256[2] memory ephKeyToEmit = ephPubKeys[j];
            uint256[] memory cipherToEmit = cipherText[j];
            emit EncryptedData(cipherToEmit, ephKeyToEmit);
          }

      }


      function remove (uint256[] calldata newCommitments, uint256[][] calldata cipherText, uint256[2][] calldata ephPubKeys, uint256[] calldata proof) public  {

        
          Inputs memory inputs;

          inputs.newCommitments = newCommitments;

          inputs.cipherText = cipherText;

          inputs.encKeys = ephPubKeys;

           verify(proof, uint(FunctionNames.remove), inputs);

          for (uint j; j < cipherText.length; j++) {
            // this seems silly (it is) but its the only way to get the event to emit properly
            uint256[2] memory ephKeyToEmit = ephPubKeys[j];
            uint256[] memory cipherToEmit = cipherText[j];
            emit EncryptedData(cipherToEmit, ephKeyToEmit);
          }

	 	 	 	 add (newCommitments,cipherText,ephPubKeys,proof);
      }
}