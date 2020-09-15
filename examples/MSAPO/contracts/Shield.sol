/**
Contract to enable the management of private fungible token (ERC-20) transactions using zk-SNARKs.
@Author Westlad, Chaitanya-Konda, iAmMichaelConnor
*/

pragma solidity ^0.6.10;

import "./Ownable.sol";
import "./MerkleTree.sol";
import "./VerifierInterface.sol";

contract Shield is Ownable, MerkleTree {
    // ENUMS:
    enum TransactionTypes {
        CreateMSA,       // 0
        CreatePO      // 1
    }

    // EVENTS:
    // Observers may wish to listen for nullification of commitments:
    event NewCommitment(bytes32 newCommitment);
    event UpdatedCommitment(bytes32 nullifier, bytes32 newCommitment);
    event DeletedCommitment(bytes32 nullifier);

    // Observers may wish to listen for zkSNARK-related changes:
    event VerifierChanged(address newVerifierContract);
    event VkChanged(TransactionTypes txType);

    // CONTRACT INSTANCES:
    VerifierInterface private verifier; // the verification smart contract

    // PRIVATE TRANSACTIONS' PUBLIC STATES:
    mapping(bytes32 => bytes32) public commitments; // store commitments
    mapping(bytes32 => bytes32) public nullifiers; // store nullifiers of spent commitments
    mapping(bytes32 => bytes32) public roots; // holds each root we've calculated so that we can pull the one relevant to the prover
    bytes32 public latestRoot; // holds the index for the latest root so that the prover can provide it later and this contract can look up the relevant root

    // VERIFICATION KEY STORAGE:
    mapping(uint => uint256[]) public vks; // mapped to by an enum uint(TransactionTypes):

    // FUNCTIONS:
    constructor(address _verifier) public {
        _owner = msg.sender;
        verifier = VerifierInterface(_verifier);
    }

    /**
    self destruct
    */
    function close() external onlyOwner {
        selfdestruct(address(uint160(_owner)));
    }

    /**
    function to change the address of the underlying Verifier contract
    */
    function changeVerifier(address _verifier) external onlyOwner {
        verifier = VerifierInterface(_verifier);
        emit VerifierChanged(_verifier);
    }

    /**
    returns the verifier-interface contract address that this shield contract is calling
    */
    function getVerifier() public view returns (address) {
        return address(verifier);
    }

    /**
    Stores verification keys (for the 'mint', 'transfer' and 'burn' computations).
    */
    function registerVerificationKey(
        uint256[] calldata _vk,
        TransactionTypes _txType
    ) external onlyOwner returns (bytes32) {
        // CAUTION: we do not prevent overwrites of vk's. Users must listen for the emitted event to detect updates to a vk.
        vks[uint(_txType)] = _vk;

        emit VkChanged(_txType);
    }

    /**
    createMSA
    */
    function createMSA(
        uint256[] calldata _proof,
        uint256[] calldata _publicInputHash,
        bytes32 _newMSACommitment
    ) external {

        // Check that the publicInputHash equals the hash of the 'public inputs':
        bytes31 publicInputHash = bytes31(bytes32(_publicInputHash[0]) << 8);
        bytes31 publicInputHashCheck = bytes31(sha256(abi.encodePacked(_newMSACommitment)) << 8);
        require(publicInputHashCheck == publicInputHash, "publicInputHash cannot be reconciled");

        // verify the proof
        bool result = verifier.verify(_proof, _publicInputHash, vks[uint(TransactionTypes.CreateMSA)]);
        require(result, "The proof has not been verified by the contract");

        // check inputs vs on-chain states
        // COMMENTED OUT THE BELOW, FOR QUICKER REPEATED TESTING.
        // require(commitments[_newMSACommitment] == 0, "The MSA commitment already exists!");

        // update contract states
        commitments[_newMSACommitment] = _newMSACommitment;
        latestRoot = insertLeaf(_newMSACommitment); // recalculate the root of the merkleTree as it's now different
        roots[latestRoot] = latestRoot; // and save the new root to the list of roots

        emit NewCommitment(_newMSACommitment);
    }

    /**
    createPO
    */
    function createPO(
        uint256[] calldata _proof,
        uint256[] calldata _publicInputHash,
        bytes32 _root,
        bytes32 _nullifierOfOldMSACommitment,
        bytes32 _newMSACommitment,
        bytes32 _newPOCommitment
    ) external {

        // Check that the publicInputHash equals the hash of the 'public inputs':
        bytes31 publicInputHash = bytes31(bytes32(_publicInputHash[0]) << 8);
        bytes31 publicInputHashCheck = bytes31(sha256(abi.encodePacked(_root, _nullifierOfOldMSACommitment, _newMSACommitment, _newPOCommitment)) << 8);
        require(publicInputHashCheck == publicInputHash, "publicInputHash cannot be reconciled");

        // verify the proof
        bool result = verifier.verify(_proof, _publicInputHash, vks[uint(TransactionTypes.CreatePO)]);
        require(result, "The proof has not been verified by the contract");

        // check inputs vs on-chain states
        require(roots[_root] == _root, "The input root has never been the root of the Merkle Tree");
        require(_newMSACommitment != _newPOCommitment, "The new commitments (_newMSACommitment and _newPOCommitment) must be different!"); // Is this check necessary?
        require(commitments[_newMSACommitment] == 0, "The MSA commitment already exists!");
        require(nullifiers[_nullifierOfOldMSACommitment] == 0, "The MSA commitment (which is being updated) has already been nullified!");
        require(commitments[_newPOCommitment] == 0, "The PO commitment already exists!");

        // update contract states
        nullifiers[_nullifierOfOldMSACommitment] = _nullifierOfOldMSACommitment; //remember we spent it
        commitments[_newMSACommitment] = _newMSACommitment;
        commitments[_newPOCommitment] = _newPOCommitment;

        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = _newMSACommitment;
        leaves[1] = _newPOCommitment;

        latestRoot = insertLeaves(leaves); // recalculate the root of the merkleTree as it's now different
        roots[latestRoot] = latestRoot; // and save the new root to the list of roots

        emit UpdatedCommitment(_nullifierOfOldMSACommitment, _newMSACommitment);
        emit NewCommitment(_newPOCommitment);
    }
}
