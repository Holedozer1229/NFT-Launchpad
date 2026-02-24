import { storage } from "./storage";
import { randomBytes } from "crypto";

export async function seedDatabase() {
  try {
    const existingNfts = await storage.getNfts();
    if (existingNfts.length === 0) {
      const nftSeedData = [
        { title: "Oracle Genesis Fragment", image: "/assets/sphinx-eye.png", rarity: "Mythic", status: "minted", mintDate: "2025-01-15", tokenId: "0x7A3F...E1D9", owner: "0xDEAD...BEEF", price: "100 ETH", chain: "ethereum" },
        { title: "Mission Patch Alpha", image: "/assets/mission-patch.png", rarity: "Legendary", status: "staked", mintDate: "2025-02-03", tokenId: "0x9B2C...A4F7", owner: "0xCAFE...BABE", price: "1.0 ETH", chain: "polygon" },
        { title: "Quantum Tunnel Passage", image: "/assets/quantum-tunnel.png", rarity: "Rare", status: "listed", mintDate: "2025-02-18", tokenId: "0x4E8D...C3B2", owner: "0xFACE...D00D", price: "0.5 ETH", chain: "arbitrum" },
        { title: "Rocket Launch Sequence", image: "/assets/rocket-launch.png", rarity: "Rare", status: "minted", mintDate: "2025-03-01", tokenId: "0x1F6A...D8E5", owner: "0xBEEF...CAFE", price: "0.5 ETH", chain: "base" },
        { title: "Forge HUD Interface", image: "/assets/forge-hud.png", rarity: "Common", status: "minted", mintDate: "2025-03-12", tokenId: "0x3C9E...B7A1", owner: "0xDEAD...FACE", price: "0.1 ETH", chain: "solana" },
        { title: "Sphinx Data Stream", image: "/assets/sphinx-stream.png", rarity: "Rare", status: "staked", mintDate: "2025-03-20", tokenId: "0x6D4B...F2C8", owner: "0xBABE...DEAD", price: "0.5 ETH", chain: "ethereum" },
        { title: "NFT Preview Core", image: "/assets/nft-preview.png", rarity: "Common", status: "listed", mintDate: "2025-04-01", tokenId: "0x8A5F...E9D3", owner: "0xD00D...BEEF", price: "0.1 ETH", chain: "stacks" },
        { title: "Abstract Cosmos Shard", image: "/assets/hero-abstract.png", rarity: "Common", status: "minted", mintDate: "2025-04-10", tokenId: "0x2B7C...A1F6", owner: "0xCAFE...FACE", price: "0.1 ETH", chain: "polygon" },
      ];
      for (const nft of nftSeedData) {
        await storage.createNft(nft);
      }
      console.log("[seed] Seeded 8 NFTs");
    }

    const existingGuardians = await storage.getGuardians();
    if (existingGuardians.length === 0) {
      for (let i = 1; i <= 9; i++) {
        await storage.createGuardian({
          guardianIndex: i,
          status: i === 7 ? "offline" : "online",
          publicKey: "0x" + randomBytes(20).toString("hex"),
        });
      }
      console.log("[seed] Seeded 9 guardians");
    }

    const existingStrategies = await storage.getYieldStrategies();
    if (existingStrategies.length === 0) {
      const strategySeedData = [
        { strategyId: "sphinx-lp", name: "SphinxSkynet LP", contract: "0x7a3F...f2e1", apr: "42.8", riskScore: 25, tvl: "2450000", totalStaked: "1200", color: "cyan", active: true, description: "Automated liquidity provision across SphinxSkynet hypercube network" },
        { strategyId: "cross-chain", name: "Cross-Chain Routing", contract: "0x4b1C...a8c3", apr: "68.5", riskScore: 55, tvl: "1180000", totalStaked: "800", color: "green", active: true, description: "Multi-chain yield optimization via SphinxBridge guardian network" },
        { strategyId: "pox-delegation", name: "PoX STX Delegation", contract: "ST1PQ...PGZGM", apr: "95.2", riskScore: 40, tvl: "620000", totalStaked: "0", color: "orange", active: true, description: "Non-custodial STX delegation with BTC yield routing to treasury" },
        { strategyId: "single-stake", name: "SKYNT Single Stake", contract: "0x9d2B...b4f7", apr: "24.6", riskScore: 10, tvl: "5800000", totalStaked: "3500", color: "magenta", active: true, description: "Simple staking with zk-SNARK verified yield distribution" },
      ];
      for (const s of strategySeedData) {
        await storage.createYieldStrategy(s);
      }
      console.log("[seed] Seeded 4 yield strategies");
    }

    const existingBridgeTxs = await storage.getBridgeTransactions();
    if (existingBridgeTxs.length === 0) {
      const bridgeSeedData = [
        { fromChain: "Ethereum", toChain: "SphinxSkynet", amount: "500", token: "SKYNT", status: "Released", signatures: "5/5", mechanism: "Lock → Mint", txHash: "0x" + randomBytes(32).toString("hex") },
        { fromChain: "Polygon", toChain: "Ethereum", amount: "1200", token: "SKYNT", status: "Minted", signatures: "5/5", mechanism: "Lock → Mint", txHash: "0x" + randomBytes(32).toString("hex") },
        { fromChain: "SphinxSkynet", toChain: "Arbitrum", amount: "250", token: "SKYNT", status: "Locked", signatures: "3/5", mechanism: "Burn → Release", txHash: "0x" + randomBytes(32).toString("hex") },
        { fromChain: "Base", toChain: "Ethereum", amount: "800", token: "SKYNT", status: "Released", signatures: "5/5", mechanism: "Lock → Mint", txHash: "0x" + randomBytes(32).toString("hex") },
        { fromChain: "Ethereum", toChain: "SphinxSkynet", amount: "2000", token: "SKYNT", status: "Burned", signatures: "4/5", mechanism: "Burn → Release", txHash: "0x" + randomBytes(32).toString("hex") },
      ];
      for (const tx of bridgeSeedData) {
        await storage.createBridgeTransaction(tx);
      }
      console.log("[seed] Seeded 5 bridge transactions");
    }

    const existingMiners = await storage.getMiner("miner-alpha");
    if (!existingMiners) {
      const minerSeedData = [
        { walletAddress: "miner-alpha", hashRate: 542, shards: 89 },
        { walletAddress: "miner-beta", hashRate: 318, shards: 41 },
        { walletAddress: "miner-gamma", hashRate: 0, shards: 17 },
      ];
      for (const m of minerSeedData) {
        await storage.upsertMiner(m);
      }
      console.log("[seed] Seeded 3 miners");
    }
  } catch (error) {
    console.error("[seed] Error seeding database:", error);
  }
}
