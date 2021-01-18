/**
@title VerifierInterface
@dev Example Verifier Implementation
@notice Do not use this example in any production code!
*/

pragma solidity ^0.8.0;


interface VerifierInterface {

    function verify(
        uint256[] calldata _proof,
        uint256[] calldata _inputs,
        uint256[] calldata _vk
    ) external returns (bool result);

}
