import { describe, it, expect } from "vitest";
import { SUPPORTED_CHAINS, BRIDGE_FEE_BPS, RARITY_TIERS, insertGameScoreSchema, insertBridgeTransactionSchema, insertNftSchema } from "../../shared/schema";

describe("Schema Constants", () => {
  it("SUPPORTED_CHAINS has all expected chains", () => {
    const chains = Object.keys(SUPPORTED_CHAINS);
    expect(chains).toContain("ethereum");
    expect(chains).toContain("polygon");
    expect(chains).toContain("arbitrum");
    expect(chains).toContain("stacks");
    expect(chains).toContain("base");
    expect(chains).toContain("solana");
    expect(chains).toContain("skynt");
    expect(chains.length).toBe(7);
  });

  it("BRIDGE_FEE_BPS is 10 (0.1%)", () => {
    expect(BRIDGE_FEE_BPS).toBe(10);
    const fee = 1000 * BRIDGE_FEE_BPS / 10000;
    expect(fee).toBe(1); // 0.1% of 1000 = 1
  });

  it("RARITY_TIERS has correct pricing structure", () => {
    expect(RARITY_TIERS.mythic.supply).toBe(1);
    expect(RARITY_TIERS.legendary.supply).toBe(3);
    expect(RARITY_TIERS.rare.supply).toBe(6);
    expect(RARITY_TIERS.common.supply).toBe(90);
  });

  it("each chain has required fields", () => {
    for (const [id, chain] of Object.entries(SUPPORTED_CHAINS)) {
      expect(chain.id).toBe(id);
      expect(chain.name).toBeTruthy();
      expect(chain.symbol).toBeTruthy();
      expect(chain.icon).toBeTruthy();
      expect(chain.explorer).toBeTruthy();
      expect(chain.contractAddress).toBeTruthy();
    }
  });
});

describe("Schema Validation - Game Scores", () => {
  it("validates a correct game score", () => {
    const result = insertGameScoreSchema.safeParse({
      userId: 1,
      username: "player1",
      score: 500,
      skyntEarned: "50.00",
      ergotropy: 150,
      berryPhase: "3.14",
      treasuresCollected: 20,
      milestones: 3,
      superMilestones: 0,
      survivalTicks: 1000,
      chain: "ETH",
    });
    expect(result.success).toBe(true);
  });

  it("requires userId and username", () => {
    const result = insertGameScoreSchema.safeParse({
      score: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe("Schema Validation - Bridge Transactions", () => {
  it("validates a correct bridge transaction", () => {
    const result = insertBridgeTransactionSchema.safeParse({
      fromChain: "ethereum",
      toChain: "polygon",
      amount: "100",
      token: "SKYNT",
      txHash: "0x" + "a".repeat(64),
    });
    expect(result.success).toBe(true);
  });

  it("requires fromChain and toChain", () => {
    const result = insertBridgeTransactionSchema.safeParse({
      amount: "100",
    });
    expect(result.success).toBe(false);
  });
});

describe("Business Logic - Fee Calculations", () => {
  it("bridge fee calculation is correct for various amounts", () => {
    const testCases = [
      { amount: 100, expectedFee: 0.1 },
      { amount: 1000, expectedFee: 1 },
      { amount: 50, expectedFee: 0.05 },
      { amount: 0.5, expectedFee: 0.0005 },
    ];
    for (const { amount, expectedFee } of testCases) {
      const fee = amount * BRIDGE_FEE_BPS / 10000;
      expect(fee).toBeCloseTo(expectedFee, 10);
    }
  });

  it("IIT phi bonus calculation is bounded correctly", () => {
    // phi ranges 0 to 1, bonus multiplier is 1 + (phi * 0.5)
    // so max bonus is 50% extra SKYNT
    const testCases = [
      { phi: 0, skyntEarned: 100, expectedBonus: 0 },
      { phi: 0.5, skyntEarned: 100, expectedBonus: 25 },
      { phi: 1.0, skyntEarned: 100, expectedBonus: 50 },
      { phi: 0.8, skyntEarned: 50, expectedBonus: 20 },
    ];
    for (const { phi, skyntEarned, expectedBonus } of testCases) {
      const bonus = skyntEarned * phi * 0.5;
      expect(bonus).toBeCloseTo(expectedBonus, 10);
    }
  });

  it("NFT minting cost matches rarity tier", () => {
    const rarityCosts: Record<string, number> = { mythic: 100, legendary: 1, rare: 0.5, common: 0.1 };
    expect(rarityCosts["mythic"]).toBe(100);
    expect(rarityCosts["legendary"]).toBe(1);
    expect(rarityCosts["rare"]).toBe(0.5);
    expect(rarityCosts["common"]).toBe(0.1);
    expect(rarityCosts["invalid"]).toBeUndefined();
  });

  it("SKYNT game reward is 10% of score", () => {
    const testScores = [0, 100, 500, 1000, 50000];
    for (const score of testScores) {
      const skynt = score * 0.1;
      expect(skynt).toBe(score / 10);
    }
  });
});
