const fs = require('fs')

function saveMetadata (
  contractDeployedAddress,
  contractName,
  contractPath,
  networkId,
  blockNumber,
  transactionHash
) {

  const projectFolder = process.env.PROJECT_PATH || '/app'
  const buildFolder = projectFolder + '/build/contracts/'

  if (!fs.existsSync(buildFolder)) {
        fs.mkdirSync(buildFolder, { recursive: true });
      }

  const deployedFileName = buildFolder + contractName + '.json'

  let deployedMetadata = {
    contractName: '',
    abi: {},
    networks: {}
  }
  const deployedPositionMetadata = {
    address: '',
    transactionHash: '',
    blockNumber: 0
  }

  if (fs.existsSync(deployedFileName)) {
    const oldDeployedMetadata = JSON.parse(fs.readFileSync(deployedFileName, 'utf-8'))
    if (oldDeployedMetadata.contractName === contractName) {
      deployedMetadata = oldDeployedMetadata
    }
  }


  const hardhatArtifactContractPath = './artifacts/contracts'
  // console.log("hardhatArtifactContractPath: ", hardhatArtifactContractPath);
  const hardhatArtifactPath =
    hardhatArtifactContractPath + contractPath +
    '/' + contractName + '.sol' +
    '/' +
    contractName +
    '.json'
  // console.log("hardhatArtifactPath: ", hardhatArtifactPath);

  const compilationData = fs.readFileSync(hardhatArtifactPath, 'utf-8')
  const abi = JSON.parse(compilationData).abi
  const contractNameFromHardhat = JSON.parse(compilationData).contractName

  deployedMetadata.abi = abi
  deployedMetadata.contractName = contractNameFromHardhat
  deployedPositionMetadata.address = contractDeployedAddress
  deployedPositionMetadata.blockNumber = blockNumber
  deployedPositionMetadata.transactionHash = transactionHash
  deployedMetadata.networks[networkId] = deployedPositionMetadata

  console.log('Writing: ...')
  fs.writeFileSync(deployedFileName, JSON.stringify(deployedMetadata, null, 2), "utf-8")
}

module.exports = {
  saveMetadata
}