/**
output code for assignement
*/
import logger from '../utils/logger.mjs';
import { globals } from '../globals.mjs';

function processAssignment(assignment) {
  const { expression, variable } = assignment;
  logger.debug(expression);
  if (isNaN(expression)) throw new Error('Only number expressions are supported in assignments');
  if (!globals[variable]) throw new Error('Only global variables are supported in assignments');
  logger.info(`Processed assignment\n`)
  // assignment code for Zokrates
  const zokrates = `  def assign(field c, private field pk, private field s, field h) -> ():
    h == hash(c, pk, s)
    return
  `;
  logger.info(`ZOKRATES***********************\n${zokrates}`);
  // assignment node code
  const node = `  function assign(variable, value) {
    const h = hash(value, pk, s);
    const proof = generateProof(compiledCircuit, h, value, pk, s);
    shieldInstance.assign(proof, h, value, account );
  }
  assign(${variable}, ${expression});
  `;
  logger.info(`NODE***********************\n${node}`);

  // Solidity Shield code
  const solidity = `  function assign(uint256[] proof, uint256 h, uint256 e) {
    require(verify(proof, e));
    storeLeaf(h);
  }
  `;
  logger.info(`SOLIDITY***********************\n${solidity}`);
}

export default processAssignment;
