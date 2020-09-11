export const assignNode = `function prove(compiledCircuit, publicParams, privateParams, account) {
    const publicHash = hash(publicParams)
    const proof = generateProof(compiledCircuit, privateParams, publicParams, publicHash);
    shieldInstance.commit(proof, publicParams, publicHash, { account } );
}

let privateParams = [];
let publicParams = [];
`;

export const assignZokrates = `def check_commitment(field c, field pk, field s, field h) -> ():
  h == hash(c, pk, s)
  return
`;

export const assignSolidity = `function commit(uint256[] proof, publicParams, uint256 publicHash) {
    require(publicHash == hash(publicParams))
    require(verify(proof, publicHash));
    storeLeaf(publicParams.commitment);
}
  `;
