import FUNCTION_NAME from './FUNCTION_NAME.mjs';
import { startEventFilter, getSiblingPath } from './common/timber.mjs';
import logger from './common/logger.mjs';
import web3 from './common/web3.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let leafIndex;
// eslint-disable-next-line func-names
describe('FUNCTION_NAME', async function () {
  this.timeout(3660000);
  try {
    await web3.connect();
  } catch (err) {
    throw new Error(err);
  }
  // eslint-disable-next-line func-names
  describe('First call', async function () {
    this.timeout(3660000);
    it('should assign', async () => {
      try {
        await startEventFilter('CONTRACT_NAME');
        const { tx } = await FUNCTION_NAME(FUNCTION_SIG_1);
        console.log(tx);
        leafIndex = tx.events.NewLeaves.returnValues[0];
        console.log(`Merkle tree event returnValues:`);
        console.log(tx.events.NewLeaves.returnValues);
        await sleep(10);
      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
    it('should update the merkle tree', async () => {
      try {
        const path = await getSiblingPath('CONTRACT_NAME', leafIndex);
        console.log('Queried sibling path:');
        console.table(path, ['value', 'nodeIndex']);
      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
  });
  // eslint-disable-next-line func-names
  describe('Second Call', async function () {
    this.timeout(3660000);
    it('should assign', async () => {
      try {
        const { tx } = await FUNCTION_NAME(FUNCTION_SIG_2);
        console.log(`Merkle tree event returnValues:`);
        console.log(tx.events.NewLeaves.returnValues);
      } catch (err) {
        logger.error(err);
        process.exit(1);
      }
    });
  });
});
