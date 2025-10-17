const fs = require('fs')
const path = require('path')

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
    ast: null,  // Add AST field
    bytecode: '',  // Add bytecode field
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
  const hardhatArtifactPath =
    hardhatArtifactContractPath + contractPath +
    '/' + contractName + '.sol' +
    '/' +
    contractName +
    '.json'

  // Get ABI and bytecode from the artifact
  const compilationData = fs.readFileSync(hardhatArtifactPath, 'utf-8')
  const artifactData = JSON.parse(compilationData)
  const abi = artifactData.abi
  const bytecode = artifactData.bytecode
  const contractNameFromHardhat = artifactData.contractName

  // Get AST from build-info directory
  let ast = null
  const buildInfoDir = path.join('./artifacts/build-info')
  
  try {
    if (fs.existsSync(buildInfoDir)) {
      const buildInfoFiles = fs.readdirSync(buildInfoDir)
      
        const pathVariations = [
          `contracts${contractPath}/${contractName}.sol`,
          `contracts/${contractName}.sol`,
          `${contractPath}/${contractName}.sol`.replace(/^\//, '')
        ]
        
        for (const file of buildInfoFiles) {
          const buildInfoPath = path.join(buildInfoDir, file)
          const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf-8'))
          
          for (const pathVariant of pathVariations) {
            if (buildInfo.output?.sources?.[pathVariant]?.ast) {
              ast = buildInfo.output.sources[pathVariant].ast
              break
            }
          }
      }
    } else {
      console.error('Build-info directory not found at:', buildInfoDir)
    }
  } catch (error) {
    console.error('Error reading AST from build-info:', error.message)
  }

  // Prepare final metadata
  deployedMetadata.abi = abi
  deployedMetadata.bytecode = bytecode
  deployedMetadata.ast = ast
  deployedMetadata.contractName = contractNameFromHardhat
  deployedPositionMetadata.address = contractDeployedAddress
  deployedPositionMetadata.blockNumber = blockNumber
  deployedPositionMetadata.transactionHash = transactionHash
  deployedMetadata.networks[networkId] = deployedPositionMetadata

  console.log('\nWriting metadata to:', deployedFileName)
  fs.writeFileSync(deployedFileName, JSON.stringify(deployedMetadata, null, 2), "utf-8")
}

module.exports = {
  saveMetadata
}