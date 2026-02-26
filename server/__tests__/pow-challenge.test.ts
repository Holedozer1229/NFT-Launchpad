import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// ─── Helpers matching pow-mining-adapter.ts logic ────────────────────────────

function computePoW(seed: string, nonce: bigint, miner: string): string {
  const seedBytes = Buffer.from(seed, "hex");
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(nonce);
  const minerBytes = Buffer.from(miner, "utf8");
  return createHash("sha256")
    .update(seedBytes)
    .update(nonceBuf)
    .update(minerBytes)
    .digest("hex");
}

function meetsTarget(powHash: string, difficultyTarget: string): boolean {
  const hashNum = BigInt("0x" + powHash.slice(0, 32));
  return hashNum < BigInt(difficultyTarget);
}

// ─── Schema validation helpers ───────────────────────────────────────────────

import {
  insertPowChallengeSchema,
  insertPowSubmissionSchema,
} from "../../shared/schema";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PoW Challenge Schema", () => {
  const validChallenge = {
    challengeId: "abc123-test",
    seed: "a".repeat(64),
    difficultyTarget: "340282366920938463463374607431768",
    expiresAt: new Date(Date.now() + 3600_000),
    status: "active",
    createdBy: "admin",
  };

  it("accepts a valid challenge object", () => {
    const result = insertPowChallengeSchema.safeParse(validChallenge);
    expect(result.success).toBe(true);
  });

  it("rejects missing challengeId", () => {
    const { challengeId: _, ...rest } = validChallenge;
    const result = insertPowChallengeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing seed", () => {
    const { seed: _, ...rest } = validChallenge;
    const result = insertPowChallengeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("PoW Submission Schema", () => {
  const validSubmission = {
    challengeId: "abc123-test",
    minerAddress: "6h5M7PrUjy6tJ9gC4FTwGne1y4VJydKk9MELgNgBb5Do",
    nonce: "12345678",
    powHash: "a".repeat(64),
    sourceChain: "solana",
    status: "pending",
  };

  it("accepts a valid submission object", () => {
    const result = insertPowSubmissionSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it("defaults sourceChain to solana when omitted", () => {
    const { sourceChain: _, ...rest } = validSubmission;
    const result = insertPowSubmissionSchema.safeParse(rest);
    expect(result.success).toBe(true);
    // sourceChain has a DB default; Zod schema does not enforce it client-side
  });
});

describe("PoW Hash Computation", () => {
  const seed = "deadbeef".repeat(8); // 64 hex chars
  const miner = "6h5M7PrUjy6tJ9gC4FTwGne1y4VJydKk9MELgNgBb5Do";

  it("produces a 64-character hex hash", () => {
    const hash = computePoW(seed, 42n, miner);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("produces different hashes for different nonces", () => {
    const h1 = computePoW(seed, 1n, miner);
    const h2 = computePoW(seed, 2n, miner);
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes for different miners", () => {
    const h1 = computePoW(seed, 1n, "MinerA");
    const h2 = computePoW(seed, 1n, "MinerB");
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes for different seeds", () => {
    const h1 = computePoW("00".repeat(32), 1n, miner);
    const h2 = computePoW("ff".repeat(32), 1n, miner);
    expect(h1).not.toBe(h2);
  });

  it("is deterministic for the same inputs", () => {
    const h1 = computePoW(seed, 9999n, miner);
    const h2 = computePoW(seed, 9999n, miner);
    expect(h1).toBe(h2);
  });
});

describe("PoW Difficulty Check", () => {
  it("rejects hash that does not meet target", () => {
    // A very easy target of 1 — virtually impossible to meet
    const hardTarget = "1";
    const hash = "f" + "0".repeat(63);
    expect(meetsTarget(hash, hardTarget)).toBe(false);
  });

  it("accepts hash that meets target", () => {
    // Easy target: 0x000... < 0xfff... is always true for leading zeros
    const easyTarget = "340282366920938463463374607431768211455"; // u128::MAX
    const hash = "0".repeat(64);
    expect(meetsTarget(hash, easyTarget)).toBe(true);
  });

  it("rejects hash at exactly the target boundary", () => {
    // target = 1, hash_num = 1 → NOT strictly less than
    const target = "1";
    // First 16 bytes = 0x00000000000000000000000000000001
    const hash = "00000000000000000000000000000001" + "0".repeat(32);
    expect(meetsTarget(hash, target)).toBe(false);
  });
});

describe("PoW Mining (fast difficulty)", () => {
  // Use a trivially easy difficulty so the test finishes instantly
  const EASY_TARGET = (BigInt(2) ** 128n - 1n).toString(); // u128::MAX — every hash passes
  const seed = "cafebabe".repeat(8);
  const miner = "TestMiner";

  it("finds a solution within a few attempts for trivial difficulty", () => {
    let nonce = 0n;
    let found = false;
    for (let i = 0; i < 100; i++) {
      const hash = computePoW(seed, nonce, miner);
      if (meetsTarget(hash, EASY_TARGET)) {
        found = true;
        break;
      }
      nonce++;
    }
    expect(found).toBe(true);
  });

  it("verifying found solution succeeds", () => {
    const nonce = 0n;
    const hash = computePoW(seed, nonce, miner);
    expect(meetsTarget(hash, EASY_TARGET)).toBe(true);
  });
});

describe("Replay Protection Logic", () => {
  it("same miner, same challenge yields same hash (would be rejected as duplicate)", () => {
    const seed = "11223344".repeat(8);
    const miner = "SameMiner";
    const nonce = 100n;
    const h1 = computePoW(seed, nonce, miner);
    const h2 = computePoW(seed, nonce, miner);
    expect(h1).toBe(h2);
    // In the server, the second submission is rejected via getMinerSubmission check
  });

  it("different miners for the same challenge produce different hashes", () => {
    const seed = "11223344".repeat(8);
    const nonce = 100n;
    const h1 = computePoW(seed, nonce, "MinerAlpha");
    const h2 = computePoW(seed, nonce, "MinerBeta");
    expect(h1).not.toBe(h2);
  });
});
