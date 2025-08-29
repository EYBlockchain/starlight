
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import shell from 'shelljs'
import logger from "./built/utils/logger.js";

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const testedZapps = [];

const getUserFriendlyTestNames = async folderPath => {
  try {
    const files = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const fileNames = files
      .filter(dirent => dirent.isFile()) // Only include files
      .map(dirent => dirent.name.replace(/\.zol$/, '')); // Get file names
    return fileNames;
  } catch (err) {
    console.error('Error reading folder:', err);
    return [];
  }
};

const callZAppAPIs = async (zappName , apiRequests, errorMessage, preHook, cnstrctrInputs) => {
  testedZapps.push(zappName);
  if (shell.exec(`./apiactions -z ${zappName} -c '${cnstrctrInputs}'`).code !== 0) {
    shell.echo(`${zappName} failed`);
    shell.exit(1);
  }
  // wait for above shell command to execute
  await new Promise(resolve => setTimeout(resolve, 5000));

  // run pre-hook to modify requests if needed
  if (preHook) {
    await preHook(apiRequests);
  }
  let apiResponses = [];
  for (let i = 0; i < apiRequests.length; i++) {
    if (apiRequests[i].method === 'get') {
      apiResponses[i] = await chai
        .request('localhost:3000')
        .get(apiRequests[i].endpoint)
        .send(apiRequests[i].data);
    } else if (apiRequests[i].method === 'post') {
      apiResponses[i] = await chai
        .request('localhost:3000')
        .post(apiRequests[i].endpoint)
        .send(apiRequests[i].data);
      // Check if the response is successful
      if (apiResponses[i].status !== 200) {
        throw new Error(`API request failed for ${apiRequests[i].endpoint} with status ${apiResponses[i].status}`);
      }
    }
  }
  shell.cd(`./temp-zapps/${zappName}`);
  if (shell.exec('docker compose -f docker-compose.zapp.yml down -v').code !== 0) {
    shell.echo('docker stop failed');
    shell.exit(1);
  }
  shell.cd('../..');
  await new Promise(resolve => setTimeout(resolve, 5000));
  return apiResponses;
};

let res = {};

const apiRequests_Arrays = [
  { method: 'post', endpoint: '/add', data: { value: 10 } },
  { method: 'post', endpoint: '/add', data: { value: 9 } },
  { method: 'post', endpoint: '/remove', data: { value: 17 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'a' } },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'b', mappingKey: '0'} },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'b', mappingKey: '1'} },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'b', mappingKey: '2'} },
  { method: 'post', endpoint: '/backupVariable', data: { name: 'b' } },
  { method: 'post', endpoint: '/add', data: { value: 7 } },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'b', mappingKey: '2'} },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'b', mappingKey: '3'} },
  { method: 'get', endpoint: '/getBalance' },
  { method: 'get', endpoint: '/getBalanceByState', data: { name: 'a'} },
];

res.Arrays = await callZAppAPIs('Arrays', apiRequests_Arrays, 'Arrays Zapp failed');

const apiRequests_Assign = [
  { method: 'post', endpoint: '/add', data: { value: 11 } },
  { method: 'post', endpoint: '/add', data: { value: 8 } },
  { method: 'get', endpoint: '/getBalance' },
  { method: 'post', endpoint: '/remove', data: { value: 16 } },
  { method: 'get', endpoint: '/getBalance' },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'a' } },
  { method: 'post', endpoint: '/backupDataRetriever' },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'post', endpoint: '/remove', data: { value: 2 } },

];

res.Assign = await callZAppAPIs('Assign', apiRequests_Assign, 'Assign Zapp failed');

const apiRequests_Assign_api = [
  { method: 'post', endpoint: '/add', data: { value: 11 } },
  { method: 'post', endpoint: '/remove', data: { value: 6 } },
  { method: 'post', endpoint: '/addPublic', data: { value: 25 } },
  { method: 'get', endpoint: '/readB' },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'a' } },
  { method: 'post', endpoint: '/terminateContract', data: { } },
  { method: 'post', endpoint: '/add', data: { value: 11 } },
];

res.Assign_api = await callZAppAPIs('Assign-api', apiRequests_Assign_api, 'Assign-api Zapp failed');

const apiRequests_BucketsOfBalls = [
  { method: 'post', endpoint: '/deposit', data: { amountDeposit: 6 } },
  { method: 'post', endpoint: '/deposit', data: { amountDeposit: 7 } },
  {
    method: 'post',
    endpoint: '/transfer',
    data: { toBucketId: 5, numberOfBalls: 8 },
  },
  { method: 'get', endpoint: '/getAllCommitments' },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: {
      name: 'buckets',
      mappingKey: '1390849295786071768276380950238675083608645509734',
    },
  },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'buckets', mappingKey: '5' },
  },
  { method: 'post', endpoint: '/backupDataRetriever' },
  { method: 'get', endpoint: '/getAllCommitments' },
  {
    method: 'post',
    endpoint: '/transfer',
    data: { toBucketId: 3, numberOfBalls: 2 },
  },
  {
    method: 'get',
    endpoint: '/getBalanceByState',
    data: {
      name: 'buckets',
      mappingKey: '1390849295786071768276380950238675083608645509734',
    },
  },
  {
    method: 'get',
    endpoint: '/getBalanceByState',
    data: { name: 'buckets', mappingKey: '3' },
  },
];

res.BucketsOfBalls = await callZAppAPIs(
  'BucketsOfBalls',
  apiRequests_BucketsOfBalls,
  'BucketsOfBalls Zapp failed',
);

// In order to test Charity Pot we first need to mint ERC tokens.
let depositFilePath = path.join(
  __dirname,
  'temp-zapps/CharityPot/orchestration/deposit.mjs',
);
const mintingText = `const erc20 = await getContractInstance("ERC20");
// mint tokens to the contract 
console.log("address minting to", config.web3.options.defaultAccount);  
await erc20.methods
    .mint(config.web3.options.defaultAccount, 500)
    .send({ from: config.web3.options.defaultAccount });

await erc20.methods
    .approve(this.contractAddr, 500)
    .send({ from: config.web3.options.defaultAccount });`;
let depositContent = fs.readFileSync(depositFilePath, 'utf8');
const keyword = 'const web3 = this.web3;';
let position = depositContent.indexOf(keyword);
if (position !== -1) {
  const before = depositContent.slice(0, position + keyword.length); // Include the keyword
  const after = depositContent.slice(position + keyword.length); // Everything after the keyword
  depositContent = before + mintingText + after;
} else {
  console.error(`Keyword "${keyword}"  not found in the file.`);
}
fs.writeFileSync(depositFilePath, depositContent, 'utf8');

console.log(
  'deposit.mjs in CharityPot modified successfully to mint ERC tokens. Proceeding with the test...',
);

const apiRequests_CharityPot = [
  { method: 'post', endpoint: '/deposit', data: { amount: 50 } },
  { method: 'post', endpoint: '/donate', data: { donation: 4 } },
  { method: 'post', endpoint: '/donate', data: { donation: 16 } },
  { method: 'post', endpoint: '/withdraw', data: { withdrawal: 7 } },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'pot' },
  },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: {
      name: 'balances',
      mappingKey: '1390849295786071768276380950238675083608645509734',
    },
  },
  { method: 'post', endpoint: '/backupDataRetriever' },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'post', endpoint: '/withdraw', data: { withdrawal: 3 } },
];

res.CharityPot = await callZAppAPIs(
  'CharityPot',
  apiRequests_CharityPot,
  'CharityPot Zapp failed',
  undefined,
  "\"1390849295786071768276380950238675083608645509734\",\"NA\""
);

const apiRequests_Constructor = [
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'post', endpoint: '/add', data: { value: 9 } },
  { method: 'post', endpoint: '/add', data: { value: 17 } },
  { method: 'get', endpoint: '/getBalance' },
  { method: 'post', endpoint: '/remove', data: { value: 12 } },
  { method: 'get', endpoint: '/getBalance' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'a' } },
  { method: 'post', endpoint: '/backupDataRetriever' },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'post', endpoint: '/remove', data: { value: 2 } },

];

res.Constructor = await callZAppAPIs('Constructor', apiRequests_Constructor, 'Constructor Zapp failed', undefined, "5");

const apiRequests_Encrypt = [
  { method: 'post', endpoint: '/add', data: { value: 6 } },
  { method: 'post', endpoint: '/remove', data: { value: 5 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'a' } },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'b' } },
];

res.Encrypt = await callZAppAPIs('Encrypt', apiRequests_Encrypt, 'Encrypt Zapp failed');

// In order to test Escrow we first need to mint ERC tokens
depositFilePath = path.join(
  __dirname,
  'temp-zapps/Escrow/orchestration/deposit.mjs',
);
depositContent = fs.readFileSync(depositFilePath, 'utf8');
position = depositContent.indexOf(keyword);
if (position !== -1) {
  const before = depositContent.slice(0, position + keyword.length); // Include the keyword
  const after = depositContent.slice(position + keyword.length); // Everything after the keyword
  depositContent = before + mintingText + after;
} else {
  console.error(`Keyword "${keyword}"  not found in the file.`);
}
fs.writeFileSync(depositFilePath, depositContent, 'utf8');

console.log(
  'deposit.mjs in Escrow modified successfully to mint ERC tokens. Proceeding with the test...',
);

const apiRequests_Escrow = [
  { method: 'post', endpoint: '/deposit', data: { amount: 25 } },
  { method: 'post', endpoint: '/deposit', data: { amount: 19 } },
  {
    method: 'post',
    endpoint: '/transfer',
    data: { recipient: 235, amount: 13 },
  },
  { method: 'post', endpoint: '/withdraw', data: { amount: 3 } },
  {
    method: 'post',
    endpoint: '/approve',
    data: {
      approvedAddress: '1390849295786071768276380950238675083608645509734',
    },
  },
  {
    method: 'post',
    endpoint: '/transferFrom',
    data: {
      sender: '1390849295786071768276380950238675083608645509734',
      recipient: 235,
      amount: 1,
    },
  },
  { method: 'get', endpoint: '/getAllCommitments' },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: {
      name: 'balances',
      mappingKey: '1390849295786071768276380950238675083608645509734',
    },
  },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'balances', mappingKey: '235' },
  },
  { method: 'post', endpoint: '/backupDataRetriever' },
  { method: 'get', endpoint: '/getAllCommitments' },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: {
      name: 'balances',
      mappingKey: '1390849295786071768276380950238675083608645509734',
    },
  },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'balances', mappingKey: '235' },
  },
  { method: 'post', endpoint: '/withdraw', data: { amount: 7 } },
];

res.Escrow = await callZAppAPIs(
  'Escrow',
  apiRequests_Escrow,
  'Escrow Zapp failed',
  undefined,
  '"NA"',
);

const apiRequests_forloop = [
  { method: 'post', endpoint: '/add', data: { j: 8 } },
  { method: 'post', endpoint: '/add', data: { j: 9 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'z' } },
];

res.forloop = await callZAppAPIs('for-loop', apiRequests_forloop, 'for-loop Zapp failed');

const apiRequests_IfStatement = [
  { method: 'post', endpoint: '/add', data: { y: 14 } },
  { method: 'post', endpoint: '/add', data: { y: 3 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'z'} },
  { method: 'post', endpoint: '/backupVariable', data: { name: 'z' } },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'z'} },
  { method: 'post', endpoint: '/add', data: { y: 6 } },
];

res.IfStatement = await callZAppAPIs('If-Statement', apiRequests_IfStatement, 'If-Statement Zapp failed');

/*const apiRequests_InternalFunctionCall = [
  { method: 'post', endpoint: '/deposit', data: { accountId: 1, amountDeposit: 16 } },
  { method: 'post', endpoint: '/deposit', data: { accountId: 1, amountDeposit: 18 } },
  { method: 'post', endpoint: '/transfer', data: { fromAccountId: 1, toAccountId: 3, amount: 29 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'account', mappingKey: '1'} },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'account', mappingKey: '3'} },
];

res.InternalFunctionCall = await callZAppAPIs('InternalFunctionCall', apiRequests_InternalFunctionCall, 'InternalFunctionCall Zapp failed');*/

const apiRequests_MappingtoStruct = [
  { method: 'post', endpoint: '/add', data: { value: 34 } },
  { method: 'post', endpoint: '/add', data: { value: 15 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'd', mappingKey: '0'} },
  { method: 'post', endpoint: '/backupVariable', data: { name: 'd' } },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'd', mappingKey: '0'} },
  { method: 'post', endpoint: '/add', data: { value: 18 } },
];

res.MappingtoStruct = await callZAppAPIs('MappingtoStruct', apiRequests_MappingtoStruct, 'MappingtoStruct Zapp failed');

// In order to test NFT_Escrow we first need to mint a token. 
const NFTmintingText = `const erc721 = await getContractInstance("ERC721");
let mintBalance = await erc721.methods
		.balanceOf(config.web3.options.defaultAccount, this.contractAddr)
		.call({ from: config.web3.options.defaultAccount });
// mint tokens to the contract  
if (mintBalance === BigInt(0)) {
  await erc721.methods
      .mint(config.web3.options.defaultAccount, 12345678)
      .send({ from: config.web3.options.defaultAccount });
  await erc721.methods
      .approve(this.contractAddr, 12345678)
      .send({ from: config.web3.options.defaultAccount });
  await erc721.methods
      .mint(config.web3.options.defaultAccount, 87654321)
      .send({ from: config.web3.options.defaultAccount });
  await erc721.methods
      .approve(this.contractAddr, 87654321)
      .send({ from: config.web3.options.defaultAccount });
  await erc721.methods
      .mint(config.web3.options.defaultAccount, 23456789)
      .send({ from: config.web3.options.defaultAccount });
  await erc721.methods
      .approve(this.contractAddr, 23456789)
      .send({ from: config.web3.options.defaultAccount });
}`;
const depositNFTFilePath = path.join(
  __dirname,
  'temp-zapps/NFT_Escrow/orchestration/deposit.mjs',
);
let depositNFTContent = fs.readFileSync(depositNFTFilePath, 'utf8');
position = depositNFTContent.indexOf(keyword);
if (position !== -1) {
  const before = depositNFTContent.slice(0, position + keyword.length); // Include the keyword
  const after = depositNFTContent.slice(position + keyword.length); // Everything after the keyword
  depositNFTContent = before + NFTmintingText + after;
} else {
  console.error(`Keyword "${keyword}"  not found in the file.`);
}
fs.writeFileSync(depositNFTFilePath, depositNFTContent, 'utf8');

console.log(
  'deposit.mjs in NFT_Escrow modified successfully to mint an ERC721 token. Proceeding with the test...',
);

const apiRequests_NFT_Escrow = [
  { method: 'post', endpoint: '/deposit', data: { tokenId: 12345678 } },
  { method: 'post', endpoint: '/deposit', data: { tokenId: 87654321 } },
  { method: 'post', endpoint: '/deposit', data: { tokenId: 23456789 } },
  {
    method: 'post',
    endpoint: '/transfer',
    data: { recipient: 235, tokenId: 12345678 },
  },
  { method: 'post', endpoint: '/withdraw', data: { tokenId: 87654321 } },
  {
    method: 'post',
    endpoint: '/approve',
    data: {
      approvedAddress: '1390849295786071768276380950238675083608645509734',
    },
  },
  {
    method: 'post',
    endpoint: '/transferFrom',
    data: {
      sender: '1390849295786071768276380950238675083608645509734',
      recipient: 578,
      tokenId: 23456789,
    },
  },
  { method: 'get', endpoint: '/getAllCommitments' },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'tokenOwners', mappingKey: '12345678' },
  },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'tokenOwners', mappingKey: '87654321' },
  },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'tokenOwners', mappingKey: '23456789' },
  },
  { method: 'post', endpoint: '/backupDataRetriever' },
  { method: 'get', endpoint: '/getAllCommitments' },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'tokenOwners', mappingKey: '12345678' },
  },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'tokenOwners', mappingKey: '87654321' },
  },
  {
    method: 'get',
    endpoint: '/getCommitmentsByVariableName',
    data: { name: 'tokenOwners', mappingKey: '23456789' },
  },
];

res.NFT_Escrow = await callZAppAPIs(
  'NFT_Escrow',
  apiRequests_NFT_Escrow,
  'NFT_Escrow Zapp failed',
  undefined,
  '"NA"',
);

const apiRequests_Return = [
  { method: 'post', endpoint: '/add', data: { value: 21 } },
  { method: 'post', endpoint: '/remove', data: { value: 17, value1: 12 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'a' } },
];

res.Return = await callZAppAPIs('Return', apiRequests_Return, 'Return Zapp failed');

const apiRequests_SimpleStruct = [
  { method: 'post', endpoint: '/add', data: { value: {"prop1": 14, "prop2": true} } },
  { method: 'post', endpoint: '/add', data: { value: {"prop1": 25, "prop2": false} } },
  { method: 'post', endpoint: '/remove', data: { value: {"prop1": 28, "prop2": false} } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'a' } },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'b' } },
];

res.SimpleStruct = await callZAppAPIs('SimpleStruct', apiRequests_SimpleStruct, 'SimpleStruct Zapp failed');


const apiRequests_internalFunctionCallTest1 = [
  { method: 'post', endpoint: '/add', data: { value: 46 } },
  { method: 'post', endpoint: '/remove', data: { value: 33} },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'post', endpoint: '/add', data: { value: 63 } },
  { method: 'post', endpoint: '/remove', data: { value: 55} },
  { method: 'get', endpoint: '/getAllCommitments' },
];

res.InternalFunctionCallTest1 = await callZAppAPIs('internalFunctionCallTest1', apiRequests_internalFunctionCallTest1, 'internalFunctionCallTest1 Zapp failed');

// --- Swap Zapp ---
const counterParty = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const apiRequests_Swap = [
  { method: 'post', endpoint: '/deposit', data: { tokenId: 1, amount: 100 } },
  { method: 'post', endpoint: '/deposit', data: { tokenId: 2, amount: 100 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  {
    method: 'post',
    endpoint: '/startSwap',
    data: {
      sharedAddress: '', // to be filled in preHook
      amountSent: 30,
      tokenIdSent: 1,
      tokenIdRecieved: 2,
    },
  },
  { method: 'get', endpoint: '/getAllCommitments' },
  {
    method: 'post',
    endpoint: '/completeSwap',
    data: {
      sharedAddress: '', // to be filled in preHook
      counterParty: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      tokenIdSent: 2,
      tokenIdRecieved: 1,
      amountRecieved: 30,
    },
  },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'post', endpoint: '/backupDataRetriever' },
  { method: 'get', endpoint: '/getAllCommitments' },
];

const preHook = async requests => {
  const sharedAddress = await chai
    .request('localhost:3000')
    .post('/getSharedKeys')
    .send({ recipientPubKey: counterParty })
    .then(res => res.body?.SharedKeys?._hex);

  if (!sharedAddress) throw new Error('Failed to retrieve shared address');

  for (const req of requests) {
    if (req.data && 'sharedAddress' in req.data) {
      req.data.sharedAddress = sharedAddress;
    }
  }
};

res.Swap = await callZAppAPIs(
  'Swap',
  apiRequests_Swap,
  'Swap Zapp failed',
  preHook,
);

const userFriendlyTestsPath = 'test/contracts/user-friendly-tests';
const userFriendlyTests = await getUserFriendlyTestNames(userFriendlyTestsPath);
const allTestsCovered = userFriendlyTests.every(test => testedZapps.includes(test));

describe('Check all contracts in user-friendly-tests are tested', () => {
  it('should ensure all user-friendly-tests are in testedZapps', () => {
    expect(allTestsCovered).to.equal(true);
  });
});

describe('Arrays Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.Arrays[0].body.tx.event).to.equal('NewLeaves');
    expect(res.Arrays[1].body.tx.event).to.equal('NewLeaves');
    expect(res.Arrays[2].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.Arrays[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.Arrays[1].body.tx.returnValues.minLeafIndex)).to.equal(3);
    expect(parseInt(res.Arrays[2].body.tx.returnValues.minLeafIndex)).to.equal(6);
  });
  it('Check number of commitments', async () => {
    expect(res.Arrays[3].body.commitments.length).to.equal(7);
  });
  it('Check nullified commitments', async () => {
    expect(res.Arrays[4].body.commitments[0].isNullified).to.equal(true);
    expect(res.Arrays[4].body.commitments[1].isNullified).to.equal(true);
    expect(res.Arrays[4].body.commitments[2].isNullified).to.equal(false);
    expect(res.Arrays[5].body.commitments[0].isNullified).to.equal(false);
    expect(res.Arrays[6].body.commitments[0].isNullified).to.equal(true);
    expect(res.Arrays[6].body.commitments[1].isNullified).to.equal(false);
    expect(res.Arrays[7].body.commitments[0].isNullified).to.equal(false);
  });
  it('Check value of final commitments', async () => {
    expect(parseInt(res.Arrays[4].body.commitments[2].preimage.value)).to.equal(2);
    expect(parseInt(res.Arrays[5].body.commitments[0].preimage.value)).to.equal(0);
    expect(parseInt(res.Arrays[6].body.commitments[1].preimage.value)).to.equal(0);
    expect(parseInt(res.Arrays[7].body.commitments[0].preimage.value)).to.equal(9);
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.Arrays[9].body.tx.event).to.equal('NewLeaves');
    expect(parseInt(res.Arrays[10].body.commitments[1].preimage.value)).to.equal(0);
    expect(res.Arrays[10].body.commitments[1].isNullified).to.equal(false);
    expect(parseInt(res.Arrays[11].body.commitments[0].preimage.value)).to.equal(7);
    expect(res.Arrays[11].body.commitments[0].isNullified).to.equal(false);
  });
  it('Test getBalance', async () => {
    expect(parseInt(res.Arrays[12].body.totalBalance)).to.equal(16);
    expect(parseInt(res.Arrays[13].body.totalBalance)).to.equal(9);
  });
});

describe('Assign Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.Assign[0].body.tx.event).to.equal('NewLeaves');
    expect(res.Assign[1].body.tx.event).to.equal('NewLeaves');
    expect(res.Assign[3].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.Assign[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.Assign[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
    expect(parseInt(res.Assign[3].body.tx.returnValues.minLeafIndex)).to.equal(2);
  });
  it('test getBalance', async () => {
    expect(parseInt(res.Assign[2].body.totalBalance)).to.equal(19);
    expect(parseInt(res.Assign[4].body.totalBalance)).to.equal(3);
  });
  it('Check number of commitments', async () => {
    expect(res.Assign[5].body.commitments.length).to.equal(3);
  });
  it('Check nullified commitments', async () => {
    expect(res.Assign[6].body.commitments[0].isNullified).to.equal(true);
    expect(res.Assign[6].body.commitments[1].isNullified).to.equal(true);
    expect(res.Assign[6].body.commitments[2].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.Assign[6].body.commitments[2].preimage.value)).to.equal(3);
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.Assign[8].body.commitments.length).to.equal(3);
    expect(res.Assign[8].body.commitments[0].isNullified).to.equal(true);
    expect(res.Assign[8].body.commitments[1].isNullified).to.equal(true);
    expect(res.Assign[8].body.commitments[2].isNullified).to.equal(false);
    expect(res.Assign[9].body.tx.event).to.equal('NewLeaves');
  });
});

describe('Assign-api Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.Assign_api[0].body.tx.event).to.equal('NewLeaves');
    expect(res.Assign_api[1].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.Assign_api[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.Assign_api[1].body.tx.returnValues.minLeafIndex)).to.equal(3);
  });
  it('test public read only function', async () => {
    expect(parseInt(res.Assign_api[3].body.publicReturns)).to.equal(50);
  })
  it('Check number of commitments', async () => {
    expect(res.Assign_api[4].body.commitments.length).to.equal(4);
  });
  it('Check nullified commitments', async () => {
    expect(res.Assign_api[5].body.commitments[0].isNullified).to.equal(true);
    expect(res.Assign_api[5].body.commitments[1].isNullified).to.equal(true);
    expect(res.Assign_api[5].body.commitments[2].isNullified).to.equal(true);
    expect(res.Assign_api[5].body.commitments[3].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.Assign_api[5].body.commitments[3].preimage.value)).to.equal(5);
  });
});

describe('BucketsOfBalls Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.BucketsOfBalls[0].body.tx.event).to.equal('NewLeaves');
    expect(res.BucketsOfBalls[1].body.tx.event).to.equal('NewLeaves');
    expect(res.BucketsOfBalls[2].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(
      parseInt(res.BucketsOfBalls[0].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(0);
    expect(
      parseInt(res.BucketsOfBalls[1].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(1);
    expect(
      parseInt(res.BucketsOfBalls[2].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(2);
  });
  it('Check number of commitments', async () => {
    expect(res.BucketsOfBalls[3].body.commitments.length).to.equal(4);
  });
  it('Check nullified commitments', async () => {
    expect(res.BucketsOfBalls[4].body.commitments[0].isNullified).to.equal(
      true,
    );
    expect(res.BucketsOfBalls[4].body.commitments[1].isNullified).to.equal(
      true,
    );
    expect(res.BucketsOfBalls[4].body.commitments[2].isNullified).to.equal(
      false,
    );
    expect(res.BucketsOfBalls[5].body.commitments[0].isNullified).to.equal(
      false,
    );
  });
  it('Check value of final commitment', async () => {
    expect(
      parseInt(res.BucketsOfBalls[4].body.commitments[2].preimage.value, 10),
    ).to.equal(5);
    expect(
      parseInt(res.BucketsOfBalls[5].body.commitments[0].preimage.value, 10),
    ).to.equal(8);
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.BucketsOfBalls[7].body.commitments.length).to.equal(3);
    expect(res.BucketsOfBalls[8].body.tx.event).to.equal('NewLeaves');
  });
  it('Test getBalanceByState', async () => {
    expect(parseInt(res.BucketsOfBalls[9].body.totalBalance, 10)).to.equal(3);
    expect(parseInt(res.BucketsOfBalls[10].body.totalBalance, 10)).to.equal(2);
  });
});

describe('CharityPot Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.CharityPot[0].body.tx.event).to.equal('NewLeaves');
    expect(res.CharityPot[1].body.tx.event).to.equal('NewLeaves');
    expect(res.CharityPot[2].body.tx.event).to.equal('NewLeaves');
    expect(res.CharityPot[3].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(
      parseInt(res.CharityPot[0].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(0);
    expect(
      parseInt(res.CharityPot[1].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(3);
    expect(
      parseInt(res.CharityPot[2].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(7);
    expect(
      parseInt(res.CharityPot[3].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(9);
  });
  it('Check number of commitments', async () => {
    expect(res.CharityPot[4].body.commitments.length).to.equal(3);
    expect(res.CharityPot[5].body.commitments.length).to.equal(8);
  });
  it('Check nullified commitments', async () => {
    expect(res.CharityPot[4].body.commitments[0].isNullified).to.equal(true);
    expect(res.CharityPot[4].body.commitments[1].isNullified).to.equal(true);
    expect(res.CharityPot[4].body.commitments[2].isNullified).to.equal(false);
    expect(res.CharityPot[5].body.commitments[0].isNullified).to.equal(true);
    expect(res.CharityPot[5].body.commitments[1].isNullified).to.equal(true);
    expect(res.CharityPot[5].body.commitments[2].isNullified).to.equal(true);
    expect(res.CharityPot[5].body.commitments[3].isNullified).to.equal(true);
    expect(res.CharityPot[5].body.commitments[4].isNullified).to.equal(true);
    expect(res.CharityPot[5].body.commitments[5].isNullified).to.equal(true);
    expect(res.CharityPot[5].body.commitments[6].isNullified).to.equal(false);
    expect(res.CharityPot[5].body.commitments[7].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(
      parseInt(res.CharityPot[4].body.commitments[2].preimage.value, 10),
    ).to.equal(13);
    expect(
      parseInt(res.CharityPot[5].body.commitments[6].preimage.value, 10),
    ).to.equal(30);
    expect(
      parseInt(res.CharityPot[5].body.commitments[7].preimage.value, 10),
    ).to.equal(7);
  });
  // Note: commitments that are created and immediately nullified during
  // join and split commitments are not restored by backupDataRetriever
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.CharityPot[7].body.commitments.length).to.equal(7);
    expect(res.CharityPot[7].body.commitments[0].isNullified).to.equal(true);
    expect(res.CharityPot[7].body.commitments[1].isNullified).to.equal(true);
    expect(res.CharityPot[7].body.commitments[2].isNullified).to.equal(true);
    expect(res.CharityPot[7].body.commitments[3].isNullified).to.equal(false);
    expect(res.CharityPot[7].body.commitments[4].isNullified).to.equal(true);
    expect(res.CharityPot[7].body.commitments[5].isNullified).to.equal(false);
    expect(res.CharityPot[7].body.commitments[6].isNullified).to.equal(false);
    expect(res.CharityPot[8].body.tx.event).to.equal('NewLeaves');
  });
});

describe('Constructor Zapp', () => {
  it('test constructor is working', async () => {
    expect(res.Constructor[0].body.commitments[0].isNullified).to.equal(false);
    expect(parseInt(res.Constructor[0].body.commitments[0].preimage.value)).to.equal(5);
  });
  it('tests APIs are working', async () => {
    expect(res.Constructor[1].body.tx.event).to.equal('NewLeaves');
    expect(res.Constructor[2].body.tx.event).to.equal('NewLeaves');
    expect(res.Constructor[4].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.Constructor[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
    expect(parseInt(res.Constructor[2].body.tx.returnValues.minLeafIndex)).to.equal(2);
    expect(parseInt(res.Constructor[4].body.tx.returnValues.minLeafIndex)).to.equal(3);
  });
  it('test getBalance', async () => {
    expect(parseInt(res.Constructor[3].body.totalBalance)).to.equal(31);
    expect(parseInt(res.Constructor[5].body.totalBalance)).to.equal(19);
  });
  it('Check number of commitments', async () => {
    expect(res.Constructor[6].body.commitments.length).to.equal(4);
  });
  it('Check nullified commitments', async () => {
    expect(res.Constructor[6].body.commitments[0].isNullified).to.equal(true);
    expect(res.Constructor[6].body.commitments[1].isNullified).to.equal(true);
    expect(res.Constructor[6].body.commitments[2].isNullified).to.equal(true);
    expect(res.Constructor[6].body.commitments[3].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.Constructor[6].body.commitments[3].preimage.value)).to.equal(19);
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.Constructor[8].body.commitments.length).to.equal(4);
    expect(res.Constructor[8].body.commitments[0].isNullified).to.equal(true);
    expect(res.Constructor[8].body.commitments[1].isNullified).to.equal(true);
    expect(res.Constructor[8].body.commitments[2].isNullified).to.equal(true);
    expect(res.Constructor[8].body.commitments[3].isNullified).to.equal(false);
    expect(res.Constructor[9].body.tx.event).to.equal('NewLeaves');
  });
});

describe('Encrypt Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.Encrypt[0].body.tx.event).to.equal('NewLeaves');
    expect(res.Encrypt[1].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.Encrypt[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.Encrypt[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
  });
  it('Check number of commitments', async () => {
    expect(res.Encrypt[2].body.commitments.length).to.equal(3);
  });
  it('Check nullified commitments', async () => {
    expect(res.Encrypt[3].body.commitments[0].isNullified).to.equal(false);
    expect(res.Encrypt[4].body.commitments[0].isNullified).to.equal(false);
    expect(res.Encrypt[4].body.commitments[1].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.Encrypt[3].body.commitments[0].preimage.value)).to.equal(5);
    expect(parseInt(res.Encrypt[4].body.commitments[0].preimage.value)).to.equal(12);
    expect(parseInt(res.Encrypt[4].body.commitments[1].preimage.value)).to.equal(10);
  });
});

describe('Escrow Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.Escrow[0].body.tx.event).to.equal('NewLeaves');
    expect(res.Escrow[1].body.tx.event).to.equal('NewLeaves');
    expect(res.Escrow[2].body.tx.event).to.equal('NewLeaves');
    expect(res.Escrow[3].body.tx.event).to.equal('NewLeaves');
    expect(res.Escrow[4].body.tx.event).to.equal('NewLeaves');
    expect(res.Escrow[5].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(
      parseInt(res.Escrow[0].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(0);
    expect(
      parseInt(res.Escrow[1].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(1);
    expect(
      parseInt(res.Escrow[2].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(2);
    expect(
      parseInt(res.Escrow[3].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(6);
    expect(
      parseInt(res.Escrow[4].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(7);
    expect(
      parseInt(res.Escrow[5].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(10);
  });
  it('Check number of commitments', async () => {
    expect(res.Escrow[6].body.commitments.length).to.equal(12);
  });
  it('Check nullified commitments', async () => {
    expect(res.Escrow[7].body.commitments[0].isNullified).to.equal(true);
    expect(res.Escrow[7].body.commitments[1].isNullified).to.equal(true);
    expect(res.Escrow[7].body.commitments[2].isNullified).to.equal(true);
    expect(res.Escrow[7].body.commitments[3].isNullified).to.equal(true);
    expect(res.Escrow[7].body.commitments[4].isNullified).to.equal(true);
    expect(res.Escrow[7].body.commitments[5].isNullified).to.equal(true);
    expect(res.Escrow[7].body.commitments[6].isNullified).to.equal(true);
    expect(res.Escrow[7].body.commitments[7].isNullified).to.equal(true);
    expect(res.Escrow[7].body.commitments[8].isNullified).to.equal(false);
    expect(res.Escrow[8].body.commitments[0].isNullified).to.equal(false);
    expect(res.Escrow[8].body.commitments[1].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(
      parseInt(res.Escrow[7].body.commitments[8].preimage.value, 10),
    ).to.equal(27);
    expect(
      parseInt(res.Escrow[8].body.commitments[0].preimage.value, 10),
    ).to.equal(13);
    expect(
      parseInt(res.Escrow[8].body.commitments[1].preimage.value, 10),
    ).to.equal(1);
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.Escrow[10].body.commitments.length).to.equal(8);
    expect(res.Escrow[11].body.commitments[0].isNullified).to.equal(true);
    expect(res.Escrow[11].body.commitments[1].isNullified).to.equal(true);
    expect(res.Escrow[11].body.commitments[2].isNullified).to.equal(true);
    expect(res.Escrow[11].body.commitments[3].isNullified).to.equal(true);
    expect(res.Escrow[11].body.commitments[4].isNullified).to.equal(false);
    expect(res.Escrow[12].body.commitments[0].isNullified).to.equal(false);
    expect(res.Escrow[12].body.commitments[1].isNullified).to.equal(false);
    expect(res.Escrow[13].body.tx.event).to.equal('NewLeaves');
  });
});

describe('for-loop Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.forloop[0].body.tx.event).to.equal('NewLeaves');
    expect(res.forloop[1].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.forloop[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.forloop[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
  });
  it('Check number of commitments', async () => {
    expect(res.forloop[2].body.commitments.length).to.equal(2);
  });
  it('Check nullified commitments', async () => {
    expect(res.forloop[3].body.commitments[0].isNullified).to.equal(true);
    expect(res.forloop[3].body.commitments[1].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.forloop[3].body.commitments[1].preimage.value)).to.equal(95);
  });
});

describe('If-Statement Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.IfStatement[0].body.tx.event).to.equal('NewLeaves');
    expect(res.IfStatement[1].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.IfStatement[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.IfStatement[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
  });
  it('Check number of commitments', async () => {
    expect(res.IfStatement[2].body.commitments.length).to.equal(2);
  });
  it('Check nullified commitments', async () => {
    expect(res.IfStatement[3].body.commitments[0].isNullified).to.equal(true);
    expect(res.IfStatement[3].body.commitments[1].isNullified).to.equal(false);
  });
  it('Check value of commitments', async () => {
    expect(parseInt(res.IfStatement[3].body.commitments[0].preimage.value)).to.equal(17);
    expect(parseInt(res.IfStatement[3].body.commitments[1].preimage.value)).to.equal(4);
  });
  it('test stateVarId ', async () => {
    expect(res.IfStatement[3].body.commitments[0].preimage.stateVarId).to.equal(res.IfStatement[3].body.commitments[1].preimage.stateVarId);
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.IfStatement[5].body.commitments.length).to.equal(2);
    expect(res.IfStatement[6].body.tx.event).to.equal('NewLeaves');
  });
});

/*describe('InternalFunctionCall Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.InternalFunctionCall[0].body.tx.event).to.equal('NewLeaves');
    expect(res.InternalFunctionCall[1].body.tx.event).to.equal('NewLeaves');
    expect(res.InternalFunctionCall[2].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.InternalFunctionCall[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.InternalFunctionCall[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
    expect(parseInt(res.InternalFunctionCall[2].body.tx.returnValues.minLeafIndex)).to.equal(2);
  });
  it('Check number of commitments', async () => {
    expect(res.InternalFunctionCall[3].body.commitments.length).to.equal(4);
  });
  it('Check nullified commitments', async () => {
    expect(res.InternalFunctionCall[4].body.commitments[0].isNullified).to.equal(true);
    expect(res.InternalFunctionCall[4].body.commitments[1].isNullified).to.equal(true);
    expect(res.InternalFunctionCall[4].body.commitments[2].isNullified).to.equal(false);
    expect(res.InternalFunctionCall[5].body.commitments[0].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.InternalFunctionCall[4].body.commitments[2].preimage.value)).to.equal(5);
    expect(parseInt(res.InternalFunctionCall[5].body.commitments[0].preimage.value)).to.equal(29);
  });
});*/

describe('MappingtoStruct Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.MappingtoStruct[0].body.tx.event).to.equal('NewLeaves');
    expect(res.MappingtoStruct[1].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.MappingtoStruct[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.MappingtoStruct[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
  });
  it('Check number of commitments', async () => {
    expect(res.MappingtoStruct[2].body.commitments.length).to.equal(2);
  });
  it('Check nullified commitments', async () => {
    expect(res.MappingtoStruct[3].body.commitments[0].isNullified).to.equal(true);
    expect(res.MappingtoStruct[3].body.commitments[1].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.MappingtoStruct[3].body.commitments[1].preimage.value.prop1)).to.equal(15);
    expect(parseInt(res.MappingtoStruct[3].body.commitments[1].preimage.value.prop2)).to.equal(16);
    expect(parseInt(res.MappingtoStruct[3].body.commitments[1].preimage.value.prop3)).to.equal(17);
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.MappingtoStruct[5].body.commitments.length).to.equal(2);
    expect(res.MappingtoStruct[6].body.tx.event).to.equal('NewLeaves');
  });
});

describe('NFT_Escrow Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.NFT_Escrow[0].body.tx.event).to.equal('NewLeaves');
    expect(res.NFT_Escrow[1].body.tx.event).to.equal('NewLeaves');
    expect(res.NFT_Escrow[2].body.tx.event).to.equal('NewLeaves');
    expect(res.NFT_Escrow[3].body.tx.event).to.equal('NewLeaves');
    expect(res.NFT_Escrow[5].body.tx.event).to.equal('NewLeaves');
    expect(res.NFT_Escrow[6].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(
      parseInt(res.NFT_Escrow[0].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(0);
    expect(
      parseInt(res.NFT_Escrow[1].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(1);
    expect(
      parseInt(res.NFT_Escrow[2].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(2);
    expect(
      parseInt(res.NFT_Escrow[3].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(3);
    expect(
      parseInt(res.NFT_Escrow[5].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(4);
    expect(
      parseInt(res.NFT_Escrow[6].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(5);
  });
  it('Check number of commitments', async () => {
    expect(res.NFT_Escrow[7].body.commitments.length).to.equal(6);
  });
  it('Check nullified commitments', async () => {
    expect(res.NFT_Escrow[8].body.commitments[0].isNullified).to.equal(true);
    expect(res.NFT_Escrow[8].body.commitments[1].isNullified).to.equal(false);
    expect(res.NFT_Escrow[9].body.commitments[0].isNullified).to.equal(true);
    expect(res.NFT_Escrow[10].body.commitments[0].isNullified).to.equal(true);
    expect(res.NFT_Escrow[10].body.commitments[1].isNullified).to.equal(false);
  });
  it('Check values of commitment', async () => {
    expect(
      parseInt(res.NFT_Escrow[8].body.commitments[0].preimage.value, 10),
    ).to.equal(1390849295786071768276380950238675083608645509734);
    expect(
      parseInt(res.NFT_Escrow[8].body.commitments[1].preimage.value, 10),
    ).to.equal(235);
    expect(
      parseInt(res.NFT_Escrow[9].body.commitments[0].preimage.value, 10),
    ).to.equal(1390849295786071768276380950238675083608645509734);
    expect(
      parseInt(res.NFT_Escrow[10].body.commitments[0].preimage.value, 10),
    ).to.equal(1390849295786071768276380950238675083608645509734);
    expect(
      parseInt(res.NFT_Escrow[10].body.commitments[1].preimage.value, 10),
    ).to.equal(578);
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    expect(res.NFT_Escrow[12].body.commitments.length).to.equal(6);
    expect(res.NFT_Escrow[13].body.commitments[0].isNullified).to.equal(true);
    expect(res.NFT_Escrow[13].body.commitments[1].isNullified).to.equal(false);
    expect(res.NFT_Escrow[14].body.commitments[0].isNullified).to.equal(true);
    expect(res.NFT_Escrow[15].body.commitments[0].isNullified).to.equal(true);
    expect(res.NFT_Escrow[15].body.commitments[1].isNullified).to.equal(false);
  });
});

describe('Return Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.Return[0].body.tx.event).to.equal('NewLeaves');
    expect(res.Return[1].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.Return[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.Return[1].body.tx.returnValues.minLeafIndex)).to.equal(3);
  });
  it('Check number of commitments', async () => {
    expect(res.Return[2].body.commitments.length).to.equal(4);
  });
  it('Check nullified commitments', async () => {
    expect(res.Return[3].body.commitments[0].isNullified).to.equal(true);
    expect(res.Return[3].body.commitments[1].isNullified).to.equal(true);
    expect(res.Return[3].body.commitments[2].isNullified).to.equal(true);
    expect(res.Return[3].body.commitments[3].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.Return[3].body.commitments[3].preimage.value)).to.equal(4);
  });
});

describe('SimpleStruct Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.SimpleStruct[0].body.tx.event).to.equal('NewLeaves');
    expect(res.SimpleStruct[1].body.tx.event).to.equal('NewLeaves');
    expect(res.SimpleStruct[2].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.SimpleStruct[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.SimpleStruct[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
    expect(parseInt(res.SimpleStruct[2].body.tx.returnValues.minLeafIndex)).to.equal(2);
  });
  it('Check number of commitments', async () => {
    expect(res.SimpleStruct[3].body.commitments.length).to.equal(4);
  });
  it('Check nullified commitments', async () => {
    expect(res.SimpleStruct[4].body.commitments[0].isNullified).to.equal(true);
    expect(res.SimpleStruct[4].body.commitments[1].isNullified).to.equal(true);
    expect(res.SimpleStruct[4].body.commitments[2].isNullified).to.equal(false);
    expect(res.SimpleStruct[5].body.commitments[0].isNullified).to.equal(false);
  });
  it('Check value of final commitment', async () => {
    expect(parseInt(res.SimpleStruct[4].body.commitments[2].preimage.value)).to.equal(67);
    expect(parseInt(res.SimpleStruct[5].body.commitments[0].preimage.value)).to.equal(28);
  });
});


describe('InternalFunctionCallTest1 Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.InternalFunctionCallTest1[0].body.tx.event).to.equal('NewLeaves');
    expect(res.InternalFunctionCallTest1[1].body.tx.event).to.equal('NewLeaves');
    expect(res.InternalFunctionCallTest1[3].body.tx.event).to.equal('NewLeaves');
    expect(res.InternalFunctionCallTest1[4].body.tx.event).to.equal('NewLeaves');
  });
  it('Check value after internal function call intialize', async () => {
    expect(res.InternalFunctionCallTest1[2].body.commitments[0].isNullified).to.equal(true);
    expect(res.InternalFunctionCallTest1[2].body.commitments[1].isNullified).to.equal(false);
    expect(parseInt(res.InternalFunctionCallTest1[2].body.commitments[0].preimage.value)).to.equal(92);
    expect(parseInt(res.InternalFunctionCallTest1[2].body.commitments[1].preimage.value)).to.equal(125);
  });
  it('Check value after internal function call after update', async () => {
    expect(res.InternalFunctionCallTest1[5].body.commitments[0].isNullified).to.equal(true);
    expect(res.InternalFunctionCallTest1[5].body.commitments[1].isNullified).to.equal(true);
    expect(res.InternalFunctionCallTest1[5].body.commitments[2].isNullified).to.equal(true);
    expect(res.InternalFunctionCallTest1[5].body.commitments[3].isNullified).to.equal(false);
    expect(parseInt(res.InternalFunctionCallTest1[5].body.commitments[2].preimage.value)).to.equal(251);
    expect(parseInt(res.InternalFunctionCallTest1[5].body.commitments[3].preimage.value)).to.equal(306);
  });
});

describe('Swap Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.Swap[0].body.tx.event).to.equal('NewLeaves'); // deposit 1
    expect(res.Swap[1].body.tx.event).to.equal('NewLeaves'); // deposit 2
    expect(res.Swap[3].body.tx.event).to.equal('NewLeaves'); // startSwap
    expect(res.Swap[5].body.tx.event).to.equal('NewLeaves'); // completeSwap
  });

  it('MinLeaf Index check', async () => {
    expect(
      parseInt(res.Swap[0].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(0); // deposit 1
    expect(
      parseInt(res.Swap[1].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(2); // deposit 2
    expect(
      parseInt(res.Swap[3].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(4); // startSwap
    expect(
      parseInt(res.Swap[5].body.tx.returnValues.minLeafIndex, 10),
    ).to.equal(7); // completeSwap
  });

  it('Check number of commitments', async () => {
    expect(res.Swap[2].body.commitments.length).to.equal(4);
    expect(res.Swap[4].body.commitments.length).to.equal(7);
    expect(res.Swap[6].body.commitments.length).to.equal(11);
  });

  it('Check nullified commitments', async () => {
    expect(res.Swap[2].body.commitments[0].isNullified).to.equal(true);
    expect(res.Swap[2].body.commitments[1].isNullified).to.equal(false);
    expect(res.Swap[2].body.commitments[2].isNullified).to.equal(false);
    expect(res.Swap[2].body.commitments[3].isNullified).to.equal(false);

    expect(res.Swap[4].body.commitments[0].isNullified).to.equal(true);
    expect(res.Swap[4].body.commitments[1].isNullified).to.equal(true);
    expect(res.Swap[4].body.commitments[2].isNullified).to.equal(true);
    expect(res.Swap[4].body.commitments[3].isNullified).to.equal(false);
    expect(res.Swap[4].body.commitments[4].isNullified).to.equal(false);
    expect(res.Swap[4].body.commitments[5].isNullified).to.equal(false);
    expect(res.Swap[4].body.commitments[6].isNullified).to.equal(false);

    expect(res.Swap[6].body.commitments[0].isNullified).to.equal(true);
    expect(res.Swap[6].body.commitments[1].isNullified).to.equal(true);
    expect(res.Swap[6].body.commitments[2].isNullified).to.equal(true);
    expect(res.Swap[6].body.commitments[3].isNullified).to.equal(true);
    expect(res.Swap[6].body.commitments[4].isNullified).to.equal(true);
    expect(res.Swap[6].body.commitments[5].isNullified).to.equal(true);
    expect(res.Swap[6].body.commitments[6].isNullified).to.equal(true);
    expect(res.Swap[6].body.commitments[7].isNullified).to.equal(false);
    expect(res.Swap[6].body.commitments[8].isNullified).to.equal(false);
    expect(res.Swap[6].body.commitments[9].isNullified).to.equal(false);
    expect(res.Swap[6].body.commitments[10].isNullified).to.equal(false);
  });

  it('Check value of final commitment', async () => {
    expect(
      parseInt(res.Swap[6].body.commitments[0].preimage.value, 10),
    ).to.equal(100); // deposit 1
    expect(
      parseInt(res.Swap[6].body.commitments[2].preimage.value, 10),
    ).to.equal(200); // deposit 2
    expect(res.Swap[6].body.commitments[4].name).to.equal("balances");
    expect(
      parseInt(res.Swap[6].body.commitments[4].preimage.value, 10),
    ).to.equal(170); // startSwap balance: 200-30
    expect(res.Swap[6].body.commitments[6].name).to.equal("swapProposals");
    expect(res.Swap[6].body.commitments[6].preimage.value).to.deep.equal({
      swapAmountSent: '30',
      swapTokenSent: '1',
      swapTokenRecieved: '2',
      swapInitiator: '1390849295786071768276380950238675083608645509734',
      pendingStatus: '1',
    });
    expect(res.Swap[6].body.commitments[10].name).to.equal("swapProposals");
    expect(res.Swap[6].body.commitments[10].preimage.value).to.deep.equal({
      swapAmountSent: '0',
      swapTokenSent: '1',
      swapTokenRecieved: '2',
      swapInitiator: '1390849295786071768276380950238675083608645509734',
      pendingStatus: '0',
    });
  });
  it('Check commitments are correct after deleting and restoring from backup', async () => {
    // Note the order of the commitments has changed because some are decrypted with the shared secret key
    expect(res.Swap[8].body.commitments.length).to.equal(11);
    expect(res.Swap[8].body.commitments[0].isNullified).to.equal(true);
    expect(res.Swap[8].body.commitments[1].isNullified).to.equal(true);
    expect(res.Swap[8].body.commitments[2].isNullified).to.equal(true);
    expect(res.Swap[8].body.commitments[3].isNullified).to.equal(true);
    expect(res.Swap[8].body.commitments[4].isNullified).to.equal(true);
    expect(res.Swap[8].body.commitments[5].isNullified).to.equal(true);
    expect(res.Swap[8].body.commitments[6].isNullified).to.equal(false);
    expect(res.Swap[8].body.commitments[7].isNullified).to.equal(false);
    expect(res.Swap[8].body.commitments[8].isNullified).to.equal(false);
    expect(res.Swap[8].body.commitments[9].isNullified).to.equal(true);
    expect(res.Swap[8].body.commitments[10].isNullified).to.equal(false);
    expect(
      parseInt(res.Swap[8].body.commitments[0].preimage.value, 10),
    ).to.equal(100); // deposit 1
    expect(
      parseInt(res.Swap[8].body.commitments[2].preimage.value, 10),
    ).to.equal(200); // deposit 2
    expect(res.Swap[8].body.commitments[4].name).to.equal("balances");
    expect(
      parseInt(res.Swap[8].body.commitments[4].preimage.value, 10),
    ).to.equal(170); // startSwap balance: 200-30
    expect(res.Swap[8].body.commitments[9].name).to.equal("swapProposals");
    expect(res.Swap[8].body.commitments[9].preimage.value).to.deep.equal({
      swapAmountSent: '30',
      swapTokenSent: '1',
      swapTokenRecieved: '2',
      swapInitiator: '1390849295786071768276380950238675083608645509734',
      pendingStatus: '1',
    });
    expect(res.Swap[8].body.commitments[10].name).to.equal("swapProposals");
    expect(res.Swap[8].body.commitments[10].preimage.value).to.deep.equal({
      swapAmountSent: '0',
      swapTokenSent: '1',
      swapTokenRecieved: '2',
      swapInitiator: '1390849295786071768276380950238675083608645509734',
      pendingStatus: '0',
    });
  });
});
