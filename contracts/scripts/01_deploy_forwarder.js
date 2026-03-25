/**
 * Deploy SKYNTForwarder — EIP-2771 gasless relay contract
 *
 * Usage (Sepolia testnet):
 *   cd contracts
 *   DEPLOYER_PRIVATE_KEY=0x... SEPOLIA_RPC_URL=https://... npx hardhat run scripts/01_deploy_forwarder.js --network sepolia
 *
 * Usage (Mainnet):
 *   DEPLOYER_PRIVATE_KEY=0x... ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/KEY \
 *   npx hardhat run scripts/01_deploy_forwarder.js --network mainnet
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log("=== SKYNTForwarder Deployment ===");
  console.log("Deployer    :", deployer.address);
  console.log("Network     :", network.name, `(chainId: ${network.chainId})`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("ETH balance :", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.error("ERROR: Need at least 0.01 ETH for gas");
    process.exit(1);
  }

  const SKYNTForwarder = await ethers.getContractFactory("SKYNTForwarder");
  console.log("\nDeploying SKYNTForwarder...");
  const forwarder = await SKYNTForwarder.deploy(deployer.address);
  await forwarder.waitForDeployment();

  const addr = await forwarder.getAddress();
  console.log("\nSKYNTForwarder deployed to:", addr);
  console.log("Owner (treasury)          :", deployer.address);

  // Fund forwarder with a small ETH reserve for value-bearing relay calls
  if (balance > ethers.parseEther("0.02")) {
    const fundTx = await deployer.sendTransaction({
      to: addr,
      value: ethers.parseEther("0.005")
    });
    await fundTx.wait();
    console.log("Funded forwarder with 0.005 ETH for relay reserve");
  }

  console.log("\n=== Set this env var ===");
  console.log(`SKYNT_FORWARDER_ADDRESS=${addr}`);

  await _tryVerify(addr, [deployer.address]);
}

async function _tryVerify(addr, args) {
  if (!process.env.ETHERSCAN_API_KEY) return;
  console.log("\nVerifying on Etherscan (30s delay)...");
  await new Promise(r => setTimeout(r, 30000));
  try {
    const hre = require("hardhat");
    await hre.run("verify:verify", { address: addr, constructorArguments: args });
    console.log("Verified:", `https://etherscan.io/address/${addr}`);
  } catch (e) {
    console.warn("Verification failed (retry manually):", e.message);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
