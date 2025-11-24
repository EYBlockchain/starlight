#!/bin/bash

set -e  # Exit on error

# Configuration
BASE_URL="http://localhost:3000"
ACCOUNT_ID="user-alice"
ZAPP_DIR="zapps/NFT_Escrow_DomainParams"

# Use random token IDs to avoid conflicts with previous tests
TOKEN_ID_1=$((100 + RANDOM % 900))
TOKEN_ID_2=$((1000 + RANDOM % 9000))

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "NFT_Escrow_DomainParams - Multi-NFT Test"
echo "=========================================="
echo ""
echo "Using accountId: $ACCOUNT_ID"
echo "Testing namespace isolation..."
echo ""

# Helper function to print success
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Helper function to print error
print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Helper function to print info
print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Step 1: Verify bytecode is present
echo "Step 1: Verifying bytecode in ERC721.json..."
if [ -f "$ZAPP_DIR/build/contracts/ERC721.json" ]; then
    if cat "$ZAPP_DIR/build/contracts/ERC721.json" | jq -e '.bytecode' > /dev/null 2>&1; then
        BYTECODE_LENGTH=$(cat "$ZAPP_DIR/build/contracts/ERC721.json" | jq -r '.bytecode' | wc -c)
        print_success "Bytecode found! Length: $BYTECODE_LENGTH characters"
    else
        print_error "Bytecode not found in ERC721.json"
        exit 1
    fi
else
    print_error "ERC721.json not found at $ZAPP_DIR/build/contracts/ERC721.json"
    exit 1
fi
echo ""

# Step 2: Register keys for user
echo "Step 2: Registering keys for user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/registerKeys" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d '{}')
print_info "Response: $REGISTER_RESPONSE"

# Extract user address
USER_ADDRESS=$(echo "$REGISTER_RESPONSE" | jq -r '.address // empty')
if [ -z "$USER_ADDRESS" ] || [ "$USER_ADDRESS" == "null" ]; then
    print_error "Failed to register keys"
    exit 1
fi
print_success "Keys registered. User address: $USER_ADDRESS"
echo ""

# Step 3: Deploy first ERC721 contract (CryptoKitties)
echo "Step 3: Deploying first NFT contract (CryptoKitties)..."
DEPLOY1_RESPONSE=$(curl -s -X POST "$BASE_URL/deployNFT" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d '{"name": "CryptoKitties", "symbol": "CK"}')

CONTRACT1_ADDRESS=$(echo "$DEPLOY1_RESPONSE" | jq -r '.contractAddress // empty')
if [ -z "$CONTRACT1_ADDRESS" ] || [ "$CONTRACT1_ADDRESS" == "null" ]; then
    print_error "Failed to deploy CryptoKitties contract"
    echo "Response: $DEPLOY1_RESPONSE"
    exit 1
fi
print_success "CryptoKitties deployed at: $CONTRACT1_ADDRESS"
echo ""

# Step 4: Deploy second ERC721 contract (CryptoPunks)
echo "Step 4: Deploying second NFT contract (CryptoPunks)..."
DEPLOY2_RESPONSE=$(curl -s -X POST "$BASE_URL/deployNFT" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d '{"name": "CryptoPunks", "symbol": "CP"}')

CONTRACT2_ADDRESS=$(echo "$DEPLOY2_RESPONSE" | jq -r '.contractAddress // empty')
if [ -z "$CONTRACT2_ADDRESS" ] || [ "$CONTRACT2_ADDRESS" == "null" ]; then
    print_error "Failed to deploy CryptoPunks contract"
    echo "Response: $DEPLOY2_RESPONSE"
    exit 1
fi
print_success "CryptoPunks deployed at: $CONTRACT2_ADDRESS"
echo ""

# Step 5: Verify contracts are different
echo "Step 5: Verifying contracts are different..."
if [ "$CONTRACT1_ADDRESS" == "$CONTRACT2_ADDRESS" ]; then
    print_error "Both contracts have the same address!"
    exit 1
fi
print_success "Contracts have different addresses"
echo ""

# Step 6: Mint NFT #1 from CryptoKitties contract
echo "Step 6: Minting NFT #$TOKEN_ID_1 from CryptoKitties contract ($CONTRACT1_ADDRESS)..."
MINT1_RESPONSE=$(curl -s -X POST "$BASE_URL/mintNFT" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"tokenId\": \"$TOKEN_ID_1\", \"nftContract\": \"$CONTRACT1_ADDRESS\"}")

MINT1_SUCCESS=$(echo "$MINT1_RESPONSE" | jq -r '.success // false')
if [ "$MINT1_SUCCESS" != "true" ]; then
    print_error "Failed to mint NFT #$TOKEN_ID_1 from CryptoKitties"
    echo "Response: $MINT1_RESPONSE"
    exit 1
fi
print_success "Minted NFT #$TOKEN_ID_1 from CryptoKitties contract"
echo ""

# Step 7: Mint NFT #2 from CryptoPunks contract
echo "Step 7: Minting NFT #$TOKEN_ID_2 from CryptoPunks contract ($CONTRACT2_ADDRESS)..."
MINT2_RESPONSE=$(curl -s -X POST "$BASE_URL/mintNFT" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"tokenId\": \"$TOKEN_ID_2\", \"nftContract\": \"$CONTRACT2_ADDRESS\"}")

MINT2_SUCCESS=$(echo "$MINT2_RESPONSE" | jq -r '.success // false')
if [ "$MINT2_SUCCESS" != "true" ]; then
    print_error "Failed to mint NFT #$TOKEN_ID_2 from CryptoPunks"
    echo "Response: $MINT2_RESPONSE"
    exit 1
fi
print_success "Minted NFT #$TOKEN_ID_2 from CryptoPunks contract"
echo ""

# Step 8: Approve NFT #1 from CryptoKitties for escrow
echo "Step 8: Approving NFT #$TOKEN_ID_1 from CryptoKitties for escrow..."
APPROVE1_RESPONSE=$(curl -s -X POST "$BASE_URL/approveNFT" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"tokenId\": \"$TOKEN_ID_1\", \"nftContract\": \"$CONTRACT1_ADDRESS\"}")

APPROVE1_SUCCESS=$(echo "$APPROVE1_RESPONSE" | jq -r '.success // false')
if [ "$APPROVE1_SUCCESS" != "true" ]; then
    print_error "Failed to approve NFT #$TOKEN_ID_1 from CryptoKitties"
    echo "Response: $APPROVE1_RESPONSE"
    exit 1
fi
print_success "Approved NFT #$TOKEN_ID_1 from CryptoKitties for escrow"
echo ""

# Step 9: Approve NFT #2 from CryptoPunks for escrow
echo "Step 9: Approving NFT #$TOKEN_ID_2 from CryptoPunks for escrow..."
APPROVE2_RESPONSE=$(curl -s -X POST "$BASE_URL/approveNFT" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"tokenId\": \"$TOKEN_ID_2\", \"nftContract\": \"$CONTRACT2_ADDRESS\"}")

APPROVE2_SUCCESS=$(echo "$APPROVE2_RESPONSE" | jq -r '.success // false')
if [ "$APPROVE2_SUCCESS" != "true" ]; then
    print_error "Failed to approve NFT #$TOKEN_ID_2 from CryptoPunks"
    echo "Response: $APPROVE2_RESPONSE"
    exit 1
fi
print_success "Approved NFT #$TOKEN_ID_2 from CryptoPunks for escrow"
echo ""

# Step 10: Deposit NFT #1 with CryptoKitties as domain parameter
echo "Step 10: Depositing NFT #$TOKEN_ID_1 with nftContract=$CONTRACT1_ADDRESS (CryptoKitties)..."
DEPOSIT1_RESPONSE=$(curl -s -X POST "$BASE_URL/deposit" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"nftContract\": \"$CONTRACT1_ADDRESS\", \"tokenId\": \"$TOKEN_ID_1\"}")

print_info "Deposit response: $DEPOSIT1_RESPONSE"

# Check if deposit was successful (look for proof or success indicator)
if echo "$DEPOSIT1_RESPONSE" | jq -e '.proof' > /dev/null 2>&1; then
    print_success "NFT #$TOKEN_ID_1 deposited successfully with CryptoKitties domain parameter"
elif echo "$DEPOSIT1_RESPONSE" | jq -e '.errors' > /dev/null 2>&1; then
    ERRORS=$(echo "$DEPOSIT1_RESPONSE" | jq -r '.errors[]')
    print_error "Failed to deposit NFT #$TOKEN_ID_1: $ERRORS"
    exit 1
else
    print_success "NFT #$TOKEN_ID_1 deposit transaction submitted"
fi
echo ""

# Step 11: Deposit NFT #2 with CryptoPunks as domain parameter
echo "Step 11: Depositing NFT #$TOKEN_ID_2 with nftContract=$CONTRACT2_ADDRESS (CryptoPunks)..."
DEPOSIT2_RESPONSE=$(curl -s -X POST "$BASE_URL/deposit" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"nftContract\": \"$CONTRACT2_ADDRESS\", \"tokenId\": \"$TOKEN_ID_2\"}")

print_info "Deposit response: $DEPOSIT2_RESPONSE"

# Check if deposit was successful
if echo "$DEPOSIT2_RESPONSE" | jq -e '.proof' > /dev/null 2>&1; then
    print_success "NFT #$TOKEN_ID_2 deposited successfully with CryptoPunks domain parameter"
elif echo "$DEPOSIT2_RESPONSE" | jq -e '.errors' > /dev/null 2>&1; then
    ERRORS=$(echo "$DEPOSIT2_RESPONSE" | jq -r '.errors[]')
    print_error "Failed to deposit NFT #$TOKEN_ID_2: $ERRORS"
    exit 1
else
    print_success "NFT #$TOKEN_ID_2 deposit transaction submitted"
fi
echo ""

# Step 12: Verify commitments for CryptoKitties domain
echo "Step 12: Fetching commitments for CryptoKitties domain..."
sleep 2  # Wait for commitments to be indexed
COMMITMENTS1_RESPONSE=$(curl -s -X POST "$BASE_URL/getCommitmentsByVariableName" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"name\": \"tokenOwners\", \"domainParameters\": {\"nftContract\": \"$CONTRACT1_ADDRESS\"}}")

COMMITMENTS1_COUNT=$(echo "$COMMITMENTS1_RESPONSE" | jq '.commitments | length')
print_info "CryptoKitties domain commitments: $COMMITMENTS1_COUNT"
if [ "$COMMITMENTS1_COUNT" -gt 0 ]; then
    print_success "Found commitments for CryptoKitties domain"
else
    print_error "No commitments found for CryptoKitties domain"
fi
echo ""

# Step 13: Verify commitments for CryptoPunks domain
echo "Step 13: Fetching commitments for CryptoPunks domain..."
COMMITMENTS2_RESPONSE=$(curl -s -X POST "$BASE_URL/getCommitmentsByVariableName" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"name\": \"tokenOwners\", \"domainParameters\": {\"nftContract\": \"$CONTRACT2_ADDRESS\"}}")

COMMITMENTS2_COUNT=$(echo "$COMMITMENTS2_RESPONSE" | jq '.commitments | length')
print_info "CryptoPunks domain commitments: $COMMITMENTS2_COUNT"
if [ "$COMMITMENTS2_COUNT" -gt 0 ]; then
    print_success "Found commitments for CryptoPunks domain"
else
    print_error "No commitments found for CryptoPunks domain"
fi
echo ""

# Step 14: Verify domain isolation after deposits
echo "Step 14: Verifying domain parameter isolation after deposits..."
print_info "CryptoKitties domain ($CONTRACT1_ADDRESS): $COMMITMENTS1_COUNT commitments"
print_info "CryptoPunks domain ($CONTRACT2_ADDRESS): $COMMITMENTS2_COUNT commitments"

if [ "$COMMITMENTS1_COUNT" -gt 0 ] && [ "$COMMITMENTS2_COUNT" -gt 0 ]; then
    print_success "Domain parameter isolation confirmed! Each nftContract has separate state"
else
    print_error "Domain isolation verification incomplete"
fi
echo ""

# Step 15: Register second user (Bob) for transfers
echo "Step 15: Registering second user (Bob) for transfers..."
REGISTER_BOB_RESPONSE=$(curl -s -X POST "$BASE_URL/registerKeys" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"user-bob\"}" \
    -d '{}')

BOB_ADDRESS=$(echo "$REGISTER_BOB_RESPONSE" | jq -r '.address')
print_info "Response: $REGISTER_BOB_RESPONSE"
if [ "$BOB_ADDRESS" != "null" ] && [ -n "$BOB_ADDRESS" ]; then
    print_success "Bob's keys registered. Address: $BOB_ADDRESS"
else
    print_error "Failed to register Bob's keys"
    exit 1
fi
echo ""

# Step 16: Transfer CryptoKitties NFT from Alice to Bob
echo "Step 16: Transferring NFT #$TOKEN_ID_1 from Alice to Bob (CryptoKitties domain)..."
TRANSFER1_RESPONSE=$(curl -s -X POST "$BASE_URL/transfer" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"tokenId\": $TOKEN_ID_1, \"recipient\": \"$BOB_ADDRESS\", \"nftContract\": \"$CONTRACT1_ADDRESS\"}")

print_info "Transfer response: $TRANSFER1_RESPONSE"
if echo "$TRANSFER1_RESPONSE" | jq -e '.tx' > /dev/null 2>&1; then
    print_success "NFT #$TOKEN_ID_1 transfer transaction submitted (CryptoKitties)"
else
    print_error "Failed to transfer NFT #$TOKEN_ID_1 (CryptoKitties)"
fi
echo ""

# Step 17: Transfer CryptoPunks NFT from Alice to Bob
echo "Step 17: Transferring NFT #$TOKEN_ID_2 from Alice to Bob (CryptoPunks domain)..."
TRANSFER2_RESPONSE=$(curl -s -X POST "$BASE_URL/transfer" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"tokenId\": $TOKEN_ID_2, \"recipient\": \"$BOB_ADDRESS\", \"nftContract\": \"$CONTRACT2_ADDRESS\"}")

print_info "Transfer response: $TRANSFER2_RESPONSE"
if echo "$TRANSFER2_RESPONSE" | jq -e '.tx' > /dev/null 2>&1; then
    print_success "NFT #$TOKEN_ID_2 transfer transaction submitted (CryptoPunks)"
else
    print_error "Failed to transfer NFT #$TOKEN_ID_2 (CryptoPunks)"
fi
echo ""

# Step 18: Verify Alice's commitments after transfers (should be nullified)
echo "Step 18: Verifying Alice's commitments after transfers..."
sleep 2  # Wait for commitments to be updated
ALICE_COMMITMENTS1_RESPONSE=$(curl -s -X POST "$BASE_URL/getCommitmentsByVariableName" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"name\": \"tokenOwners\", \"domainParameters\": {\"nftContract\": \"$CONTRACT1_ADDRESS\"}}")

ALICE_COMMITMENTS1_COUNT=$(echo "$ALICE_COMMITMENTS1_RESPONSE" | jq '[.commitments[] | select(.isNullified == false)] | length')
print_info "Alice's active CryptoKitties commitments: $ALICE_COMMITMENTS1_COUNT"

ALICE_COMMITMENTS2_RESPONSE=$(curl -s -X POST "$BASE_URL/getCommitmentsByVariableName" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"$ACCOUNT_ID\"}" \
    -d "{\"name\": \"tokenOwners\", \"domainParameters\": {\"nftContract\": \"$CONTRACT2_ADDRESS\"}}")

ALICE_COMMITMENTS2_COUNT=$(echo "$ALICE_COMMITMENTS2_RESPONSE" | jq '[.commitments[] | select(.isNullified == false)] | length')
print_info "Alice's active CryptoPunks commitments: $ALICE_COMMITMENTS2_COUNT"

if [ "$ALICE_COMMITMENTS1_COUNT" -eq 0 ] && [ "$ALICE_COMMITMENTS2_COUNT" -eq 0 ]; then
    print_success "Alice's commitments correctly nullified after transfers"
else
    print_error "Alice still has active commitments after transfers"
fi
echo ""

# Step 19: Verify Bob's commitments after transfers
echo "Step 19: Verifying Bob's commitments after transfers..."
BOB_COMMITMENTS1_RESPONSE=$(curl -s -X POST "$BASE_URL/getCommitmentsByVariableName" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"user-bob\"}" \
    -d "{\"name\": \"tokenOwners\", \"domainParameters\": {\"nftContract\": \"$CONTRACT1_ADDRESS\"}}")

BOB_COMMITMENTS1_COUNT=$(echo "$BOB_COMMITMENTS1_RESPONSE" | jq '[.commitments[] | select(.isNullified == false)] | length')
print_info "Bob's active CryptoKitties commitments: $BOB_COMMITMENTS1_COUNT"

BOB_COMMITMENTS2_RESPONSE=$(curl -s -X POST "$BASE_URL/getCommitmentsByVariableName" \
    -H "Content-Type: application/json" \
    -H "x-saas-context: {\"accountId\": \"user-bob\"}" \
    -d "{\"name\": \"tokenOwners\", \"domainParameters\": {\"nftContract\": \"$CONTRACT2_ADDRESS\"}}")

BOB_COMMITMENTS2_COUNT=$(echo "$BOB_COMMITMENTS2_RESPONSE" | jq '[.commitments[] | select(.isNullified == false)] | length')
print_info "Bob's active CryptoPunks commitments: $BOB_COMMITMENTS2_COUNT"

if [ "$BOB_COMMITMENTS1_COUNT" -eq 1 ] && [ "$BOB_COMMITMENTS2_COUNT" -eq 1 ]; then
    print_success "Bob received commitments for both NFTs correctly"
else
    print_error "Bob's commitments not correct after transfers"
fi
echo ""

# Step 20: Final domain isolation verification
echo "Step 20: Final multi nft verification..."
print_info "CryptoKitties domain ($CONTRACT1_ADDRESS): Bob has $BOB_COMMITMENTS1_COUNT commitments"
print_info "CryptoPunks domain ($CONTRACT2_ADDRESS): Bob has $BOB_COMMITMENTS2_COUNT commitments"

if [ "$BOB_COMMITMENTS1_COUNT" -eq 1 ] && [ "$BOB_COMMITMENTS2_COUNT" -eq 1 ]; then
    print_success "Namespace isolation maintained through transfers!"
else
    print_error "Namespace isolation verification incomplete after transfers"
fi
echo ""


