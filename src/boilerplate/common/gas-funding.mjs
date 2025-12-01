import config from 'config';
import logger from './logger.mjs';
import Web3 from './web3.mjs';

export async function fundTenantAddress(tenantAddress, amountInEther) {
  const web3 = Web3.connection();
  
  // Validate inputs
  if (!web3.utils.isAddress(tenantAddress)) {
    throw new Error(`Invalid Ethereum address: ${tenantAddress}`);
  }
  
  if (!amountInEther || parseFloat(amountInEther) <= 0) {
    throw new Error(`Invalid funding amount: ${amountInEther}`);
  }
  
  const deployerAccount = config.web3.options.defaultAccount;
  const deployerKey = config.web3.key;
  
  if (!deployerAccount || !deployerKey) {
    throw new Error('Deployer account not configured. Set DEFAULT_ACCOUNT and KEY environment variables.');
  }
  
  const deployerBalance = await web3.eth.getBalance(deployerAccount);
  const deployerBalanceEth = web3.utils.fromWei(deployerBalance, 'ether');
  const requiredAmount = parseFloat(amountInEther);
  
  if (parseFloat(deployerBalanceEth) < requiredAmount) {
    throw new Error(
      `Insufficient deployer balance. Required: ${requiredAmount} ETH, Available: ${deployerBalanceEth} ETH`
    );
  }
  
  logger.info(`Funding tenant address ${tenantAddress} with ${amountInEther} ETH...`);
  logger.debug(`Deployer account: ${deployerAccount}, Balance: ${deployerBalanceEth} ETH`);
  
  try {
    const amountInWei = web3.utils.toWei(amountInEther, 'ether');
    
    // Get current gas price
    const gasPrice = await web3.eth.getGasPrice();
    
    // Estimate gas for the transaction
    const gasEstimate = await web3.eth.estimateGas({
      from: deployerAccount,
      to: tenantAddress,
      value: amountInWei,
    });
    
    // Build transaction parameters
    const txParams = {
      from: deployerAccount,
      to: tenantAddress,
      value: amountInWei,
      gas: gasEstimate,
      gasPrice: gasPrice,
      chainId: await web3.eth.net.getId(),
    };
    
    // Sign transaction with deployer's private key
    const signedTx = await web3.eth.accounts.signTransaction(txParams, deployerKey);
    
    // Send signed transaction
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    logger.info(
      `Successfully funded ${tenantAddress} with ${amountInEther} ETH. Tx hash: ${receipt.transactionHash}`
    );
    
    return receipt;
  } catch (error) {
    logger.error(`Failed to fund tenant address ${tenantAddress}:`, error.message);
    throw new Error(`Gas funding failed: ${error.message}`);
  }
}

export async function hasSufficientGas(tenantAddress, minimumBalanceInEther) {
  const web3 = Web3.connection();
  
  // Validate inputs
  if (!web3.utils.isAddress(tenantAddress)) {
    throw new Error(`Invalid Ethereum address: ${tenantAddress}`);
  }
  
  if (!minimumBalanceInEther || parseFloat(minimumBalanceInEther) < 0) {
    throw new Error(`Invalid minimum balance: ${minimumBalanceInEther}`);
  }
  
  try {
    // Get current balance
    const balanceWei = await web3.eth.getBalance(tenantAddress);
    const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
    const minimumBalance = parseFloat(minimumBalanceInEther);
    
    const hasSufficient = parseFloat(balanceEth) >= minimumBalance;
    
    logger.debug(
      `Address ${tenantAddress} balance: ${balanceEth} ETH (minimum: ${minimumBalance} ETH) - ${
        hasSufficient ? 'Sufficient' : 'Insufficient'
      }`
    );
    
    return hasSufficient;
  } catch (error) {
    logger.error(`Failed to check balance for ${tenantAddress}:`, error.message);
    throw new Error(`Balance check failed: ${error.message}`);
  }
}

export async function autoFundIfNeeded(
  tenantAddress,
  minimumBalanceInEther = '0.01',
  fundAmountInEther = '0.1'
) {
  logger.debug(`Checking if tenant address ${tenantAddress} needs gas funding...`);
  
  try {
    // Check if address already has sufficient balance
    const hasSufficient = await hasSufficientGas(tenantAddress, minimumBalanceInEther);
    
    if (hasSufficient) {
      logger.debug(`Tenant address ${tenantAddress} already has sufficient gas. No funding needed.`);
      return null;
    }
    
    logger.info(
      `Tenant address ${tenantAddress} has insufficient gas (< ${minimumBalanceInEther} ETH). Auto-funding with ${fundAmountInEther} ETH...`
    );
    
    const receipt = await fundTenantAddress(tenantAddress, fundAmountInEther);
    
    logger.info(`Auto-funding complete for ${tenantAddress}. Ready to send transactions!`);
    
    return receipt;
  } catch (error) {
    logger.error(`Auto-funding failed for ${tenantAddress}:`, error.message);
    throw new Error(`Auto-funding failed: ${error.message}`);
  }
}

export async function getTenantBalance(tenantAddress) {
  const web3 = Web3.connection();
  
  if (!web3.utils.isAddress(tenantAddress)) {
    throw new Error(`Invalid Ethereum address: ${tenantAddress}`);
  }
  
  const balanceWei = await web3.eth.getBalance(tenantAddress);
  const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
  
  return balanceEth;
}

export default {
  fundTenantAddress,
  hasSufficientGas,
  autoFundIfNeeded,
  getTenantBalance,
};

