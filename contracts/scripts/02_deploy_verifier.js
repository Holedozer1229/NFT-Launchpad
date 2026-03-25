/**
 * Deploy ECDSAVerifier — production ECDSA proof gate for bridges + ZK-EVM
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... ETH_RPC_URL=... TREASURY_WALLET_ADDRESS=0x... \
 *   npx hardhat run scripts/02_deploy_verifier.js --network mainnet
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  const AUTHORIZED_SIGNER = process.env.TREASURY_WALLET_ADDRESS || deployer.address;

  console.log("=== ECDSAVerifier Deployment ===");
  console.log("Deployer          :", deployer.address);
  console.log("Authorized signer :", AUTHORIZED_SIGNER);
  console.log("Network           :", network.name);

  const ECDSAVerifier = await ethers.getContractFactory("ECDSAVerifier");
  const verifier = await ECDSAVerifier.deploy(AUTHORIZED_SIGNER);
  await verifier.waitForDeployment();

  const addr = await verifier.getAddress();
  console.log("\nECDSAVerifier deployed to:", addr);
  console.log("\n=== Set this env var ===");
  console.log(`ECDSA_VERIFIER_ADDRESS=${addr}`);

  await _tryVerify(addr, [AUTHORIZED_SIGNER]);
}

async function _tryVerify(addr, args) {
  if (!process.env.ETHERSCAN_API_KEY) return;
  await new Promise(r => setTimeout(r, 30000));
  try {
    const hre = require("hardhat");
    await hre.run("verify:verify", { address: addr, constructorArguments: args });
    console.log("Verified:", `https://etherscan.io/address/${addr}`);
  } catch (e) {
    console.warn("Verification failed:", e.message);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
