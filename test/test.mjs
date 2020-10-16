import fs from 'fs';
import { assign } from '../examples/cases/uninit_global/assign.mjs';
import { startEventFilter, getSiblingPath } from '../src/utils/timber.mjs';
import { generateKeys } from '../src/utils/zokrates.mjs';
import logger from '../src/utils/logger.mjs';
import web3 from '../src/utils/web3.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const functionName = 'Assign';
const functionNameL = functionName.toLowerCase();
const functionPath = '///app/examples/cases/uninit_global';
let leafIndex;
// eslint-disable-next-line func-names
describe('Assign', async function () {
  this.timeout(3660000);
  try {
    await web3.connect();
  } catch (err) {
    throw new Error(err);
  }
  it.skip('should write files', async () => {
    // We have node, solidity, and zokrates files
    // Doesn't work!
    if (!fs.existsSync(`///app/contracts/${functionName}Shield.sol`)) {
      const contract = fs.readFileSync(`${functionPath}/${functionName}Shield.sol`, 'utf-8');
      fs.writeFileSync(`///app/contracts/${functionName}Shield.sol`, contract);
    } else logger.info('Contract already written');

    if (!fs.existsSync(`/app/circuits/${functionNameL}.zok`)) {
      const circuit = fs.readFileSync(`${functionPath}/${functionNameL}.zok`, 'utf-8');
      fs.writeFileSync(`/app/circuits/${functionNameL}.zok`, circuit);
    } else logger.info('Circuit already written');
  });

  it.skip('should generate keys', async () => {
    let vk;
    try {
      vk = await generateKeys(`${functionNameL}.zok`);
    } catch (err) {
      throw new Error(err);
    }
    logger.info(`Generated vk ${vk}`);
  });
  // eslint-disable-next-line func-names
  describe('Assign', async function () {
    this.timeout(3660000);
    it('should assign', async () => {
      try {
        await startEventFilter('Assign');
        const tx = await assign(5);
        // console.log(tx);
        leafIndex = tx.events.NewLeaf.returnValues[0];
        console.log(`Merkle tree event returnValues:`);
        console.log(tx.events.NewLeaf.returnValues);
        await sleep(10);
      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
    it('should update the merkle tree', async () => {
      try {
        const path = await getSiblingPath('Assign', leafIndex);
        console.log('Queried sibling path:');
        console.table(path, ['value', 'nodeIndex']);
      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
  });
  // eslint-disable-next-line func-names
  describe('Reassign', async function () {
    this.timeout(3660000);
    it('should assign, nullifying the old commitment', async () => {
      try {
        const tx = await assign(7);
        // console.log(tx);
        console.log(`Merkle tree event returnValues:`);
        console.log(tx.events.NewLeaf.returnValues);
      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
  });
});
