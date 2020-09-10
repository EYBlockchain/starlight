export const assignNode = `function assign(variable, value) {
    const h = hash(value, pk, s);
    const proof = generateProof(compiledCircuit, h, value, pk, s);
    shieldInstance.assign(proof, h, value, account );
}
`;

export const assignZokrates = `def assign(field c, field pk, field s, field h) -> ():
  h == hash(c, pk, s)
  return
`;

export const assignSolidity = `function assign(uint256[] proof, uint256 h, uint256 e) {
    require(verify(proof, e));
    storeLeaf(h);
}
  `;
