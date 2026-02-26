#!/usr/bin/env tsx
/**
 * Cross-Chain PoW Mining Adapter
 * ================================
 * Fetches the current PoW challenge from the SKYNT API, mines a valid solution
 * off-chain, and submits the transaction to the Solana blockchain.
 *
 * Cross-chain extension points are provided via the `ChainAdapter` interface so
 * additional source chains (e.g. EVM/Ethereum) can be plugged in later without
 * changing the core mining loop.
 *
 * Usage:
 *   tsx scripts/pow-mining-adapter.ts \
 *     --miner <SOLANA_PUBKEY_OR_ADDRESS> \
 *     [--api-url http://localhost:5000] \
 *     [--chain solana] \
 *     [--rpc https://api.devnet.solana.com]
 *
 * Environment variables (override CLI flags):
 *   MINER_ADDRESS   – miner public key / address
 *   API_URL         – base URL of the SKYNT backend API
 *   SOLANA_RPC      – Solana JSON-RPC endpoint
 *   SOURCE_CHAIN    – source chain identifier (default: "solana")
 */

import { createHash } from "crypto";

// ─── Types ─────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/pow/challenge */
interface PowChallenge {
  challengeId: string;
  seed: string;             // 64-char hex (32 bytes)
  difficultyTarget: string; // decimal u128 string
  expiresAt: string;        // ISO 8601
  status: string;
  solutionsCount: number;
}

/** Shape returned by POST /api/pow/submit */
interface SubmitResponse {
  submission: {
    id: number;
    challengeId: string;
    minerAddress: string;
    nonce: string;
    powHash: string;
    sourceChain: string;
    status: string;
  };
  powHash: string;
}

// ─── Chain Adapter interface ───────────────────────────────────────────────
//
// Implement this interface to add a new source chain.  The `SolanaAdapter`
// below is the default.  An `EvmAdapter` stub is provided as a starting point.

interface ChainAdapter {
  /** Human-readable name, e.g. "solana" or "ethereum". */
  readonly chainId: string;

  /**
   * Broadcast the PoW solution on the destination chain (Solana) and return
   * the resulting transaction signature / hash.
   *
   * @param challenge  The active PoW challenge.
   * @param nonce      The winning nonce (as BigInt).
   * @param powHash    The resulting SHA-256 hex hash.
   * @param miner      The miner's address on this source chain.
   */
  submitToSolana(
    challenge: PowChallenge,
    nonce: bigint,
    powHash: string,
    miner: string,
    solanaRpc: string,
  ): Promise<string | null>;
}

// ─── Solana Adapter ────────────────────────────────────────────────────────

/**
 * Default adapter: the miner operates natively on Solana.
 *
 * In a full production implementation this would use `@solana/web3.js` to:
 *   1. Build a `submit_challenge_solution` instruction (program ID from Anchor.toml).
 *   2. Sign with the miner's keypair.
 *   3. Broadcast and await confirmation.
 *
 * The stub below shows how this would look and returns a mock signature so
 * the rest of the adapter logic can be exercised without a live RPC.
 */
class SolanaAdapter implements ChainAdapter {
  readonly chainId = "solana";

  async submitToSolana(
    challenge: PowChallenge,
    nonce: bigint,
    powHash: string,
    miner: string,
    solanaRpc: string,
  ): Promise<string | null> {
    // ── Production implementation (requires @solana/web3.js) ──────────────
    // import { Connection, Transaction, TransactionInstruction,
    //          PublicKey, Keypair, SystemProgram, sendAndConfirmTransaction }
    //   from "@solana/web3.js";
    //
    // const connection = new Connection(solanaRpc, "confirmed");
    // const programId  = new PublicKey("<SKYNT_ANCHOR_PROGRAM_ID>");
    // const [solutionPda] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("solution"), challengePubkey.toBuffer(), minerKp.publicKey.toBuffer()],
    //   programId,
    // );
    // const ix = new TransactionInstruction({
    //   programId,
    //   keys: [
    //     { pubkey: challengePubkey,        isSigner: false, isWritable: true },
    //     { pubkey: solutionPda,            isSigner: false, isWritable: true },
    //     { pubkey: minerKp.publicKey,      isSigner: true,  isWritable: true },
    //     { pubkey: SystemProgram.programId,isSigner: false, isWritable: false },
    //   ],
    //   data: encodeSubmitSolution(nonce),   // Anchor instruction discriminator + nonce LE
    // });
    // const tx   = new Transaction().add(ix);
    // const sig  = await sendAndConfirmTransaction(connection, tx, [minerKp]);
    // return sig;
    // ─────────────────────────────────────────────────────────────────────

    console.log(`[SolanaAdapter] Would broadcast to ${solanaRpc}`);
    console.log(`  Program:   <SKYNT_ANCHOR_PROGRAM_ID>`);
    console.log(`  Challenge: ${challenge.challengeId}`);
    console.log(`  Miner:     ${miner}`);
    console.log(`  Nonce:     ${nonce}`);
    console.log(`  Hash:      ${powHash}`);
    // Return a mock signature for demonstration purposes
    return "MOCK_SIGNATURE_" + powHash.slice(0, 16);
  }
}

// ─── EVM Adapter stub (cross-chain extension point) ───────────────────────

/**
 * Placeholder EVM adapter.
 * Extend this class to support miners operating from an EVM-compatible chain
 * (e.g. Ethereum, Polygon, Arbitrum).
 *
 * A future implementation might:
 *   1. Call an EVM smart contract that emits a `PoWSubmitted` event.
 *   2. A relayer picks up the event and calls `submit_challenge_solution` on Solana.
 */
class EvmAdapter implements ChainAdapter {
  constructor(readonly chainId: string) {}

  async submitToSolana(
    challenge: PowChallenge,
    nonce: bigint,
    powHash: string,
    miner: string,
    _solanaRpc: string,
  ): Promise<string | null> {
    // TODO: implement EVM → Solana bridge call
    // 1. Connect to EVM chain via ethers/viem using PRIVATE_KEY env var.
    // 2. Call SphinxBridge.submitPoW(challengeId, nonce, powHash).
    // 3. Bridge guardian network relays the proof to Solana.
    console.warn(
      `[EvmAdapter:${this.chainId}] EVM submission is not yet implemented. ` +
      `Challenge: ${challenge.challengeId}, miner: ${miner}, nonce: ${nonce}`,
    );
    return null;
  }
}

// ─── Mining logic ──────────────────────────────────────────────────────────

/**
 * Compute SHA-256(seed_bytes || nonce_le_bytes || miner_bytes).
 * Matches the on-chain verification in `submit_challenge_solution`.
 */
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

/**
 * Mine a valid nonce for the given challenge.
 * Returns { nonce, powHash } when a solution is found.
 */
function mine(
  challenge: PowChallenge,
  miner: string,
  startNonce: bigint = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
): { nonce: bigint; powHash: string } {
  const target = BigInt(challenge.difficultyTarget);
  const expiresAt = new Date(challenge.expiresAt).getTime();

  let nonce = startNonce;
  let attempts = 0n;
  const LOG_INTERVAL = 50_000n;
  const startMs = Date.now();

  console.log(`[Miner] Starting PoW — challenge: ${challenge.challengeId}`);
  console.log(`[Miner] Difficulty target: ${challenge.difficultyTarget}`);
  console.log(`[Miner] Expires at:        ${challenge.expiresAt}`);

  while (true) {
    if (Date.now() > expiresAt) {
      throw new Error("Challenge expired before solution was found");
    }

    const powHash = computePoW(challenge.seed, nonce, miner);
    const hashNum = BigInt("0x" + powHash.slice(0, 32));

    if (hashNum < target) {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);
      const hashrate = Number(attempts) / parseFloat(elapsed);
      console.log(`[Miner] ✓ Solution found!`);
      console.log(`[Miner]   Nonce:    ${nonce}`);
      console.log(`[Miner]   Hash:     ${powHash}`);
      console.log(`[Miner]   Attempts: ${attempts}`);
      console.log(`[Miner]   Time:     ${elapsed}s`);
      console.log(`[Miner]   Hashrate: ${hashrate.toFixed(0)} H/s`);
      return { nonce, powHash };
    }

    attempts++;
    if (attempts % LOG_INTERVAL === 0n) {
      const elapsed = (Date.now() - startMs) / 1000;
      const hashrate = Number(attempts) / elapsed;
      process.stdout.write(
        `\r[Miner] Mining... ${attempts.toLocaleString()} attempts, ${hashrate.toFixed(0)} H/s  `,
      );
    }

    nonce = (nonce + 1n) % (2n ** 64n); // wrap at u64::MAX to match Rust wrapping_add
  }
}

// ─── API helpers ───────────────────────────────────────────────────────────

async function fetchChallenge(apiUrl: string): Promise<PowChallenge> {
  const url = `${apiUrl}/api/pow/challenge`;
  const res = await fetch(url);
  if (res.status === 404) throw new Error("No active challenge found. Ask an admin to create one.");
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<PowChallenge>;
}

async function submitSolution(
  apiUrl: string,
  challengeId: string,
  minerAddress: string,
  nonce: bigint,
  sourceChain: string,
): Promise<SubmitResponse> {
  const url = `${apiUrl}/api/pow/submit`;
  // Note: powHash is intentionally omitted — the server recomputes and verifies it.
  const body = JSON.stringify({
    challengeId,
    minerAddress,
    nonce: nonce.toString(),
    sourceChain,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<SubmitResponse>;
}

async function confirmSubmission(
  apiUrl: string,
  submissionId: number,
  solanaTxHash: string,
): Promise<void> {
  const url = `${apiUrl}/api/pow/submissions/${submissionId}/confirm`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ solanaTxHash }),
  });
  if (!res.ok) {
    console.warn(`[Adapter] Could not confirm submission on API: ${res.status}`);
  }
}

// ─── Chain adapter registry ────────────────────────────────────────────────

const ADAPTERS: Record<string, ChainAdapter> = {
  solana: new SolanaAdapter(),
  ethereum: new EvmAdapter("ethereum"),
  polygon: new EvmAdapter("polygon"),
  arbitrum: new EvmAdapter("arbitrum"),
  base: new EvmAdapter("base"),
};

function getAdapter(chainId: string): ChainAdapter {
  const adapter = ADAPTERS[chainId];
  if (!adapter) {
    console.warn(`[Adapter] Unknown chain "${chainId}", falling back to Solana adapter.`);
    return ADAPTERS.solana;
  }
  return adapter;
}

// ─── CLI entry point ───────────────────────────────────────────────────────

async function main() {
  // Parse CLI arguments (simple key=value / --flag value style)
  const args = process.argv.slice(2);
  const get = (flag: string, env: string, def: string) => {
    const idx = args.indexOf(flag);
    return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : (process.env[env] ?? def);
  };

  const minerAddress = get("--miner", "MINER_ADDRESS", "");
  const apiUrl       = get("--api-url", "API_URL", "http://localhost:5000");
  const solanaRpc    = get("--rpc", "SOLANA_RPC", "https://api.devnet.solana.com");
  const sourceChain  = get("--chain", "SOURCE_CHAIN", "solana");

  if (!minerAddress) {
    console.error("Error: --miner <address> is required (or set MINER_ADDRESS env var)");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("SKYNT Cross-Chain PoW Mining Adapter");
  console.log("=".repeat(60));
  console.log(`Miner:       ${minerAddress}`);
  console.log(`API:         ${apiUrl}`);
  console.log(`Source chain:${sourceChain}`);
  console.log(`Solana RPC:  ${solanaRpc}`);
  console.log();

  // 1. Fetch challenge
  console.log("[Adapter] Fetching active challenge...");
  const challenge = await fetchChallenge(apiUrl);
  console.log(`[Adapter] Challenge received: ${challenge.challengeId}`);

  // 2. Mine off-chain
  const { nonce, powHash } = mine(challenge, minerAddress);

  // 3. Submit solution to API (off-chain record); server recomputes and verifies the hash
  console.log("\n[Adapter] Submitting solution to API...");
  const submitResp = await submitSolution(
    apiUrl,
    challenge.challengeId,
    minerAddress,
    nonce,
    sourceChain,
  );
  console.log(`[Adapter] Submission recorded (id=${submitResp.submission.id})`);

  // 4. Broadcast to Solana (or source chain bridge)
  const adapter = getAdapter(sourceChain);
  console.log(`[Adapter] Broadcasting via ${adapter.chainId} adapter...`);
  const solanaTxHash = await adapter.submitToSolana(
    challenge,
    nonce,
    powHash,
    minerAddress,
    solanaRpc,
  );

  if (solanaTxHash) {
    console.log(`[Adapter] On-chain TX: ${solanaTxHash}`);
    await confirmSubmission(apiUrl, submitResp.submission.id, solanaTxHash);
    console.log("[Adapter] Submission confirmed ✓");
  } else {
    console.log("[Adapter] No on-chain TX returned (adapter stub or unsupported chain).");
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err.message ?? err);
  process.exit(1);
});
