
const hre = require('hardhat')
const fs = require('fs');
const c = require('config');
CUSTOM_CONTRACT_IMPORT
CUSTOM_PROOF_IMPORT
const saveMetadata = require('./metadata').saveMetadata

const functionNames = [FUNCTION_NAMES];
const vkInput = [];
let vk = [];
functionNames.forEach((name) => {
    const vkJson = JSON.parse(
        fs.readFileSync(`/app/orchestration/common/db/${name}_vk.key`, "utf-8")
    );
    if (vkJson.scheme) {
        vk = Object.values(vkJson).slice(2).flat(Infinity);
    } else {
        vk = Object.values(vkJson).flat(Infinity);
    }
    vkInput.push(vk);
});


async function main () {
   try {
  
    const chainId = (await hre.ethers.provider.getNetwork()).chainId
    const Verifier = await hre.ethers.getContractFactory('Verifier');
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    let blockNumber = await hre.ethers.provider.getBlockNumber();
    let deployTx = await verifier.deploymentTransaction().wait()
    console.log('Verifier deployed to:', verifierAddress, 'tx hash:', deployTx.hash);

	
    CUSTOM_CONTRACTS
	// Deploy AssignShield with Verifier and vkInput
	const CONTRACT_NAME = await hre.ethers.getContractFactory('CONTRACT_NAME');
    const contractShield = await CONTRACT_NAME.deploy(CUSTOM_INPUTS verifierAddress, vkInput CUSTOM_PROOF);
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