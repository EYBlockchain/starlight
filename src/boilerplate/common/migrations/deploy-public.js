
const hre = require('hardhat')
const fs = require('fs');
const c = require('config');
CUSTOM_CONTRACT_IMPORT
CUSTOM_PROOF_IMPORT
const saveMetadata = require('./metadata').saveMetadata


async function main () {
   try {
  
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
	
    CUSTOM_CONTRACTS
	// Deploy AssignShield 
	const CONTRACT_NAME = await hre.ethers.getContractFactory('CONTRACT_NAME');
    const contractShield = await CONTRACT_NAME.deploy(CUSTOM_INPUTS);
    await contractShield.waitForDeployment();
    const contractAddress = await contractShield.getAddress();
    blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log('CONTRACT_NAME deployed to:', contractAddress);
    deployTx = await contractShield.deploymentTransaction().wait()
    console.log('CONTRACT_NAME deployed to:', contractAddress, 'tx hash:', deployTx.hash);
   saveMetadata(contractAddress, 'CONTRACT_NAME', "", chainId, blockNumber, deployTx.hash);
   console.log("Deployment successful! Exiting...");
        
   // Ensure all pending tasks are completed before exit
   setTimeout(() => process.exit(0), 1000);
} catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
}
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})