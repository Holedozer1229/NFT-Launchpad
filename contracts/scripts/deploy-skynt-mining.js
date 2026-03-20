/**
 * Deployment script for SKYNTMining contract.
 *
 * Usage:
 *   cd contracts
 *   DEPLOYER_PRIVATE_KEY=0x... ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/... npx hardhat run scripts/deploy-skynt-mining.js --network mainnet
 *
 * Environment variables required:
 *   DEPLOYER_PRIVATE_KEY  - Private key of deployer wallet (must hold ETH for gas)
 *   ETH_RPC_URL           - Alchemy or Infura mainnet RPC URL
 *   ETHERSCAN_API_KEY     - For contract verification
 *
 * After deployment:
 *   1. Fund the mining contract with SKYNT tokens:
 *      Call skynt.approve(miningContractAddress, amount) then miningContract.fundContract(amount)
 *   2. Set SKYNT_MINING_CONTRACT_ADDRESS env var in Replit to the deployed address
 */

const { ethers } = require("hardhat");

const SKYNT_TOKEN_ADDRESS = "0xfbc620cc04cc73bf443981b1d9f99a03fd5de38d";

// Initial difficulty: 2^234 (~1 in 27 billion hashes on average)
// Adjust lower for faster initial mining, higher for slower
const INITIAL_DIFFICULTY = ethers.BigNumber.from(2).pow(234).toString();

// Initial funding: 1,000,000 SKYNT tokens for mining rewards
const FUNDING_AMOUNT = ethers.utils.parseUnits("1000000", 18);

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=== SKYNTMining Deployment ===");
  console.log("Deployer:", deployer.address);
  console.log("SKYNT Token:", SKYNT_TOKEN_ADDRESS);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

  const balance = await deployer.getBalance();
  console.log("Deployer ETH balance:", ethers.utils.formatEther(balance), "ETH");

  if (balance.lt(ethers.utils.parseEther("0.05"))) {
    console.error("ERROR: Insufficient ETH for deployment gas (need ~0.05 ETH)");
    process.exit(1);
  }

  // Verify SKYNT token exists
  const erc20Abi = ["function totalSupply() view returns (uint256)", "function symbol() view returns (string)", "function balanceOf(address) view returns (uint256)"];
  const skyntToken = new ethers.Contract(SKYNT_TOKEN_ADDRESS, erc20Abi, deployer);
  try {
    const symbol = await skyntToken.symbol();
    const totalSupply = await skyntToken.totalSupply();
    const deployerBalance = await skyntToken.balanceOf(deployer.address);
    console.log("\nSKYNT Token Verified:");
    console.log("  Symbol:", symbol);
    console.log("  Total Supply:", ethers.utils.formatUnits(totalSupply, 18));
    console.log("  Deployer SKYNT Balance:", ethers.utils.formatUnits(deployerBalance, 18));

    if (deployerBalance.lt(FUNDING_AMOUNT)) {
      console.warn(`WARN: Deployer has less than ${ethers.utils.formatUnits(FUNDING_AMOUNT, 18)} SKYNT — contract won't be auto-funded`);
    }
  } catch (err) {
    console.error("ERROR: Could not verify SKYNT token at", SKYNT_TOKEN_ADDRESS);
    console.error(err.message);
    process.exit(1);
  }

  console.log("\nDeploying SKYNTMining contract...");
  const SKYNTMining = await ethers.getContractFactory("SKYNTMining");
  const miningContract = await SKYNTMining.deploy(
    SKYNT_TOKEN_ADDRESS,
    INITIAL_DIFFICULTY
  );
  await miningContract.deployed();

  console.log("\n✅ SKYNTMining deployed to:", miningContract.address);
  console.log("   Tx hash:", miningContract.deployTransaction.hash);

  const receipt = await miningContract.deployTransaction.wait(2);
  console.log("   Block number:", receipt.blockNumber);
  console.log("   Gas used:", receipt.gasUsed.toString());

  // Fund the mining contract with SKYNT tokens
  const deployerSkynt = await skyntToken.balanceOf(deployer.address);
  if (deployerSkynt.gte(FUNDING_AMOUNT)) {
    console.log("\nFunding mining contract with", ethers.utils.formatUnits(FUNDING_AMOUNT, 18), "SKYNT...");

    const approveAbi = ["function approve(address spender, uint256 amount) returns (bool)"];
    const skyntFull = new ethers.Contract(SKYNT_TOKEN_ADDRESS, approveAbi, deployer);

    const approveTx = await skyntFull.approve(miningContract.address, FUNDING_AMOUNT);
    await approveTx.wait();
    console.log("   Approved SKYNT transfer, tx:", approveTx.hash);

    const fundTx = await miningContract.fundContract(FUNDING_AMOUNT);
    await fundTx.wait();
    console.log("   Funded mining contract, tx:", fundTx.hash);
    console.log("✅ Contract funded with", ethers.utils.formatUnits(FUNDING_AMOUNT, 18), "SKYNT");
  } else {
    console.log("\n⚠️  Skipping auto-fund (insufficient SKYNT in deployer wallet)");
    console.log("   Fund manually: call skynt.approve(miningAddr, amount) then miningContract.fundContract(amount)");
  }

  console.log("\n=== Deployment Summary ===");
  console.log("SKYNTMining address:", miningContract.address);
  console.log("SKYNT token address:", SKYNT_TOKEN_ADDRESS);
  console.log("Initial difficulty:", INITIAL_DIFFICULTY);
  console.log("Base reward: 50 SKYNT per block");
  console.log("Halving interval: 210,000 blocks");

  console.log("\n=== Replit Environment Variables to Set ===");
  console.log(`SKYNT_MINING_CONTRACT_ADDRESS=${miningContract.address}`);
  console.log(`SKYNT_TOKEN_ADDRESS=${SKYNT_TOKEN_ADDRESS}`);

  // Verify on Etherscan
  if (process.env.ETHERSCAN_API_KEY && process.env.ETHERSCAN_API_KEY !== "undefined") {
    console.log("\nVerifying on Etherscan (waiting 30s for propagation)...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    try {
      await hre.run("verify:verify", {
        address: miningContract.address,
        constructorArguments: [SKYNT_TOKEN_ADDRESS, INITIAL_DIFFICULTY],
      });
      console.log("✅ Verified on Etherscan:", `https://etherscan.io/address/${miningContract.address}`);
    } catch (err) {
      console.warn("Etherscan verification failed (can retry manually):", err.message);
    }
  }
}

main().catch(err => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
