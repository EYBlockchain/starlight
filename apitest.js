
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import shell from 'shelljs'
import logger from "./built/utils/logger.js";

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const callZAppAPIs = async (zappName , apiRequests, errorMessage) => {
  if (shell.exec(`./apiactions -z ${zappName}`).code !== 0) {
    shell.echo(`${zappName} failed`);
    shell.exit(1);
  }
  // wait for above shell command to execute
  await new Promise(resolve => setTimeout(resolve, 5000));
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
    }
  }
  if (shell.exec('docker stop $(docker ps -q)').code !== 0) {
    shell.echo('docker stop failed');
    shell.exit(1);
  }
  await new Promise(resolve => setTimeout(resolve, 5000));
  return apiResponses;
};

let res = {};

const apiRequests_Assign = [
  { method: 'post', endpoint: '/add', data: { value: 11 } },
  { method: 'post', endpoint: '/add', data: { value: 8 } },
  { method: 'post', endpoint: '/remove', data: { value: 16 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'a' } },
];

res.Assign = await callZAppAPIs('Assign', apiRequests_Assign, 'Assign Zapp failed')

const apiRequests_IfStatement = [
  { method: 'post', endpoint: '/add', data: { y: 14 } },
  { method: 'post', endpoint: '/add', data: { y: 23 } },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'x', mappingKey: '827641930419614124039720421795580660909102123457'} },
  { method: 'get', endpoint: '/getCommitmentsByVariableName', data: { name: 'z'} },
];

res.IfStatement = await callZAppAPIs('If-Statement', apiRequests_IfStatement, 'If-Statement Zapp failed')

const apiRequests_internalFunctionCallTest1 = [
  { method: 'post', endpoint: '/add', data: { value: 46 } },
  { method: 'post', endpoint: '/remove', data: { value: 33} },
  { method: 'get', endpoint: '/getAllCommitments' },
  { method: 'post', endpoint: '/add', data: { value: 63 } },
  { method: 'post', endpoint: '/remove', data: { value: 55} },
  { method: 'get', endpoint: '/getAllCommitments' },
];

res.InternalFunctionCallTest1 = await callZAppAPIs('internalFunctionCallTest1', apiRequests_internalFunctionCallTest1, 'internalFunctionCallTest1 Zapp failed');

describe('Assign Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.Assign[0].body.tx.event).to.equal('NewLeaves');
    expect(res.Assign[1].body.tx.event).to.equal('NewLeaves');
    expect(res.Assign[2].body.tx.event).to.equal('NewLeaves');
  });
  it('MinLeaf Index check', async () => {
    expect(parseInt(res.Assign[0].body.tx.returnValues.minLeafIndex)).to.equal(0);
    expect(parseInt(res.Assign[1].body.tx.returnValues.minLeafIndex)).to.equal(1);
    expect(parseInt(res.Assign[2].body.tx.returnValues.minLeafIndex)).to.equal(2);
  });
  it('Check commitments', async () => {
    expect(res.Assign[3].body.commitments.length).to.equal(3);
  });
  it('Check nullified commitments', async () => {
    expect(res.Assign[4].body.commitments[0].isNullified).to.equal(true);
    expect(res.Assign[4].body.commitments[1].isNullified).to.equal(true);
    expect(res.Assign[4].body.commitments[2].isNullified).to.equal(false);
  });
});

describe('If-Statement Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.IfStatement[5].body.tx.event).to.equal('NewLeaves');
    expect(res.IfStatement[6].body.tx.event).to.equal('NewLeaves');
  });
  it('test MappingKey response', async () => {
    expect(res.IfStatement[7].body.commitments.length).to.equal(2);
    expect(res.IfStatement[7].body.commitments[0].isNullified).to.equal(true);
    expect(res.IfStatement[7].body.commitments[1].isNullified).to.equal(false);
  });
  it('test stateVarId ', async () => {
    expect(res.IfStatement[9].body.commitments[0].preimage.stateVarId).to.equal(res[9].body.commitments[1].preimage.stateVarId);
    expect(res.IfStatement[9].body.commitments[0].isNullified).to.equal(true);
    expect(res.IfStatement[9].body.commitments[1].isNullified).to.equal(false);
  });
});

describe('InternalFunctionCallTest2 Zapp', () => {
  it('tests APIs are working', async () => {
    expect(res.InternalFunctionCallTest1[10].body.tx.event).to.equal('NewLeaves');
    expect(res.InternalFunctionCallTest1[11].body.tx.event).to.equal('NewLeaves');
    expect(res.InternalFunctionCallTest1[13].body.tx.event).to.equal('NewLeaves');
    expect(res.InternalFunctionCallTest1[14].body.tx.event).to.equal('NewLeaves');
  });
  it('Check value after internal function call intialize', async () => {
    expect(res.InternalFunctionCallTest1[12].body.commitments[0].isNullified).to.equal(true);
    expect(res.InternalFunctionCallTest1[12].body.commitments[1].isNullified).to.equal(false);
    expect(parseInt(res.InternalFunctionCallTest1[12].body.commitments[0].preimage.value)).to.equal(92);
    expect(parseInt(res.InternalFunctionCallTest1[12].body.commitments[1].preimage.value)).to.equal(125);
  });
  it('Check value after internal function call after update', async () => {
    expect(res.InternalFunctionCallTest1[15].body.commitments[0].isNullified).to.equal(true);
    expect(res.InternalFunctionCallTest1[15].body.commitments[1].isNullified).to.equal(true);
    expect(res.InternalFunctionCallTest1[15].body.commitments[2].isNullified).to.equal(true);
    expect(res.InternalFunctionCallTest1[15].body.commitments[3].isNullified).to.equal(false);
    expect(parseInt(res.InternalFunctionCallTest1[15].body.commitments[2].preimage.value)).to.equal(251);
    expect(parseInt(res.InternalFunctionCallTest1[15].body.commitments[3].preimage.value)).to.equal(306);
  });
});