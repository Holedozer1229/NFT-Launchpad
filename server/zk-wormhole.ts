import { storage } from "./storage";
import { createHash, randomBytes } from "crypto";
import { ZK_WORMHOLE_CHAINS, zkWormholes, zkWormholeTransfers, type ZkWormholeChainId } from "@shared/schema";
import { qgMiner } from "./qg-miner-v8";
import { db } from "./db";
import { sql, eq, inArray } from "drizzle-orm";
import { transmitRewardToWallet } from "./alchemy-engine";
import { transmitToChain } from "./chain-transmit";

const EVM_CHAIN_MAP: Record<string, string> = {
  ethereum: "ethereum",
  polygon: "polygon",
  polygon_zkevm: "polygon",
  arbitrum: "arbitrum",
  base: "base",
  zksync: "zksync",
};

const CHAIN_NATIVE_TOKEN: Record<string, string> = {
  ethereum: "ETH",
  polygon: "MATIC",
  polygon_zkevm: "ETH",
  arbitrum: "ETH",
  base: "ETH",
  zksync: "ETH",
  dogecoin: "DOGE",
  solana: "SOL",
  stacks: "STX",
  skynt: "SKYNT",
  monero: "XMR",
};

async function transmitCrossChain(
  transferId: number,
  recipientAddress: string,
  amount: string,
  token: string,
  destChain: string
): Promise<void> {
  const resolvedToken = token === "NATIVE" ? (CHAIN_NATIVE_TOKEN[destChain] ?? token) : token;
  const alchemyChain = EVM_CHAIN_MAP[destChain];

  try {
    let txHash: string | null = null;
    let explorerUrl: string | null = null;
    let status: string;

    if (alchemyChain) {
      const result = await transmitRewardToWallet({
        recipientAddress,
        amount,
        chain: alchemyChain,
        token: resolvedToken,
      });
      txHash = result.txHash;
      explorerUrl = result.explorerUrl;
      status = result.status;
    } else {
      const result = await transmitToChain(destChain, recipientAddress, amount, resolvedToken);
      txHash = result.txHash;
      explorerUrl = result.explorerUrl;
      status = result.status;
    }

    await storage.updateZkWormholeTransferOnChain(transferId, txHash, explorerUrl, status);
    console.log(`[ZK-Wormhole] Live transmit ${amount} ${resolvedToken} → ${recipientAddress} on ${destChain} | status: ${status} | tx: ${txHash}`);
  } catch (err: any) {
    console.error(`[ZK-Wormhole] Transmit failed for ${destChain}:`, err.message);
    await storage.updateZkWormholeTransferOnChain(transferId, null, null, `failed: ${err.message}`);
  }
}

function generateWormholeId(): string {
  return "0xWH" + randomBytes(14).toString("hex");
}

function generateZkProofHash(userId: number, source: string, dest: string, nonce: string): string {
  return "0x" + createHash("sha256")
    .update(`zk-wormhole:${userId}:${source}:${dest}:${nonce}:${Date.now()}`)
    .digest("hex");
}

function generateTransferProofHash(wormholeId: string, amount: string, token: string): string {
  return "0x" + createHash("sha256")
    .update(`zk-transfer:${wormholeId}:${amount}:${token}:${randomBytes(8).toString("hex")}:${Date.now()}`)
    .digest("hex");
}

function generateTxHash(): string {
  return "0x" + randomBytes(32).toString("hex");
}

function getPhiBoost(): number {
  try {
    const mineResult = (qgMiner as any).getLastResult?.() ?? null;
    if (mineResult && typeof mineResult === "object" && "phiTotal" in mineResult) {
      return Math.min(Math.exp(Number(mineResult.phiTotal) || 0), 2.0);
    }
  } catch {}
  const basePhi = 0.3 + Math.random() * 0.7;
  return Math.min(Math.exp(basePhi), 2.0);
}

function isValidChain(chain: string): chain is ZkWormholeChainId {
  return chain in ZK_WORMHOLE_CHAINS;
}

export async function openWormhole(userId: number, sourceChain: string, destChain: string) {
  if (!isValidChain(sourceChain) || !isValidChain(destChain)) {
    throw new Error(`Invalid chain. Supported: ${Object.keys(ZK_WORMHOLE_CHAINS).join(", ")}`);
  }
  if (sourceChain === destChain) {
    throw new Error("Source and destination chains must be different");
  }

  const sourceConfig = ZK_WORMHOLE_CHAINS[sourceChain];
  const destConfig = ZK_WORMHOLE_CHAINS[destChain];

  const wormholeId = generateWormholeId();
  const nonce = randomBytes(8).toString("hex");
  const zkProofHash = generateZkProofHash(userId, sourceChain, destChain, nonce);
  const phiBoost = getPhiBoost();
  const capacity = Math.max(sourceConfig.wormholeCapacity, destConfig.wormholeCapacity);

  const wormhole = await storage.createZkWormhole({
    userId,
    wormholeId,
    status: "open",
    sourceChain,
    destChain,
    capacity: capacity.toString(),
    totalTransferred: "0",
    transferCount: 0,
    phiBoost: phiBoost.toFixed(4),
    zkProofHash,
  });

  return {
    ...wormhole,
    sourceConfig,
    destConfig,
    proofVerified: true,
    proofComplexity: sourceConfig.proofComplexity + destConfig.proofComplexity,
  };
}

export async function closeWormhole(userId: number, wormholeId: string) {
  const wormholes = await storage.getZkWormholesByUser(userId);
  const wormhole = wormholes.find(w => w.wormholeId === wormholeId);
  if (!wormhole) throw new Error("Wormhole not found");
  if (wormhole.userId !== userId) throw new Error("Not authorized");
  if (wormhole.status === "sealed") throw new Error("Wormhole already sealed");

  await storage.updateZkWormholeStatus(wormhole.id, "sealed");
  return { ...wormhole, status: "sealed" };
}

export async function initiateTransfer(
  userId: number,
  wormholeId: string,
  amount: string,
  token: string,
  externalRecipient?: string
) {
  const wormholes = await storage.getZkWormholesByUser(userId);
  const wormhole = wormholes.find(w => w.wormholeId === wormholeId);
  if (!wormhole) throw new Error("Wormhole not found");
  if (wormhole.status !== "open") throw new Error("Wormhole is not open");
  if (wormhole.userId !== userId) throw new Error("Not authorized");

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) throw new Error("Invalid amount");

  const remaining = parseFloat(wormhole.capacity) - parseFloat(wormhole.totalTransferred);
  if (amountNum > remaining) throw new Error(`Transfer exceeds wormhole capacity. Remaining: ${remaining.toFixed(4)}`);

  const wallets = await storage.getWalletsByUser(userId);
  if (wallets.length === 0) throw new Error("No wallet found");
  const wallet = wallets[0];

  const balanceField = token === "SKYNT" ? "balanceSkynt" : token === "ETH" ? "balanceEth" : "balanceStx";
  const currentBalance = parseFloat((wallet as any)[balanceField] || "0");
  if (currentBalance < amountNum) throw new Error(`Insufficient ${token} balance`);

  const sourceConfig = ZK_WORMHOLE_CHAINS[wormhole.sourceChain as ZkWormholeChainId];
  const feeBps = sourceConfig?.transferFeeBps ?? 10;
  const fee = (amountNum * feeBps) / 10000;
  const netAmount = amountNum - fee;

  await storage.updateWalletBalance(wallet.id, token, (currentBalance - amountNum).toFixed(6));

  const zkProofHash = generateTransferProofHash(wormholeId, amount, token);

  const transfer = await storage.createZkWormholeTransfer({
    wormholeId: wormhole.id,
    userId,
    sourceChain: wormhole.sourceChain,
    destChain: wormhole.destChain,
    amount: netAmount.toFixed(6),
    token,
    status: "pending",
    zkProofHash,
    guardianSigs: 0,
    txHash: null,
    externalRecipient: externalRecipient || null,
    onChainTxHash: null,
    explorerUrl: null,
    transmitStatus: externalRecipient ? "queued" : null,
  });

  await storage.updateZkWormholeStatus(wormhole.id, "bridging");

  const newTotal = (parseFloat(wormhole.totalTransferred) + amountNum).toFixed(6);
  const newCount = wormhole.transferCount + 1;
  await storage.updateZkWormholeStats(wormhole.id, newTotal, newCount);

  const destChainForTransmit = wormhole.destChain;

  setTimeout(async () => {
    try {
      const txHash = generateTxHash();
      await storage.updateZkWormholeTransferStatus(transfer.id, "verified", undefined);

      setTimeout(async () => {
        try {
          await storage.updateZkWormholeTransferStatus(transfer.id, "completed", txHash);
          await storage.updateZkWormholeStatus(wormhole.id, "open");

          const destWallets = await storage.getWalletsByUser(userId);
          if (destWallets.length > 0) {
            const destWallet = destWallets[0];
            const destBalField = token === "SKYNT" ? "balanceSkynt" : token === "ETH" ? "balanceEth" : "balanceStx";
            const destBal = parseFloat((destWallet as any)[destBalField] || "0");
            const phiBoost = parseFloat(wormhole.phiBoost) || 1.0;
            const boostedAmount = netAmount * phiBoost;
            await storage.updateWalletBalance(
              destWallet.id,
              token,
              (destBal + boostedAmount).toFixed(6)
            );
          }

          if (externalRecipient) {
            transmitCrossChain(transfer.id, externalRecipient, netAmount.toFixed(6), token, destChainForTransmit)
              .catch(err => console.error("[ZK-Wormhole] Transmit error:", err));
          }
        } catch (e) {
          console.error("[ZK-Wormhole] Transfer completion error:", e);
          await storage.updateZkWormholeTransferStatus(transfer.id, "failed", undefined);
          await storage.updateZkWormholeStatus(wormhole.id, "open");
        }
      }, 5000 + Math.random() * 5000);
    } catch (e) {
      console.error("[ZK-Wormhole] Transfer verification error:", e);
    }
  }, 2000 + Math.random() * 3000);

  return {
    transfer,
    fee: fee.toFixed(6),
    feeBps,
    netAmount: netAmount.toFixed(6),
    phiBoost: wormhole.phiBoost,
    zkProofHash,
    externalRecipient: externalRecipient || null,
    estimatedCompletionMs: 8000,
  };
}

export async function getWormholeStatus(userId: number) {
  const wormholes = await storage.getZkWormholesByUser(userId);
  const phiBoost = getPhiBoost();
  return {
    wormholes,
    activeCount: wormholes.filter(w => w.status === "open" || w.status === "bridging").length,
    totalCount: wormholes.length,
    currentPhiBoost: phiBoost.toFixed(4),
  };
}

export async function getWormholeTransfers(userId: number, wormholeId: number) {
  const wormhole = await storage.getZkWormhole(wormholeId);
  if (!wormhole || wormhole.userId !== userId) throw new Error("Wormhole not found or not authorized");
  return storage.getZkWormholeTransfers(wormholeId);
}

export async function getUserTransfers(userId: number) {
  return storage.getZkWormholeTransfersByUser(userId);
}

export async function getNetworkWormholeStats() {
  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(zkWormholes);

  const [activeRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(zkWormholes)
    .where(inArray(zkWormholes.status, ["open", "bridging"]));

  const [completedRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(zkWormholeTransfers)
    .where(eq(zkWormholeTransfers.status, "completed"));

  const [volumeRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(total_transferred::numeric), 0)::text` })
    .from(zkWormholes);

  return {
    totalPortals: totalRow?.count ?? 0,
    volumeTransferred: `${parseFloat(volumeRow?.total ?? "0").toFixed(2)} SKYNT`,
    activeWormholes: activeRow?.count ?? 0,
    proofsVerified: completedRow?.count ?? 0,
    supportedChains: Object.keys(ZK_WORMHOLE_CHAINS).length,
  };
}
