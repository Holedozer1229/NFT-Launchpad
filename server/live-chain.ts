import { Alchemy, Network, AssetTransfersCategory, SortingOrder, Utils } from "alchemy-sdk";

const CHAIN_CONFIGS: Record<string, { network: Network; chainId: number }> = {
  ethereum: { network: Network.ETH_MAINNET, chainId: 1 },
  polygon: { network: Network.MATIC_MAINNET, chainId: 137 },
  base: { network: Network.BASE_MAINNET, chainId: 8453 },
  zksync: { network: Network.ZKSYNC_MAINNET, chainId: 324 },
};

let _alchemyInstances: Map<string, Alchemy> = new Map();

function getApiKey(): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY not configured");
  return key;
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

function formatBlockData(block: any): LiveBlockData {
  return {
    number: typeof block.number === "number" ? block.number : Number(block.number),
    hash: block.hash || "",
    parentHash: block.parentHash || "",
    timestamp: typeof block.timestamp === "number" ? block.timestamp : Number(block.timestamp),
    gasUsed: block.gasUsed?.toString() || "0",
    gasLimit: block.gasLimit?.toString() || "0",
    baseFeePerGas: block.baseFeePerGas ? Utils.formatUnits(block.baseFeePerGas, "gwei") : null,
    transactionCount: block.transactions?.length || 0,
    miner: block.miner || "0x0000000000000000000000000000000000000000",
    difficulty: (block.difficulty || "0").toString(),
    size: typeof block.size === "number" ? block.size : Number(block.size || 0),
  };
}

export async function getLatestBlock(chainName: string = "ethereum"): Promise<LiveBlockData> {
  return cached(`block:latest:${chainName}`, 12_000, async () => {
    const alchemy = getAlchemy(chainName);
    const block = await alchemy.core.getBlock("latest");
    return formatBlockData(block);
  });
}

export async function getRecentBlocks(chainName: string = "ethereum", count: number = 5): Promise<LiveBlockData[]> {
  return cached(`blocks:recent:${chainName}:${count}`, 12_000, async () => {
    const alchemy = getAlchemy(chainName);
    const latest = await alchemy.core.getBlockNumber();
    const fetchPromises = [];
    for (let i = 0; i < count; i++) {
      const num = latest - i;
      if (num < 0) break;
      fetchPromises.push(
        alchemy.core.getBlock(num).then(block => formatBlockData(block))
      );
    }
    return Promise.all(fetchPromises);
  });
}

export async function getGasData(chainName: string = "ethereum"): Promise<LiveGasData> {
  return cached(`gas:${chainName}`, 10_000, async () => {
    const alchemy = getAlchemy(chainName);
    const [block, gasPrice] = await Promise.all([
      alchemy.core.getBlock("latest"),
      alchemy.core.getGasPrice(),
    ]);

    const pendingBlock = await alchemy.core.getBlock("pending").catch(() => null);
    const pendingCount = pendingBlock?.transactions?.length || 0;

    const maxPriorityFee = await alchemy.core.send("eth_maxPriorityFeePerGas", []).catch(() => "0x0");

    return {
      baseFee: block.baseFeePerGas ? Utils.formatUnits(block.baseFeePerGas, "gwei") : "0",
      maxPriorityFee: Utils.formatUnits(maxPriorityFee, "gwei"),
      gasPrice: Utils.formatUnits(gasPrice, "gwei"),
      lastBlock: block.number,
      pendingCount,
    };
  });
}

export async function getWalletBalance(address: string, chainName: string = "ethereum"): Promise<LiveBalanceData> {
  return cached(`balance:${address}:${chainName}`, 15_000, async () => {
    const alchemy = getAlchemy(chainName);

    const [ethBalance, tokenBalances, nfts] = await Promise.all([
      alchemy.core.getBalance(address),
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
      eth: Utils.formatEther(ethBalance),
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
  const alchemy = getAlchemy(chainName);
  try {
    const receipt = await alchemy.core.getTransactionReceipt(txHash);
    const tx = await alchemy.core.getTransaction(txHash);
    if (!receipt || !tx) return null;
    return {
      hash: txHash,
      from: tx.from,
      to: tx.to || null,
      value: Utils.formatEther(tx.value),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: Utils.formatUnits(receipt.effectiveGasPrice, "gwei"),
      blockNumber: receipt.blockNumber,
      status: receipt.status === 1 ? "confirmed" : "failed",
      contractAddress: receipt.contractAddress || null,
    };
  } catch {
    return null;
  }
}

export async function getNetworkStats(chainName: string = "ethereum") {
  return cached(`netstats:${chainName}`, 15_000, async () => {
    const alchemy = getAlchemy(chainName);
    const config = CHAIN_CONFIGS[chainName];
    const [block, gasPrice] = await Promise.all([
      alchemy.core.getBlock("latest"),
      alchemy.core.getGasPrice(),
    ]);

    return {
      chainId: config?.chainId || 1,
      chainName,
      blockNumber: block.number,
      blockTimestamp: block.timestamp,
      gasPrice: Utils.formatUnits(gasPrice, "gwei"),
      baseFee: block.baseFeePerGas ? Utils.formatUnits(block.baseFeePerGas, "gwei") : null,
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
  const alchemy = getAlchemy(chainName);

  const ws = alchemy.ws;
  const handler = async (blockNumber: number) => {
    try {
      const block = await alchemy.core.getBlock(blockNumber);
      callback(formatBlockData(block));
    } catch (err) {
      console.error(`[LiveChain] Block fetch error on ${chainName}:`, err);
    }
  };

  ws.on("block", handler);

  return () => {
    ws.off("block", handler);
  };
}

export async function sendRawTransaction(signedTx: string, chainName: string = "ethereum") {
  const alchemy = getAlchemy(chainName);
  const hash = await alchemy.transact.sendTransaction(signedTx);
  return { hash, status: "pending" };
}

export function isConfigured(): boolean {
  return !!process.env.ALCHEMY_API_KEY;
}

export function getSupportedChains(): string[] {
  return Object.keys(CHAIN_CONFIGS);
}
