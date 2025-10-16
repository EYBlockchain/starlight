import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import { request } from 'http'; // For making HTTP requests

// Get directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration (can be changed directly here)
// Parse arguments properly whether run directly or via npm run
function parseArgs() {
  const args = process.argv.slice(2);
  let tokenId = 3;
  let rpcUrl = 'http://localhost:8545';
  let action = 'mint';
  let accountId = null; // For multi-tenant setup
  
  // Find the token ID (first numeric argument)
  for (const arg of args) {
    if (arg !== '--' && !isNaN(arg)) {
      tokenId = parseInt(arg);
      break;
    }
  }
  
  // Check for action type
  if (args.includes('deposit')) {
    action = 'deposit';
  } else if (args.includes('both')) {
    action = 'both';
  } else if (args.includes('commitments')) {
    action = 'commitments';
  }
  
  // Look for an URL argument
  const urlArg = args.find(arg => arg.startsWith('http'));
  if (urlArg) {
    rpcUrl = urlArg;
  }
  
  // Look for accountId argument (format: accountId=uuid)
  const accountIdArg = args.find(arg => arg.startsWith('accountId='));
  if (accountIdArg) {
    accountId = accountIdArg.split('=')[1];
  }
  
  console.log(`Parsed args - Token ID: ${tokenId}, RPC URL: ${rpcUrl}, Action: ${action}${accountId ? ', AccountId: ' + accountId : ''}`);
  return { tokenId, rpcUrl, action, accountId };
}

const { tokenId: TOKEN_ID, rpcUrl: RPC_URL, action: ACTION, accountId: ACCOUNT_ID } = parseArgs();

async function mintAndApprove() {
  try {
    // Read contract ABIs and addresses
    const erc721Path = path.join(__dirname, 'zapps/NFT_Escrow/build/contracts/ERC721.json');
    const shieldPath = path.join(__dirname, 'zapps/NFT_Escrow/build/contracts/NFT_EscrowShield.json');
    
    console.log(`Reading ERC721 contract from ${erc721Path}`);
    console.log(`Reading Shield contract from ${shieldPath}`);
    
    const erc721Json = JSON.parse(fs.readFileSync(erc721Path, 'utf8'));
    const shieldJson = JSON.parse(fs.readFileSync(shieldPath, 'utf8'));

    // Get contract addresses from network 31337 (local hardhat network)
    const ERC721_ADDRESS = erc721Json.networks['31337'].address;
    const SHIELD_ADDRESS = shieldJson.networks['31337'].address;

    // Connect to local network
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    // Get signer (using first account from local network)
    const accounts = await provider.listAccounts();
    const signer = provider.getSigner(accounts[0]);
    const signerAddress = accounts[0];
    
    console.log('Connected to network with signer:', signerAddress);
    console.log('ERC721 Contract Address:', ERC721_ADDRESS);
    console.log('Shield Contract Address:', SHIELD_ADDRESS);
    
    // Create contract instance
    const erc721Contract = new ethers.Contract(ERC721_ADDRESS, erc721Json.abi, signer);
    
    console.log('\n--- Minting NFT ---');
    console.log(`Minting token ID ${TOKEN_ID} to ${signerAddress}...`);
    
    // Mint NFT
    const mintTx = await erc721Contract.mint(signerAddress, TOKEN_ID);
    console.log('Mint transaction sent, waiting for confirmation...');
    const mintReceipt = await mintTx.wait();
    console.log('Mint transaction hash:', mintTx.hash);
    console.log('NFT minted successfully! Gas used:', mintReceipt.gasUsed.toString());
    
    // Verify ownership
    const owner = await erc721Contract.ownerOf(TOKEN_ID);
    console.log(`Token ${TOKEN_ID} owner:`, owner);
    
    console.log('\n--- Approving Shield Contract ---');
    console.log(`Approving shield contract ${SHIELD_ADDRESS} for token ${TOKEN_ID}...`);
    
    // Approve shield contract to transfer the NFT
    const approveTx = await erc721Contract.approve(SHIELD_ADDRESS, TOKEN_ID);
    console.log('Approve transaction sent, waiting for confirmation...');
    const approveReceipt = await approveTx.wait();
    console.log('Approve transaction hash:', approveTx.hash);
    console.log('Shield contract approved successfully! Gas used:', approveReceipt.gasUsed.toString());
    
    // Verify approval
    const approvedAddress = await erc721Contract.getApproved(TOKEN_ID);
    console.log(`Approved address for token ${TOKEN_ID}:`, approvedAddress);
    
    if (approvedAddress.toLowerCase() === SHIELD_ADDRESS.toLowerCase()) {
      console.log('\n✅ Mint and approve completed successfully!');
    } else {
      console.log('\n⚠️ Approval verification failed. Please check manually.');
    }
    
  } catch (error) {
    console.error('Error:', error.message || error);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    process.exit(1);
  }
}

async function depositToShield() {
  try {
    // Read contract ABIs and addresses
    const erc721Path = path.join(__dirname, 'zapps/NFT_Escrow/build/contracts/ERC721.json');
    const shieldPath = path.join(__dirname, 'zapps/NFT_Escrow/build/contracts/NFT_EscrowShield.json');
    
    console.log(`Reading contracts from build directory...`);
    
    const erc721Json = JSON.parse(fs.readFileSync(erc721Path, 'utf8'));
    const shieldJson = JSON.parse(fs.readFileSync(shieldPath, 'utf8'));

    // Get contract addresses from network 31337 (local hardhat network)
    const ERC721_ADDRESS = erc721Json.networks['31337'].address;
    const SHIELD_ADDRESS = shieldJson.networks['31337'].address;

    // Connect to local network
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    // Get signer (using first account from local network)
    const accounts = await provider.listAccounts();
    const signer = provider.getSigner(accounts[0]);
    const signerAddress = accounts[0];
    
    console.log('Connected to network with signer:', signerAddress);
    console.log('ERC721 Contract Address:', ERC721_ADDRESS);
    console.log('Shield Contract Address:', SHIELD_ADDRESS);
    
    // Create ERC721 contract instance to check ownership and approval
    const erc721Contract = new ethers.Contract(ERC721_ADDRESS, erc721Json.abi, signer);
    const owner = await erc721Contract.ownerOf(TOKEN_ID);
    const approvedAddress = await erc721Contract.getApproved(TOKEN_ID);
    
    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
      console.error(`Error: You don't own token ID ${TOKEN_ID}`);
      process.exit(1);
    }
    
    if (approvedAddress.toLowerCase() !== SHIELD_ADDRESS.toLowerCase()) {
      console.error(`Error: Shield contract is not approved to transfer token ID ${TOKEN_ID}`);
      process.exit(1);
    }
    
    console.log('\n--- Depositing NFT to Shield via Zapp API ---');
    console.log(`Preparing deposit for token ID ${TOKEN_ID}...`);
    
    // Generate a random secret for the deposit
    const secret = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    
    // Define the Zapp API endpoint for deposit
    const ZAPP_HOST = 'localhost';
    const ZAPP_PORT = 3000; // The Zapp is running on port 3000
    
    // Based on the router.post("/deposit") configuration in the Zapp
    const ZAPP_PATH = '/deposit';
    
    console.log(`Calling Zapp API at http://${ZAPP_HOST}:${ZAPP_PORT}${ZAPP_PATH}...`);
    console.log(`Depositing token ID ${TOKEN_ID} with secret: ${secret}`);
    
    // Create a deposit payload for the API - based on the service_deposit function
    // The API only requires tokenId and optionally tokenOwners_tokenId_newOwnerPublicKey
    const depositPayload = {
      tokenId: TOKEN_ID,
      tokenOwners_tokenId_newOwnerPublicKey: 0 // Optional parameter, using default value
    };
    
    // Create initial deposit info
    let depositInfo = {
      tokenId: TOKEN_ID,
      secret: secret,
      owner: signerAddress,
      timestamp: new Date().toISOString()
    };
    
    // Make the actual HTTP request to the deposit endpoint
    const depositResult = await new Promise((resolve, reject) => {
      // Convert payload to JSON string
      const postData = JSON.stringify(depositPayload);
      
      // Set up the request options
      // Set up the request options
      const options = {
        hostname: ZAPP_HOST,
        port: ZAPP_PORT,
        path: ZAPP_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      // Add x-saas-context header for multi-tenant setups if accountId is provided
      if (ACCOUNT_ID) {
        console.log(`Using multi-tenant mode with accountId: ${ACCOUNT_ID}`);
        options.headers['x-saas-context'] = JSON.stringify({ accountId: ACCOUNT_ID });
      }
      
      // Create the request
      const req = request(options, (res) => {
        let responseData = '';
        
        // A chunk of data has been received
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        // The whole response has been received
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsedData = JSON.parse(responseData);
              resolve({ success: true, data: parsedData });
            } catch (e) {
              resolve({ success: true, data: responseData });
            }
          } else {
            reject(new Error(`API request failed with status code ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      // Handle request errors
      req.on('error', (error) => {
        reject(new Error(`Error making API request: ${error.message}`));
      });
      
      // Write post data and end the request
      req.write(postData);
      req.end();
    });
    
    // Process the API response
    if (depositResult.success) {
      console.log('\nDeposit API call successful!');
      console.log('Response:', JSON.stringify(depositResult.data, null, 2));
      
      // Update deposit info with transaction details and commitments from the response
      if (depositResult.data.tx && depositResult.data.tx.transactionHash) {
        depositInfo = {
          ...depositInfo,
          txHash: depositResult.data.tx.transactionHash,
          blockNumber: depositResult.data.tx.blockNumber,
          contractAddress: depositResult.data.tx.address,
          commitments: depositResult.data.tx.returnValues?.leafValues || []
        };
      }
      
      // Also capture any direct commitment data returned by the API
      if (depositResult.data.commitments) {
        depositInfo.commitmentData = depositResult.data.commitments;
      } else if (depositResult.data.commitment) {
        depositInfo.commitmentData = depositResult.data.commitment;
      }
    } else {
      console.error('\nDeposit API call failed!');
      throw new Error('Failed to complete deposit via API');
    }
    
    // Include timestamp and account information in the filename for better organization
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const accountSuffix = ACCOUNT_ID ? `-${ACCOUNT_ID}` : '';
    const depositInfoPath = path.join(__dirname, `nft-deposit-info-${TOKEN_ID}${accountSuffix}.json`);
    fs.writeFileSync(depositInfoPath, JSON.stringify(depositInfo, null, 2));
    console.log(`\nDeposit information saved to: ${depositInfoPath}`);
    console.log('Keep this file secure - you will need it to withdraw your NFT later!');
    
    console.log('\n✅ Deposit completed successfully via API call.');
    
  } catch (error) {
    console.error('Error during deposit:', error.message || error);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    
    // Provide troubleshooting guidance for common API errors
    console.log('\n--- Troubleshooting Tips ---');
    console.log('1. Ensure the NFT Escrow Zapp API is running (on port 3000)');
    console.log('2. Check that the token is properly minted and approved');
    console.log('3. The correct API endpoint is /deposit based on the Zapp router configuration');
    console.log('4. The API expects only tokenId in the request body');
    console.log('5. For multi-tenant setups, make sure to include a valid accountId (accountId=uuid)');
    console.log('6. You can also try using the Zapp UI at http://localhost:3000');
    
    process.exit(1);
  }
}

// Run the appropriate script based on the action parameter
async function main() {
  if (ACTION === 'mint' || ACTION === 'both') {
    await mintAndApprove();
  }
  
  if (ACTION === 'deposit' || ACTION === 'both') {
    await depositToShield();
    // After successful deposit, fetch commitments
    await fetchUserCommitments();
  }

  if (ACTION === 'commitments') {
    console.log('Fetching commitments only...');
    await fetchUserCommitments();
  }
}

/**
 * Fetch user commitments from the Zapp API
 * This function will be called after a successful deposit
 * to get all commitments associated with the user
 */
async function fetchUserCommitments() {
  try {
    console.log('\n--- Fetching User Commitments ---');
    
    // Define the Zapp API endpoint for commitments
    const ZAPP_HOST = 'localhost';
    const ZAPP_PORT = 3000; 
    const ZAPP_PATH = '/getAllCommitments'; // Correct endpoint from api_routes.mjs
    
    console.log(`Fetching commitments from http://${ZAPP_HOST}:${ZAPP_PORT}${ZAPP_PATH}...`);
    
    // Make HTTP request to get user's commitments
    const commitmentsResult = await new Promise((resolve, reject) => {
      // Set up the request options
      const options = {
        hostname: ZAPP_HOST,
        port: ZAPP_PORT,
        path: ZAPP_PATH,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };
      
      // Add x-saas-context header for multi-tenant setups if accountId is provided
      if (ACCOUNT_ID) {
        console.log(`Using multi-tenant mode with accountId: ${ACCOUNT_ID} for fetching commitments`);
        options.headers['x-saas-context'] = JSON.stringify({ accountId: ACCOUNT_ID });
      }
      
      // Create the request
      const req = request(options, (res) => {
        let responseData = '';
        
        // A chunk of data has been received
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        // The whole response has been received
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsedData = JSON.parse(responseData);
              resolve({ success: true, data: parsedData });
            } catch (e) {
              resolve({ success: true, data: responseData });
            }
          } else {
            reject(new Error(`API request failed with status code ${res.statusCode}: ${responseData}`));
          }
        });
      });
      
      // Handle request errors
      req.on('error', (error) => {
        reject(new Error(`Error making API request: ${error.message}`));
      });
      
      // End the request (no body for GET request)
      req.end();
    });
    
    if (commitmentsResult.success) {
      console.log('\nFetch commitments successful!');
      
      // Save the commitments to a file
      const commitmentsData = commitmentsResult.data;
      const commitmentsPath = path.join(__dirname, `user-commitments${ACCOUNT_ID ? `-${ACCOUNT_ID}` : ''}.json`);
      fs.writeFileSync(commitmentsPath, JSON.stringify(commitmentsData, null, 2));
      
      console.log(`Commitments saved to: ${commitmentsPath}`);
      
      // Handle the expected response structure where commitments are in a 'commitments' property
      const commitmentsList = commitmentsData.commitments || commitmentsData;
      
      console.log(`Total commitments found: ${Array.isArray(commitmentsList) ? commitmentsList.length : 'unknown'}`);
      
      // Display some information about the commitments
      if (Array.isArray(commitmentsList) && commitmentsList.length > 0) {
        console.log('\nLatest commitments:');
        const latestCommitments = commitmentsList.slice(-3); // Show last 3 commitments
        latestCommitments.forEach((commitment, index) => {
          console.log(`[${index}] Commitment ${commitment._id || 'unknown'} for mapping key ${commitment.mappingKey || 'unknown'}`);
        });
      }
      
      return commitmentsData;
    } else {
      console.error('\nFailed to fetch commitments!');
      return null;
    }
    
  } catch (error) {
    console.error('Error fetching commitments:', error.message || error);
    console.log('\nFailed to fetch commitments, but deposit may have been successful.');
    return null;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
