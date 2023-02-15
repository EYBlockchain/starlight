
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import shell from 'shelljs'
import logger from "./built/utils/logger.js";
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
let res = [];

if (shell.exec('./apiactions -z Assign').code !== 0) {
  shell.echo('assign failed');
  shell.exit(1);
}

res[0] = await chai
.request('localhost:3000')
.post('/add')
.send({ value: 11 });

res[1] = await chai
.request('localhost:3000')
.post('/add')
.send({ value: 8 });

res[2] = await chai
.request('localhost:3000')
.post('/remove')
.send({ value: 16 });

res[3] = await chai
.request('localhost:3000')
.get('/getAllCommitments');

res[4] = await chai
.request('localhost:3000')
.get('/getCommitmentsByVariableName')
.send({ name: 'a' });

if (shell.exec('docker stop $(docker ps -q)').code !== 0) {
  shell.echo('docker stop failed');
  shell.exit(1);
}

if (shell.exec('docker rm apiservice').code !== 0) {
  shell.echo('docker stop failed');
  shell.exit(1);
}

await new Promise(resolve => setTimeout(resolve, 5000));

if (shell.exec('./apiactions -z If-Statement').code !== 0) {
  shell.echo('Ifstatement failed');
  shell.exit(1);
}

res[5] = await chai
.request('localhost:3000')
.post('/add')
.send({ y: 14 });

res[6] = await chai
.request('localhost:3000')
.post('/add')
.send({ y: 23 });

res[7] = await chai
.request('localhost:3000')
.get('/getAllCommitments');

res[8] = await chai
.request('localhost:3000')
.get('/getCommitmentsByVariableName')
.send({ name: 'x', mappingKey: '827641930419614124039720421795580660909102123457'});

res[9] = await chai
.request('localhost:3000')
.get('/getCommitmentsByVariableName')
.send({ name: 'z'});

if (shell.exec('docker stop $(docker ps -q)').code !== 0) {
  shell.echo('docker stop failed');
  shell.exit(1);
}

if (shell.exec('docker rm apiservice').code !== 0) {
  shell.echo('docker stop failed');
  shell.exit(1);
}

await new Promise(resolve => setTimeout(resolve, 5000));
if (shell.exec('./apiactions -z internalFunctionCallTest1').code !== 0) {
  shell.echo('InternalFunctionCallTest1 failed');
  shell.exit(1);
}
    res[10] = await chai
      .request('localhost:3000')
      .post('/add')
      .send({ value: 46 });

      res[11] = await chai
      .request('localhost:3000')
      .post('/remove')
      .send({ value: 33});

      res[12] = await chai
      .request('localhost:3000')
      .get('/getAllCommitments');

      res[13] = await chai
      .request('localhost:3000')
      .post('/add')
      .send({ value: 63 });

      res[14] = await chai
      .request('localhost:3000')
      .post('/remove')
      .send({ value: 55});


      res[15] = await chai
      .request('localhost:3000')
      .get('/getAllCommitments');

      if (shell.exec('docker stop $(docker ps -q)').code !== 0) {
        shell.echo('docker stop failed');
        shell.exit(1);
      }

      if (shell.exec('docker rm apiservice').code !== 0) {
        shell.echo('docker stop failed');
        shell.exit(1);
      }

    for (let i=10; i<res.length;i++) {
    logger.info(" results " , res[i].body);
    }

    describe('Assign Zapp', () => {
      it('tests APIs are working', async () => {
        expect(res[0].body.tx.status).to.equal(true);
        expect(res[1].body.tx.status).to.equal(true);
        expect(res[2].body.tx.status).to.equal(true);
      });
      it('MinLeaf Index check', async () => {
        expect(parseInt(res[0].body.tx.events.NewLeaves.returnValues.minLeafIndex)).to.equal(0);
        expect(parseInt(res[1].body.tx.events.NewLeaves.returnValues.minLeafIndex)).to.equal(1);
        expect(parseInt(res[2].body.tx.events.NewLeaves.returnValues.minLeafIndex)).to.equal(2);
      });
      it('Check commitments', async () => {
        expect(res[3].body.commitments.length).to.equal(3);
      });
      it('Check nullified commitments', async () => {
        expect(res[4].body.commitments[0].isNullified).to.equal(true);
        expect(res[4].body.commitments[1].isNullified).to.equal(true);
        expect(res[4].body.commitments[2].isNullified).to.equal(false);
      });
    });

    describe('If-Statement Zapp', () => {
      it('tests APIs are working', async () => {
        expect(res[5].body.tx.status).to.equal(true);
        expect(res[6].body.tx.status).to.equal(true);
      });
      it('test MappingKey response', async () => {
        expect(res[8].body.commitments.length).to.equal(2);
        expect(res[8].body.commitments[0].isNullified).to.equal(true);
        expect(res[8].body.commitments[1].isNullified).to.equal(false);
      });
      it('test stateVarId ', async () => {
        expect(res[9].body.commitments[0].preimage.stateVarId).to.equal(res[9].body.commitments[1].preimage.stateVarId);
        expect(res[9].body.commitments[0].isNullified).to.equal(true);
        expect(res[9].body.commitments[1].isNullified).to.equal(false);
      });
    });

    describe('InternalFunctionCallTest2 Zapp', () => {
      it('tests APIs are working', async () => {
        expect(res[10].body.tx.status).to.equal(true);
        expect(res[11].body.tx.status).to.equal(true);
        expect(res[13].body.tx.status).to.equal(true);
        expect(res[14].body.tx.status).to.equal(true);
      });
      it('Check value after internal function call intialize', async () => {
        expect(res[12].body.commitments[0].isNullified).to.equal(true);
        expect(res[12].body.commitments[1].isNullified).to.equal(false);
        expect(parseInt(res[12].body.commitments[0].preimage.value)).to.equal(92);
        expect(parseInt(res[12].body.commitments[1].preimage.value)).to.equal(125);
      });
      it('Check value after internal function call after update', async () => {
        expect(res[15].body.commitments[0].isNullified).to.equal(true);
        expect(res[15].body.commitments[1].isNullified).to.equal(true);
        expect(res[15].body.commitments[2].isNullified).to.equal(true);
        expect(res[15].body.commitments[3].isNullified).to.equal(false);
        expect(parseInt(res[15].body.commitments[2].preimage.value)).to.equal(251);
        expect(parseInt(res[15].body.commitments[3].preimage.value)).to.equal(306);
      });
    });