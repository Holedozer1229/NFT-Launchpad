/**
 * Treasury Vault — Single Source of Truth
 *
 * All modules that need the treasury Ethereum address or balance MUST import
 * from here instead of reading TREASURY_WALLET_ADDRESS directly.
 *
 * Key design decisions:
 *   - The treasury ETH address is DERIVED from TREASURY_PRIVATE_KEY so there is
 *     no secondary env var to misconfigure.  Setting TREASURY_WALLET_ADDRESS as
 *     an env override is still supported for read-only workflows that don't hold
 *     the key (e.g. monitoring boxes).
 *   - Balance fetches are cached with a 30 s TTL so multiple modules polling
 *     every tick don't flood the Alchemy free-tier quota.
 *   - CRITICAL log lines are rate-limited to once per 5 minutes so the console
 *     doesn't fill up with repeated identical warnings.
 */

import {
  createPublicClient,
  http,
  formatEther,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VaultStatus {
  address: string;
  ethBalance: number;
  ethBalanceFormatted: string;
  isHealthy: boolean;
  isCritical: boolean;
  configured: boolean;
  lastCheckedAt: Date | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BALANCE_CACHE_TTL_MS      = 30_000;   // 30 s
const MIN_GAS_RESERVE_ETH       = 0.005;
const CRITICAL_GAS_ETH          = 0.001;
const CRITICAL_LOG_INTERVAL_MS  = 5 * 60_000; // only log CRITICAL once per 5 min

// ─── Module-level cache ───────────────────────────────────────────────────────

let _derivedAddress: Address | null       = null;
let _cachedBalance: number                = 0;
let _balanceCacheAt: number               = 0;
let _lastCriticalLogAt: number            = 0;
let _lastCheckedAt: Date | null           = null;

// ─── Address derivation ───────────────────────────────────────────────────────

/**
 * Returns the treasury Ethereum address.
 *
 * Priority:
 *   1. Derived from TREASURY_PRIVATE_KEY   ← preferred; always correct
 *   2. TREASURY_WALLET_ADDRESS env var      ← fallback for read-only contexts
 *   3. Zero address                         ← unconfigured; most operations skip
 */
export function getTreasuryAddress(): Address {
  if (_derivedAddress) return _derivedAddress;

  const key = process.env.TREASURY_PRIVATE_KEY;
  if (key) {
    try {
      const normalized = (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
      const account = privateKeyToAccount(normalized);
      _derivedAddress = account.address;
      return _derivedAddress;
    } catch {
      // fall through to env override
    }
  }

  const envAddr = process.env.TREASURY_WALLET_ADDRESS;
  if (envAddr && /^0x[a-fA-F0-9]{40}$/.test(envAddr)) {
    _derivedAddress = envAddr as Address;
    return _derivedAddress;
  }

  return "0x0000000000000000000000000000000000000000";
}

// ─── RPC client factory ───────────────────────────────────────────────────────

function getRpcUrl(): string {
  const key = process.env.ALCHEMY_API_KEY;
  return key
    ? `https://eth-mainnet.g.alchemy.com/v2/${key}`
    : "https://ethereum.publicnode.com";
}

function getPublicClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(getRpcUrl(), { timeout: 10_000 }),
  });
}

// ─── Balance fetch with cache ─────────────────────────────────────────────────

/**
 * Returns the treasury ETH balance.  Results are cached for 30 s so multiple
 * callers in the same tick share one RPC call.
 */
export async function getTreasuryEthBalance(forceRefresh = false): Promise<number> {
  const now = Date.now();
  if (!forceRefresh && _cachedBalance > 0 && now - _balanceCacheAt < BALANCE_CACHE_TTL_MS) {
    return _cachedBalance;
  }

  const addr = getTreasuryAddress();
  if (addr === "0x0000000000000000000000000000000000000000") return 0;

  try {
    const client = getPublicClient();
    const wei = await client.getBalance({ address: addr });
    const eth = parseFloat(formatEther(wei));
    _cachedBalance   = eth;
    _balanceCacheAt  = now;
    _lastCheckedAt   = new Date();

    // Rate-limited critical warning
    if (eth < CRITICAL_GAS_ETH) {
      if (now - _lastCriticalLogAt > CRITICAL_LOG_INTERVAL_MS) {
        console.warn(
          `[TreasuryVault] CRITICAL: Only ${eth.toFixed(6)} ETH at ${addr}. ` +
          `Deposit ETH to keep the relay funded. (This warning repeats every 5 min.)`
        );
        _lastCriticalLogAt = now;
      }
    }

    return eth;
  } catch (err: any) {
    console.error("[TreasuryVault] Balance fetch failed:", err.message?.slice(0, 100));
    return _cachedBalance;  // stale cache is better than 0
  }
}

// ─── Vault status snapshot ────────────────────────────────────────────────────

export async function getTreasuryVaultStatus(): Promise<VaultStatus> {
  const address  = getTreasuryAddress();
  const configured = address !== "0x0000000000000000000000000000000000000000";
  const eth      = configured ? await getTreasuryEthBalance() : 0;

  return {
    address,
    ethBalance:          eth,
    ethBalanceFormatted: `${eth.toFixed(6)} ETH`,
    isHealthy:           eth >= MIN_GAS_RESERVE_ETH,
    isCritical:          eth < CRITICAL_GAS_ETH,
    configured,
    lastCheckedAt:       _lastCheckedAt,
  };
}

/**
 * Invalidate the balance cache (call after sending a transaction so the next
 * read picks up the updated balance).
 */
export function invalidateBalanceCache(): void {
  _balanceCacheAt = 0;
}
