import { Alchemy, Network, AssetTransfersCategory, SortingOrder } from "alchemy-sdk";
import { createPublicClient, http, formatEther, formatGwei, type PublicClient } from "viem";
import { mainnet, polygon, base, zkSync } from "viem/chains";

const CHAIN_CONFIGS: Record<string, { network: Network; chain: any; rpcPath: string }> = {
  ethereum: { network: Network.ETH_MAINNET, chain: mainnet, rpcPath: "eth-mainnet" },
  polygon: { network: Network.MATIC_MAINNET, chain: polygon, rpcPath: "polygon-mainnet" },
  base: { network: Network.BASE_MAINNET, chain: base, rpcPath: "base-mainnet" },
  zksync: { network: Network.ZKSYNC_MAINNET, chain: zkSync, rpcPath: "zksync-mainnet" },
};

let _clients: Map<string, PublicClient> = new Map();
let _alchemyInstances: Map<string, Alchemy> = new Map();

function getApiKey(): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY not configured");
  return key;
}

function getPublicClient(chainName: string = "ethereum"): PublicClient {
  if (_clients.has(chainName)) return _clients.get(chainName)!;
  const config = CHAIN_CONFIGS[chainName];
  if (!config) throw new Error(`Unsupported chain: ${chainName}`);
  const apiKey = getApiKey();
  const client = createPublicClient({
    chain: config.chain,
    transport: http(`https://${config.rpcPath}.g.alchemy.com/v2/${apiKey}`),
  });
  _clients.set(chainName, client as PublicClient);
  return client as PublicClient;
}

function getAlchemy(chainName: string = "ethereum"): Alchemy {
  if (_alchemyInstances.has(chainName)) return _alchemyInstances.get(chainName)!;
  const config = CHAIN_CONFIGS[chainName];
  if (!config) throw new Error(`Unsupported chain: ${chainName}`);
  const alchemy = new Alchemy({ apiKey: getApiKey(), network: config.network });
  _alchemyInstances.set(chainName, alchemy);
  return alchemy;
}

interface LiveBlockData {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas: string | null;
  transactionCount: number;
  miner: string;
  difficulty: string;
  size: number;
}

interface LiveGasData {
  baseFee: string;
  maxPriorityFee: string;
  gasPrice: string;
  lastBlock: number;
  pendingCount: number;
}

interface LiveTxData {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  blockNumber: number | null;
  status: "confirmed" | "pending" | "failed";
  timestamp: number;
  chain: string;
  asset: string;
  category: string;
}

interface LiveBalanceData {
  eth: string;
  tokens: Array<{ symbol: string; balance: string; contractAddress: string; decimals: number }>;
  nfts: Array<{ title: string; tokenId: string; contractAddress: string; imageUrl: string | null }>;
}

const cache: Map<string, { data: any; expires: number }> = new Map();
function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return Promise.resolve(entry.data);
  return fetcher().then(data => {
    cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}

export async function getLatestBlock(chainName: string = "ethereum"): Promise<LiveBlockData> {
  return cached(`block:latest:${chainName}`, 12_000, async () => {
    const client = getPublicClient(chainName);
    const block = await client.getBlock({ blockTag: "latest" });
    return {
      number: Number(block.number),
      hash: block.hash!,
      parentHash: block.parentHash,
      timestamp: Number(block.timestamp),
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString(),
      baseFeePerGas: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : null,
      transactionCount: block.transactions.length,
      miner: (block as any).miner || "0x0000000000000000000000000000000000000000",
      difficulty: ((block as any).difficulty || 0n).toString(),
      size: Number((block as any).size || 0),
    };
  });
}

export async function getRecentBlocks(chainName: string = "ethereum", count: number = 5): Promise<LiveBlockData[]> {
  return cached(`blocks:recent:${chainName}:${count}`, 12_000, async () => {
    const client = getPublicClient(chainName);
    const latest = await client.getBlockNumber();
    const blocks: LiveBlockData[] = [];
    const fetchPromises = [];
    for (let i = 0; i < count; i++) {
      const num = latest - BigInt(i);
      if (num < 0n) break;
      fetchPromises.push(
        client.getBlock({ blockNumber: num }).then(block => ({
          number: Number(block.number),
          hash: block.hash!,
          parentHash: block.parentHash,
          timestamp: Number(block.timestamp),
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          baseFeePerGas: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : null,
          transactionCount: block.transactions.length,
          miner: (block as any).miner || "0x0000000000000000000000000000000000000000",
          difficulty: ((block as any).difficulty || 0n).toString(),
          size: Number((block as any).size || 0),
        }))
      );
    }
    return Promise.all(fetchPromises);
  });
}

export async function getGasData(chainName: string = "ethereum"): Promise<LiveGasData> {
  return cached(`gas:${chainName}`, 10_000, async () => {
    const client = getPublicClient(chainName);
    const [block, gasPrice, pendingCount] = await Promise.all([
      client.getBlock({ blockTag: "latest" }),
      client.getGasPrice(),
      client.getBlockTransactionCount({ blockTag: "pending" }).catch(() => 0),
    ]);
    const maxPriorityFee = await client.estimateMaxPriorityFeePerGas().catch(() => 0n);
    return {
      baseFee: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : "0",
      maxPriorityFee: formatGwei(maxPriorityFee),
      gasPrice: formatGwei(gasPrice),
      lastBlock: Number(block.number),
      pendingCount: Number(pendingCount),
    };
  });
}

export async function getWalletBalance(address: string, chainName: string = "ethereum"): Promise<LiveBalanceData> {
  return cached(`balance:${address}:${chainName}`, 15_000, async () => {
    const alchemy = getAlchemy(chainName);
    const client = getPublicClient(chainName);

    const [ethBalance, tokenBalances, nfts] = await Promise.all([
      client.getBalance({ address: address as `0x${string}` }),
      alchemy.core.getTokenBalances(address).catch(() => ({ tokenBalances: [] })),
      alchemy.nft.getNftsForOwner(address, { pageSize: 20 }).catch(() => ({ ownedNfts: [] })),
    ]);

    const tokens: LiveBalanceData["tokens"] = [];
    for (const tb of tokenBalances.tokenBalances) {
      if (tb.tokenBalance && tb.tokenBalance !== "0x0" && BigInt(tb.tokenBalance) > 0n) {
        try {
          const meta = await alchemy.core.getTokenMetadata(tb.contractAddress);
          if (meta.symbol) {
            const decimals = meta.decimals || 18;
            const raw = BigInt(tb.tokenBalance);
            const balance = Number(raw) / Math.pow(10, decimals);
            if (balance > 0.0001) {
              tokens.push({
                symbol: meta.symbol,
                balance: balance.toFixed(Math.min(decimals, 6)),
                contractAddress: tb.contractAddress,
                decimals,
              });
            }
          }
        } catch {}
      }
    }

    const nftList: LiveBalanceData["nfts"] = nfts.ownedNfts.map(nft => ({
      title: nft.name || nft.contract.name || "Unknown NFT",
      tokenId: nft.tokenId,
      contractAddress: nft.contract.address,
      imageUrl: nft.image?.thumbnailUrl || nft.image?.cachedUrl || null,
    }));

    return {
      eth: formatEther(ethBalance),
      tokens: tokens.slice(0, 50),
      nfts: nftList.slice(0, 50),
    };
  });
}

export async function getWalletTransactions(
  address: string,
  chainName: string = "ethereum",
  limit: number = 25
): Promise<LiveTxData[]> {
  return cached(`txs:${address}:${chainName}:${limit}`, 20_000, async () => {
    const alchemy = getAlchemy(chainName);

    const [sent, received] = await Promise.all([
      alchemy.core.getAssetTransfers({
        fromAddress: address,
        category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.ERC20, AssetTransfersCategory.ERC721],
        maxCount: Math.ceil(limit / 2),
        order: SortingOrder.DESCENDING,
        withMetadata: true,
      }),
      alchemy.core.getAssetTransfers({
        toAddress: address,
        category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.ERC20, AssetTransfersCategory.ERC721],
        maxCount: Math.ceil(limit / 2),
        order: SortingOrder.DESCENDING,
        withMetadata: true,
      }),
    ]);

    const allTransfers = [...sent.transfers, ...received.transfers]
      .sort((a, b) => {
        const tA = a.metadata?.blockTimestamp ? new Date(a.metadata.blockTimestamp).getTime() : 0;
        const tB = b.metadata?.blockTimestamp ? new Date(b.metadata.blockTimestamp).getTime() : 0;
        return tB - tA;
      })
      .slice(0, limit);

    return allTransfers.map(t => ({
      hash: t.hash,
      from: t.from,
      to: t.to || null,
      value: t.value?.toString() || "0",
      gasPrice: "0",
      blockNumber: t.blockNum ? parseInt(t.blockNum, 16) : null,
      status: "confirmed" as const,
      timestamp: t.metadata?.blockTimestamp ? new Date(t.metadata.blockTimestamp).getTime() : Date.now(),
      chain: chainName,
      asset: t.asset || "ETH",
      category: t.category,
    }));
  });
}

export async function getTransactionReceipt(txHash: string, chainName: string = "ethereum") {
  const client = getPublicClient(chainName);
  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
    return {
      hash: txHash,
      from: tx.from,
      to: tx.to || null,
      value: formatEther(tx.value),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: formatGwei(receipt.effectiveGasPrice),
      blockNumber: Number(receipt.blockNumber),
      status: receipt.status === "success" ? "confirmed" : "failed",
      contractAddress: receipt.contractAddress || null,
    };
  } catch {
    return null;
  }
}

export async function getNetworkStats(chainName: string = "ethereum") {
  return cached(`netstats:${chainName}`, 15_000, async () => {
    const client = getPublicClient(chainName);
    const [block, gasPrice, chainId] = await Promise.all([
      client.getBlock({ blockTag: "latest" }),
      client.getGasPrice(),
      client.getChainId(),
    ]);

    return {
      chainId,
      chainName,
      blockNumber: Number(block.number),
      blockTimestamp: Number(block.timestamp),
      gasPrice: formatGwei(gasPrice),
      baseFee: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : null,
      txCount: block.transactions.length,
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString(),
    };
  });
}

export async function subscribeNewBlocks(
  chainName: string,
  callback: (block: LiveBlockData) => void
): Promise<() => void> {
  const client = getPublicClient(chainName);
  const unwatch = client.watchBlockNumber({
    onBlockNumber: async (blockNumber) => {
      try {
        const block = await client.getBlock({ blockNumber });
        callback({
          number: Number(block.number),
          hash: block.hash!,
          parentHash: block.parentHash,
          timestamp: Number(block.timestamp),
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          baseFeePerGas: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : null,
          transactionCount: block.transactions.length,
          miner: (block as any).miner || "0x0000000000000000000000000000000000000000",
          difficulty: ((block as any).difficulty || 0n).toString(),
          size: Number((block as any).size || 0),
        });
      } catch (err) {
        console.error(`[LiveChain] Block fetch error on ${chainName}:`, err);
      }
    },
    pollingInterval: 12_000,
  });
  return unwatch;
}

export async function sendRawTransaction(signedTx: string, chainName: string = "ethereum") {
  const client = getPublicClient(chainName);
  const hash = await client.sendRawTransaction({
    serializedTransaction: signedTx as `0x${string}`,
  });
  return { hash, status: "pending" };
}

export function isConfigured(): boolean {
  return !!process.env.ALCHEMY_API_KEY;
}

export function getSupportedChains(): string[] {
  return Object.keys(CHAIN_CONFIGS);
}
