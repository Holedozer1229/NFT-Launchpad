/**
 * Deploy SKYNTZkEVM — cross-chain ZK-rollup monetization layer
 *
 * Requires (env vars):
 *   DEPLOYER_PRIVATE_KEY    — deployer wallet
 *   ETH_RPC_URL             — RPC endpoint
 *   SKYNT_TOKEN_ADDRESS     — deployed SKYNT ERC20
 *   ECDSA_VERIFIER_ADDRESS  — deployed ECDSAVerifier (from 02_deploy_verifier.js)
 *   SKYNT_FORWARDER_ADDRESS — deployed SKYNTForwarder (from 01_deploy_forwarder.js)
 *   TREASURY_WALLET_ADDRESS — treasury wallet that acts as sequencer
 *
 * Usage:
 *   npx hardhat run scripts/03_deploy_zkevm.js --network mainnet
 */

const { ethers } = require("hardhat");

const SKYNT_TOKEN_ADDRESS     = process.env.SKYNT_TOKEN_ADDRESS     || "0x22d3f06afB69e5FCFAa98C20009510dD11aF2517";
const ECDSA_VERIFIER_ADDRESS  = process.env.ECDSA_VERIFIER_ADDRESS  || "";
const SKYNT_FORWARDER_ADDRESS = process.env.SKYNT_FORWARDER_ADDRESS || "";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  const TREASURY   = process.env.TREASURY_WALLET_ADDRESS || deployer.address;
  const SEQUENCER  = process.env.ZKEVM_SEQUENCER_ADDRESS || deployer.address;
  const VERIFIER   = ECDSA_VERIFIER_ADDRESS  || (console.error("Set ECDSA_VERIFIER_ADDRESS"), process.exit(1));
  const FORWARDER  = SKYNT_FORWARDER_ADDRESS || (console.error("Set SKYNT_FORWARDER_ADDRESS"), process.exit(1));

  console.log("=== SKYNTZkEVM Deployment ===");
  console.log("Deployer   :", deployer.address);
  console.log("Treasury   :", TREASURY);
  console.log("Sequencer  :", SEQUENCER);
  console.log("SKYNT token:", SKYNT_TOKEN_ADDRESS);
  console.log("ZK verifier:", VERIFIER);
  console.log("Forwarder  :", FORWARDER);
  console.log("Network    :", network.name);

  // Verify SKYNT token
  const erc20Abi = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];
  const skynt = new ethers.Contract(SKYNT_TOKEN_ADDRESS, erc20Abi, deployer);
  try {
    const sym  = await skynt.symbol();
    const dec  = await skynt.decimals();
    console.log(`\nSKYNT token verified: ${sym} (${dec} decimals)`);
  } catch (e) {
    console.error("Could not verify SKYNT token:", e.message);
    process.exit(1);
  }

  console.log("\nDeploying SKYNTZkEVM...");
  const SKYNTZkEVM = await ethers.getContractFactory("SKYNTZkEVM");
  const zkEvm = await SKYNTZkEVM.deploy(
    SKYNT_TOKEN_ADDRESS,
    VERIFIER,
    SEQUENCER,
    TREASURY,
    FORWARDER
  );
  await zkEvm.waitForDeployment();

  const addr = await zkEvm.getAddress();
  console.log("\nSKYNTZkEVM deployed to        :", addr);
  console.log("Current state root            :", await zkEvm.currentStateRoot());
  console.log("Min deposit                   : 0.001 ETH");
  console.log("Max deposit cap               : 100,000 ETH");
  console.log("Bridge fee                    : 0.10%");
  console.log("Sequencer fee                 : 0.05%");
  console.log("Challenge period              : 7 days");

  console.log("\n=== Environment Variables ===");
  console.log(`SKYNT_ZKEVM_ADDRESS=${addr}`);
  console.log(`ZKEVM_SEQUENCER_ADDRESS=${SEQUENCER}`);

  const deployReceipt = await zkEvm.deploymentTransaction().wait(2);
  console.log("Block number:", deployReceipt.blockNumber);
  console.log("Gas used    :", deployReceipt.gasUsed.toString());

  await _tryVerify(addr, [SKYNT_TOKEN_ADDRESS, VERIFIER, SEQUENCER, TREASURY, FORWARDER]);
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
    console.warn("Verification failed:", e.message);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
