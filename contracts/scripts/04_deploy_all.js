// SKYNT Protocol — Full Deploy Script
// Usage: npx hardhat run scripts/04_deploy_all.js --network sepolia
//
// Required env vars:
//   TREASURY_ADDRESS      — treasury / authorized-signer wallet (defaults to deployer)
//   SKYNT_TOKEN_ADDRESS   — deployed SKYNT ERC-20 token address
//   OPENSEA_PROXY         — OpenSea conduit proxy for SpaceFlightNFT (defaults to zero address)
//
// Deployment order (dependency-safe):
//   1. SKYNTForwarder        (no deps)
//   2. ECDSAVerifier         (no deps; treasury = authorizedSigner)
//   3. SKYNTZkEVM            (needs SKYNT, verifier, sequencer, treasury, forwarder)
//   4. RocketBabesNFT        (needs treasury, forwarder)
//   5. SpaceFlightNFT        (needs SKYNT token, treasury, openSeaProxy, forwarder)
//   6. SkynetBridge          (needs verifier, forwarder)
//   7. SphinxYieldAggregator (needs treasury, verifier, forwarder)
//   8. SKYNTGovernance       (needs SKYNT token, forwarder)

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(bal), "ETH\n");

  const TREASURY      = process.env.TREASURY_ADDRESS      || deployer.address;
  const SKYNT         = process.env.SKYNT_TOKEN_ADDRESS   || "0x22d3f06afB69e5FCFAa98C20009510dD11aF2517";
  const OPENSEA_PROXY = process.env.OPENSEA_PROXY         || hre.ethers.ZeroAddress;

  console.log("Treasury / authorizedSigner:", TREASURY);
  console.log("SKYNT token:", SKYNT);
  console.log("OpenSea proxy:", OPENSEA_PROXY);

  // ── 1. SKYNTForwarder ────────────────────────────────────────────────────
  console.log("\n[1/8] Deploying SKYNTForwarder…");
  const Fwd = await hre.ethers.getContractFactory("SKYNTForwarder");
  const fwd = await Fwd.deploy(TREASURY);
  await fwd.waitForDeployment();
  const fwdAddr = await fwd.getAddress();
  console.log("  SKYNTForwarder:", fwdAddr);

  // ── 2. ECDSAVerifier (treasury = authorized signer) ──────────────────────
  console.log("[2/8] Deploying ECDSAVerifier…");
  const Ver = await hre.ethers.getContractFactory("ECDSAVerifier");
  const ver = await Ver.deploy(TREASURY); // treasury is authorized signer for all EIP-712 proofs
  await ver.waitForDeployment();
  const verAddr = await ver.getAddress();
  console.log("  ECDSAVerifier:", verAddr);

  // ── 3. SKYNTZkEVM ────────────────────────────────────────────────────────
  // constructor(address _skyntToken, address _zkVerifier, address _sequencer,
  //             address _treasury, address _trustedForwarder)
  console.log("[3/8] Deploying SKYNTZkEVM…");
  const ZkEVM = await hre.ethers.getContractFactory("SKYNTZkEVM");
  const zkevm = await ZkEVM.deploy(SKYNT, verAddr, deployer.address, TREASURY, fwdAddr);
  await zkevm.waitForDeployment();
  const zkevmAddr = await zkevm.getAddress();
  console.log("  SKYNTZkEVM:", zkevmAddr);

  // ── 4. RocketBabesNFT ────────────────────────────────────────────────────
  // constructor(address _treasury, address _trustedForwarder)
  console.log("[4/8] Deploying RocketBabesNFT…");
  const RB = await hre.ethers.getContractFactory("RocketBabesNFT");
  const rb = await RB.deploy(TREASURY, fwdAddr);
  await rb.waitForDeployment();
  const rbAddr = await rb.getAddress();
  console.log("  RocketBabesNFT:", rbAddr);

  // ── 5. SpaceFlightNFT ────────────────────────────────────────────────────
  // constructor(address _skyntToken, address _treasury,
  //             address _openSeaProxy, address _trustedForwarder)
  console.log("[5/8] Deploying SpaceFlightNFT…");
  const SF = await hre.ethers.getContractFactory("SpaceFlightNFT");
  const sf = await SF.deploy(SKYNT, TREASURY, OPENSEA_PROXY, fwdAddr);
  await sf.waitForDeployment();
  const sfAddr = await sf.getAddress();
  console.log("  SpaceFlightNFT:", sfAddr);

  // ── 6. SkynetBridge ──────────────────────────────────────────────────────
  // constructor(address _verifier, address _trustedForwarder)
  console.log("[6/8] Deploying SkynetBridge…");
  const Br = await hre.ethers.getContractFactory("SkynetBridge");
  const br = await Br.deploy(verAddr, fwdAddr);
  await br.waitForDeployment();
  const brAddr = await br.getAddress();
  console.log("  SkynetBridge:", brAddr);

  // ── 7. SphinxYieldAggregator ─────────────────────────────────────────────
  // constructor(address _treasury, address _zkVerifier, address _trustedForwarder)
  console.log("[7/8] Deploying SphinxYieldAggregator…");
  const Ya = await hre.ethers.getContractFactory("SphinxYieldAggregator");
  const ya = await Ya.deploy(TREASURY, verAddr, fwdAddr);
  await ya.waitForDeployment();
  const yaAddr = await ya.getAddress();
  console.log("  SphinxYieldAggregator:", yaAddr);

  // ── 8. SKYNTGovernance ───────────────────────────────────────────────────
  // constructor(address _skynt, address _trustedForwarder)
  console.log("[8/8] Deploying SKYNTGovernance…");
  const Gov = await hre.ethers.getContractFactory("SKYNTGovernance");
  const gov = await Gov.deploy(SKYNT, fwdAddr);
  await gov.waitForDeployment();
  const govAddr = await gov.getAddress();
  console.log("  SKYNTGovernance:", govAddr);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n✅ All 8 contracts deployed successfully!");
  const summary = {
    SKYNTForwarder:        fwdAddr,
    ECDSAVerifier:         verAddr,
    SKYNTZkEVM:            zkevmAddr,
    RocketBabesNFT:        rbAddr,
    SpaceFlightNFT:        sfAddr,
    SkynetBridge:          brAddr,
    SphinxYieldAggregator: yaAddr,
    SKYNTGovernance:       govAddr,
  };
  console.log("\n" + JSON.stringify(summary, null, 2));

  // ── Optional Etherscan verification ──────────────────────────────────────
  if (process.env.ETHERSCAN_API_KEY && hre.network.name !== "hardhat") {
    console.log("\nVerifying on Etherscan…");
    const verifyArgs = [
      [fwdAddr,   [TREASURY]],
      [verAddr,   [TREASURY]],
      [zkevmAddr, [SKYNT, verAddr, deployer.address, TREASURY, fwdAddr]],
      [rbAddr,    [TREASURY, fwdAddr]],
      [sfAddr,    [SKYNT, TREASURY, OPENSEA_PROXY, fwdAddr]],
      [brAddr,    [verAddr, fwdAddr]],
      [yaAddr,    [TREASURY, verAddr, fwdAddr]],
      [govAddr,   [SKYNT, fwdAddr]],
    ];
    for (const [addr, args] of verifyArgs) {
      try {
        await hre.run("verify:verify", { address: addr, constructorArguments: args });
        console.log("  Verified:", addr);
      } catch (e) {
        console.warn("  Verify failed for", addr, "—", e.message);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
