/* eslint-disable prettier/prettier, no-use-before-define */

const ShieldContractStatementsBoilerplate = node => {
  switch (node.stage) {
    case 'PragmaDirective':
      // Although the visitor currently inherits the Pragma of the original contract, we might (in future) choose to hard-code the Pragma by using this boilerplate.
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
};

const ShieldContractVerifyBoilerplate = () => {
  return [
    'uint256[] memory inputs = new uint256[](3);',
    'inputs[0] = root;',
    'inputs[1] = nullifier;',
    'inputs[2] = commitment;',
    'bool res = verifier.verify(proof, inputs, vk[0]);',
    'require(res, "The proof has not been verified by the contract");',
  ];
};

export const ShieldContractConstructorBoilerplate = [
  'constructor (',
  '\taddress verifierAddress,',
  '\tuint256[] memory vk',
  ') {',
  '\tverifier = Verifier_Interface(verifierAddress);',
  '\tvks[0] = vk;',
  '}',
];

export const ShieldContractInsertLeavesBoilerplate = [
  'latestRoot = insertLeaves(newCommitments);',
  'roots[latestRoot] = latestRoot;',
];

export const requireNewNullifiersNotInNullifiersThenAddThemBoilerplate = [
  'for (uint i; i < newNullifiers.length; i++) {',
  '\trequire(nullifiers[newNullifiers[i]] == 0, "Nullifier already exists");',
  '\tnullifiers[newNullifiers[i]] = newNullifiers[i];',
  '}',
];

export const requireCommitmentRootInCommitmentRootsBoilerplate = [
  'require(commitmentRoots[commitmentRoot] == commitmentRoot, "Input commitmentRoot does not exist.");',
];

export const verifyBoilerplate = [
  'bool result = verifier.verify(proof, inputs, vks[0]);',
  'require(result, "The proof has not been verified by the contract");',
];

export const insertLeavesBoilerplate = [
  'latestRoot = insertLeaves(newCommitments);',
  'commitmentRoots[latestRoot] = latestRoot;',
];

export const inputsVariableDeclarationStatementBoilerplate = (node) => {
  const { oldCommitmentReferencesRequired, nullifiersRequired, newCommitmentsRequired } = node;
  if (!oldCommitmentReferencesRequired && !nullifiersRequired && !newCommitmentsRequired) throw new Error(`It appears this function's zk-SNARK circuit doesn't take any parameters...`);
  const lengthParameters = [];
  if (oldCommitmentReferencesRequired) lengthParameters.push('1');
  if (nullifiersRequired) lengthParameters.push('newNullifiers.length');
  if (newCommitmentsRequired) lengthParameters.push('newCommitments.length');
  const lengthParameter = lengthParameters.join(' + ');
  let inputAssignment = [
    `uint256[] memory inputs = new uint256[](${lengthParameter});`,
    'uint k = 0;',
  ];
  if (oldCommitmentReferencesRequired) inputAssignment.push('inputs[k++] = commitmentRoot;');
  if (nullifiersRequired) inputAssignment = inputAssignment.concat([
    'for (uint i = 0; i < newNullifiers.length; i++) {',
    '\tinputs[k++] = newNullifiers[i];',
    '}',
  ]);
  if (newCommitmentsRequired) inputAssignment = inputAssignment.concat([
    'for (uint i = 0; i < newCommitments.length; i++) {',
    '\tinputs[k++] = newCommitments[i];',
    '}',
  ]);
  return inputAssignment;
};
