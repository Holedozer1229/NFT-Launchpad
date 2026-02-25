#!/bin/bash
# Deploy All SKYNT Components
# This script deploys the Anchor program and Hardhat bridge

set -e

echo "========================================"
echo "SKYNT Deployment Script"
echo "========================================"

# Function to check if Anchor is installed
check_anchor() {
    if ! command -v anchor &> /dev/null; then
        echo "Error: Anchor CLI is not installed"
        echo "Please install from: https://www.anchor-lang.com/docs/installation"
        exit 1
    fi
    echo "✓ Anchor CLI found"
}

# Function to check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed"
        exit 1
    fi
    if ! command -v npm &> /dev/null; then
        echo "Error: npm is not installed"
        exit 1
    fi
    echo "✓ Node.js and npm found"
}

# Function to deploy Anchor program
deploy_anchor() {
    echo ""
    echo "========================================"
    echo "Deploying Anchor Program"
    echo "========================================"
    
    cd anchor-program
    
    echo "Building Anchor program..."
    anchor build
    
    echo "Deploying to Solana..."
    anchor deploy
    
    echo "Running migrations..."
    anchor migrate
    
    cd ..
    
    echo "✓ Anchor program deployed"
}

# Function to deploy Hardhat bridge
deploy_hardhat() {
    echo ""
    echo "========================================"
    echo "Deploying Hardhat Bridge"
    echo "========================================"
    
    cd contracts
    
    echo "Installing dependencies..."
    npm install
    
    echo "Compiling contracts..."
    npx hardhat compile
    
    echo "Deploying to network..."
    npx hardhat run scripts/deploy.js --network localhost
    
    cd ..
    
    echo "✓ Hardhat bridge deployed"
}

# Main execution
echo "Checking dependencies..."
check_anchor
check_node

echo ""
echo "Starting deployment..."
echo ""

# Deploy components
deploy_anchor
deploy_hardhat

echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Start miners: ./scripts/start_miners.sh"
echo "2. Test minting: cd contracts && npx hardhat run scripts/mint.js"
echo ""
