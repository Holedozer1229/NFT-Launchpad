// SKYNT Protocol — Full Deploy Script
// Usage: npx hardhat run scripts/04_deploy_all.js --network sepolia

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(bal), "ETH");

  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;
  const SKYNT    = process.env.SKYNT_TOKEN_ADDRESS || "0x22d3f06afB69e5FCFAa98C20009510dD11aF2517";

  // 1. SKYNTForwarder
  console.log("\n[1/8] Deploying SKYNTForwarder…");
  const Fwd = await hre.ethers.getContractFactory("SKYNTForwarder");
  const fwd = await Fwd.deploy(TREASURY);
  await fwd.waitForDeployment();
  console.log("  SKYNTForwarder:", await fwd.getAddress());

  // 2. ECDSAVerifier
  console.log("[2/8] Deploying ECDSAVerifier…");
  const Ver = await hre.ethers.getContractFactory("ECDSAVerifier");
  const ver = await Ver.deploy(TREASURY); // treasury is authorized signer for all ECDSA proofs
  await ver.waitForDeployment();
  console.log("  ECDSAVerifier:", await ver.getAddress());

  // 3. SKYNTZkEVM
  console.log("[3/8] Deploying SKYNTZkEVM…");
  const ZkEVM = await hre.ethers.getContractFactory("SKYNTZkEVM");
  const zkevm = await ZkEVM.deploy(SKYNT, await ver.getAddress(), deployer.address, TREASURY, await fwd.getAddress());
  await zkevm.waitForDeployment();
  console.log("  SKYNTZkEVM:", await zkevm.getAddress());

  // 4. RocketBabesNFT
  console.log("[4/8] Deploying RocketBabesNFT…");
  const RB = await hre.ethers.getContractFactory("RocketBabesNFT");
  const rb = await RB.deploy(TREASURY, await fwd.getAddress());
  await rb.waitForDeployment();
  console.log("  RocketBabesNFT:", await rb.getAddress());

  // 5. SpaceFlightNFT
  console.log("[5/8] Deploying SpaceFlightNFT…");
  const SF = await hre.ethers.getContractFactory("SpaceFlightNFT");
  const sf = await SF.deploy(TREASURY, await fwd.getAddress());
  await sf.waitForDeployment();
  console.log("  SpaceFlightNFT:", await sf.getAddress());

  // 6. SkynetBridge
  console.log("[6/8] Deploying SkynetBridge…");
  const Br = await hre.ethers.getContractFactory("SkynetBridge");
  const br = await Br.deploy(SKYNT, await fwd.getAddress());
  await br.waitForDeployment();
  console.log("  SkynetBridge:", await br.getAddress());

  // 7. SphinxYieldAggregator
  console.log("[7/8] Deploying SphinxYieldAggregator…");
  const Ya = await hre.ethers.getContractFactory("SphinxYieldAggregator");
  const ya = await Ya.deploy(SKYNT, TREASURY, await fwd.getAddress());
  await ya.waitForDeployment();
  console.log("  SphinxYieldAggregator:", await ya.getAddress());

  // 8. SKYNTGovernance
  console.log("[8/8] Deploying SKYNTGovernance…");
  const Gov = await hre.ethers.getContractFactory("SKYNTGovernance");
  const gov = await Gov.deploy(SKYNT, await fwd.getAddress());
  await gov.waitForDeployment();
  console.log("  SKYNTGovernance:", await gov.getAddress());

  console.log("\n✅ All contracts deployed!");
  console.log("\nAddresses summary:");
  console.log(JSON.stringify({
    SKYNTForwarder:       await fwd.getAddress(),
    ECDSAVerifier:        await ver.getAddress(),
    SKYNTZkEVM:           await zkevm.getAddress(),
    RocketBabesNFT:       await rb.getAddress(),
    SpaceFlightNFT:       await sf.getAddress(),
    SkynetBridge:         await br.getAddress(),
    SphinxYieldAggregator: await ya.getAddress(),
    SKYNTGovernance:      await gov.getAddress(),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
