/* eslint-disable prettier/prettier, no-use-before-define */

const ShieldContractStatementsBoilerplate = node => {
  switch (node.stage) {
    case 'PragmaDirective':
      return [
        `// SPDX-License-Identifier: CC0`,
        `\npragma solidity ^0.7.0;`,
      ];
    case 'ImportStatements':
     return [
       '\nimport "./merkle-tree/MerkleTree.sol";',
       '\nimport "./verify/Verifier_Interface.sol";',
     ];
    case 'ContractDefinition':
      return {
        signature: [
          `\ncontract ${node.contractName} is MerkleTree {`,
          `\n}`,
          ],
        statements: [],
      };
    case 'Globals':
      return [
        '\nVerifier_Interface private verifier;',
        '\nmapping(uint256 => uint256) public nullifiers;',
        '\nmapping(uint256 => uint256) public roots;',
        '\nmapping(uint256 => uint256[]) public vk;',
        '\nuint256 public latestRoot;'
      ];
    case 'Constructor':
      return [
        '\nconstructor (',
        '\n\taddress verifierAddress,',
        '\n\tuint256[] memory _vk',
        '\n) {',
        '\n\tverifier = Verifier_Interface(verifierAddress);',
        '\n\tvk[0] = _vk;',
        '\n}',
      ];
    case 'Main':
      return {
        signature: [`\nfunction ${node.functionName}(uint256[] memory proof, uint256 root, uint256 nullifier, uint256 commitment) public {`, '\n}'],
        statements: [
          ShieldContractCommitmentChecksBoilerplate(),
          ShieldContractVerifyBoilerplate(),
          ShieldContractMerkleTreeBoilerplate(),
        ].flat(Infinity), // will this work? who knows!
      };
    default:
      return;
  }
};

const ShieldContractCommitmentChecksBoilerplate = () => {
  // TODO - add node.numCommitments functionality
  return [
    '\nif (nullifier == 0 && root == 0 && latestRoot == 0) {',
    '\n} else if (nullifier != 0) {',
    '\n\trequire(nullifiers[nullifier] == 0, "Nullifier already exists");',
    '\n\trequire(roots[root] == root, "Root does not exist");',
    '\n\tnullifiers[nullifier] = nullifier;',
    '\n} else revert("Nullifier for latest commitment not defined");',
  ];
}
const ShieldContractVerifyBoilerplate = () => {
  return [
    '\nuint256[] memory inputs = new uint256[](3);',
    '\ninputs[0] = root;',
    '\ninputs[1] = nullifier;',
    '\ninputs[2] = commitment;',
    '\nbool res = verifier.verify(proof, inputs, vk[0]);',
    '\nrequire(res, "The proof has not been verified by the contract");',
  ]
}

const ShieldContractMerkleTreeBoilerplate = () => {
  return [
    '\nlatestRoot = insertLeaf(commitment);',
    '\nroots[latestRoot] = latestRoot;',
  ]
},

export default ShieldContractStatementsBoilerplate;
