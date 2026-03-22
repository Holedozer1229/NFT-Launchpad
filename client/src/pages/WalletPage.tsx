import { useState, useEffect, useCallback } from "react";
import { Wallet, Send, ArrowDownLeft, Copy, Plus, RefreshCw, CheckCircle, ExternalLink, Coins, Clock, Shield, ChevronDown, Fingerprint, AlertTriangle, Smartphone, Lock, Globe, Zap, Download, ArrowLeftRight, TrendingUp, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getJwtToken } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { isMobileDevice, openWalletApp } from "@/lib/wallet-utils";
import { usePrices } from "@/hooks/use-prices";
import { haptic } from "@/lib/haptics";
import { MfaSetup } from "@/components/MfaSetup";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getJwtToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

interface LiveChainBalance {
  eth: string;
  tokens: Array<{ symbol: string; balance: string; contractAddress: string; decimals: number }>;
  nfts: Array<{ title: string; tokenId: string; contractAddress: string; imageUrl: string | null }>;
}

interface LiveChainTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: number | null;
  status: string;
  timestamp: number;
  chain: string;
  asset: string;
  category: string;
}

interface SphinxWallet {
  id: number;
  userId: number;
  name: string;
  address: string;
  balanceStx: string;
  balanceSkynt: string;
  balanceEth: string;
  createdAt: string;
}

interface WalletTx {
  id: number;
  walletId: number;
  type: string;
  toAddress: string | null;
  fromAddress: string | null;
  amount: string;
  token: string;
  status: string;
  txHash: string | null;
  explorerUrl: string | null;
  networkFee: string | null;
  createdAt: string;
}

const TOKEN_OPTIONS = [
  { symbol: "SKYNT", label: "SKYNT Token", color: "cyan", icon: "🦁" },
  { symbol: "STX", label: "Stacks", color: "orange", icon: "⟐" },
  { symbol: "ETH", label: "Ethereum", color: "magenta", icon: "⟠" },
];

export default function WalletPage() {
  const { user } = useAuth();
  const { data: prices } = usePrices();
  const queryClient = useQueryClient();

  const { address: externalAddress, isConnected: externalWalletConnected, connector: externalConnector } = useAccount();
  const { disconnect: disconnectExternal } = useDisconnect();
  const { connectors, connect: wagmiConnect, isPending: isExternalConnecting } = useConnect();

  const externalProvider = externalConnector ? (externalConnector.name.toLowerCase().includes("phantom") ? "phantom" : "metamask") : null;

  const mobile = isMobileDevice();
  const [activeWalletId, setActiveWalletId] = useState<number | null>(null);
  const [tab, setTab] = useState<"overview" | "send" | "receive" | "swap">("overview");
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendToken, setSendToken] = useState("SKYNT");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState("");
  const [lastSendReceipt, setLastSendReceipt] = useState<WalletTx | null>(null);
  const [copied, setCopied] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [swapFromToken, setSwapFromToken] = useState("SKYNT");
  const [swapToToken, setSwapToToken] = useState("ETH");
  const [swapAmount, setSwapAmount] = useState("");
  const [debouncedSwapAmount, setDebouncedSwapAmount] = useState("");
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [swapError, setSwapError] = useState("");

  const { data: wallets = [], isLoading: loading } = useQuery<SphinxWallet[]>({
    queryKey: ["/api/wallet/list"],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const activeWallet = wallets.find(w => w.id === activeWalletId) || wallets[0] || null;

  useEffect(() => {
    if (wallets.length > 0 && !activeWalletId) {
      setActiveWalletId(wallets[0].id);
    }
  }, [wallets, activeWalletId]);

  const { data: transactions = [] } = useQuery<WalletTx[]>({
    queryKey: ["/api/wallet", activeWallet?.id, "transactions"],
    enabled: !!activeWallet,
    refetchInterval: 15000,
    staleTime: 5000,
    queryFn: async () => {
      if (!activeWallet) return [];
      const res = await fetch(`/api/wallet/${activeWallet.id}/transactions`, { credentials: "include", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  useEffect(() => {
    if (wallets.length === 0 && !loading) {
      apiRequest("POST", "/api/wallet/create", { name: "Main Wallet" }).then(res => {
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["/api/wallet/list"] });
        }
      }).catch(() => {});
    }
  }, [wallets.length, loading, queryClient]);

  const { data: liveBalance, isLoading: liveBalanceLoading } = useQuery<LiveChainBalance>({
    queryKey: ["/api/chain/ethereum/balance", externalAddress],
    enabled: !!externalAddress && externalWalletConnected,
    refetchInterval: 30000,
    staleTime: 15000,
    queryFn: async () => {
      const res = await fetch(`/api/chain/ethereum/balance/${externalAddress}`, { credentials: "include", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch live balance");
      return res.json();
    },
  });

  const { data: liveTxs = [] } = useQuery<LiveChainTx[]>({
    queryKey: ["/api/chain/ethereum/transactions", externalAddress],
    enabled: !!externalAddress && externalWalletConnected,
    refetchInterval: 30000,
    staleTime: 20000,
    queryFn: async () => {
      const res = await fetch(`/api/chain/ethereum/transactions/${externalAddress}?limit=15`, { credentials: "include", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch live transactions");
      return res.json();
    },
  });

  const { data: liveGas } = useQuery<{ baseFee: string; gasPrice: string; lastBlock: number }>({
    queryKey: ["/api/chain/ethereum/gas"],
    refetchInterval: 12000,
    staleTime: 10000,
    queryFn: async () => {
      const res = await fetch("/api/chain/ethereum/gas", { credentials: "include", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch gas");
      return res.json();
    },
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSwapAmount(swapAmount), 600);
    return () => clearTimeout(t);
  }, [swapAmount]);

  const { data: swapQuote, isLoading: swapQuoteLoading } = useQuery<{
    fromToken: string; toToken: string; inputAmount: number; outputAmount: number;
    rate: number; feeAmount: number; priceImpact: string; source: string;
  }>({
    queryKey: ["/api/wallet", activeWallet?.id, "swap-quote", swapFromToken, swapToToken, debouncedSwapAmount],
    enabled: !!activeWallet && !!debouncedSwapAmount && parseFloat(debouncedSwapAmount) > 0 && swapFromToken !== swapToToken,
    queryFn: async () => {
      if (!activeWallet) throw new Error("No wallet");
      const params = new URLSearchParams({ fromToken: swapFromToken, toToken: swapToToken, amount: debouncedSwapAmount });
      const res = await fetch(`/api/wallet/${activeWallet.id}/swap/quote?${params}`, { credentials: "include", headers: authHeaders() });
      if (!res.ok) throw new Error("Quote failed");
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 20000,
  });

  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!activeWallet) throw new Error("No wallet");
      const res = await fetch(`/api/wallet/${activeWallet.id}/swap`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ fromToken: swapFromToken, toToken: swapToToken, amount: swapAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Swap failed");
      return data;
    },
    onSuccess: () => {
      setSwapSuccess(true);
      setSwapAmount("");
      setDebouncedSwapAmount("");
      setSwapError("");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet", activeWallet?.id, "transactions"] });
      setTimeout(() => setSwapSuccess(false), 5000);
    },
    onError: (err: Error) => {
      setSwapError(err.message || "Swap failed");
    },
  });

  const validateAddress = (value: string, token?: string) => {
    const tok = token ?? sendToken;
    if (!value) { setAddressError(""); return; }
    if (tok === "ETH") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) { setAddressError("Invalid ETH address (must start with 0x, 42 chars)"); return; }
    } else if (tok === "STX") {
      if (!/^S[A-Z0-9]{38,41}$/.test(value)) { setAddressError("Invalid STX address (must start with SP, SM, etc.)"); return; }
    }
    if (activeWallet && value.toLowerCase() === activeWallet.address.toLowerCase()) { setAddressError("Cannot send to your own wallet"); return; }
    setAddressError("");
  };

  const validateSendAmount = (value: string) => {
    if (!value) { setAmountError(""); return; }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { setAmountError("Enter a valid positive amount"); return; }
    if (activeWallet) {
      const bal = getBalance(activeWallet, sendToken);
      if (num > bal) { setAmountError(`Insufficient ${sendToken} balance`); return; }
    }
    setAmountError("");
  };

  const handleSelectWallet = (w: SphinxWallet) => {
    setActiveWalletId(w.id);
    setTab("overview");
  };

  const createWalletMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wallet/create", { name: `Wallet ${wallets.length + 1}` });
      return res.json();
    },
    onSuccess: (newWallet: SphinxWallet) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/list"] });
      setActiveWalletId(newWallet.id);
    },
  });

  const consolidateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wallet/consolidate", {});
      return res.json();
    },
    onSuccess: (data: { wallet: SphinxWallet; deletedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/list"] });
      // Switch active wallet to the admin wallet (only one remaining)
      if (data?.wallet?.id) setActiveWalletId(data.wallet.id);
    },
  });

  const handleSend = async () => {
    if (!activeWallet || !sendTo || !sendAmount || parseFloat(sendAmount) <= 0) return;
    setSending(true);
    setSendError("");
    setSendSuccess(false);
    try {
      const res = await fetch(`/api/wallet/${activeWallet.id}/send`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ toAddress: sendTo, amount: sendAmount, token: sendToken }),
      });
      const data = await res.json();
      if (res.ok) {
        haptic("transaction");
        setLastSendReceipt(data.transaction ?? null);
        setSendSuccess(true);
        setSendTo("");
        setSendAmount("");
        queryClient.invalidateQueries({ queryKey: ["/api/wallet/list"] });
        queryClient.invalidateQueries({ queryKey: ["/api/wallet", activeWallet.id, "transactions"] });
      } else {
        haptic("error");
        setSendError(data.message || "Transaction failed");
      }
    } catch (err) {
      haptic("error");
      setSendError("Network error");
    } finally {
      setSending(false);
    }
  };

  const handleCopy = () => {
    if (activeWallet) {
      navigator.clipboard.writeText(activeWallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getBalance = (w: SphinxWallet, token: string) => {
    if (token === "STX") return parseFloat(w.balanceStx);
    if (token === "ETH") return parseFloat(w.balanceEth);
    return parseFloat(w.balanceSkynt);
  };

  const totalUsd = activeWallet
    ? getBalance(activeWallet, "SKYNT") * (prices?.SKYNT.usd ?? 0.45) + getBalance(activeWallet, "STX") * (prices?.STX.usd ?? 1.85) + getBalance(activeWallet, "ETH") * (prices?.ETH.usd ?? 3200)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="wallet-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading neon-glow-cyan flex items-center gap-2" data-testid="text-wallet-title">
            <Wallet className="w-6 h-6" /> SKYNT Wallet
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Your in-app crypto wallet — manage SKYNT, STX, and ETH</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <a
            data-testid="button-download-wallet-json"
            href="/api/mining/wallet.json"
            download
            className="connect-wallet-btn px-4 py-2 rounded-sm font-heading text-[10px] sm:text-xs tracking-wider flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto"
            style={{ background: "rgba(57,255,20,0.1)", borderColor: "rgba(57,255,20,0.3)", color: "#39ff14" }}
          >
            <Download className="w-3.5 h-3.5" /> wallet.json
          </a>
          {wallets.length > 1 && (
            <button
              data-testid="button-consolidate-wallets"
              onClick={() => {
                const adminWallet = [...(wallets ?? [])].sort((a, b) => a.id - b.id)[0];
                const othersCount = (wallets?.length ?? 0) - 1;
                if (window.confirm(
                  `Consolidate all balances into "${adminWallet?.name ?? "your primary wallet"}" (admin wallet)?\n\n` +
                  `${othersCount} other wallet${othersCount !== 1 ? "s" : ""} will be permanently deleted.`
                )) {
                  consolidateMutation.mutate();
                }
              }}
              disabled={consolidateMutation.isPending}
              className="connect-wallet-btn px-4 py-2 rounded-sm font-heading text-[10px] sm:text-xs tracking-wider flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto"
              style={{ background: "rgba(255,165,0,0.1)", borderColor: "rgba(255,165,0,0.3)", color: "#ffa500" }}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {consolidateMutation.isPending ? "Consolidating..." : "Consolidate"}
            </button>
          )}
          <button
            data-testid="button-create-wallet"
            onClick={() => createWalletMutation.mutate()}
            disabled={createWalletMutation.isPending}
            className="connect-wallet-btn px-4 py-2 rounded-sm font-heading text-[10px] sm:text-xs tracking-wider flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" /> {createWalletMutation.isPending ? "Creating..." : "New Wallet"}
          </button>
        </div>
      </div>

      {wallets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {wallets.map((w) => (
            <button
              key={w.id}
              data-testid={`wallet-tab-${w.id}`}
              onClick={() => handleSelectWallet(w)}
              className={`shrink-0 px-4 py-2 rounded-sm text-xs font-heading uppercase tracking-wider transition-all border ${
                activeWallet?.id === w.id
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-black/20 text-muted-foreground border-border/30 hover:border-border"
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      {activeWallet && (
        <>
          <div className="wallet-verify-badge p-3 rounded-sm flex items-center gap-3 mb-4" data-testid="identity-verification-badge">
            <Fingerprint className="w-5 h-5 text-neon-cyan shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-heading uppercase tracking-wider text-neon-cyan">Identity Verified</p>
              <p className="text-[10px] font-mono text-muted-foreground truncate">
                Authenticated as {user?.username} — SKYNT Wallet verifies your on-chain identity
              </p>
            </div>
            <Shield className="w-4 h-4 text-neon-green shrink-0" />
          </div>

          {externalWalletConnected && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-white/[0.03] border border-white/10 mb-4" data-testid="external-wallet-status">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              <span className="text-[10px] font-heading uppercase tracking-wider text-foreground">
                {externalProvider === "phantom" ? "👻 Phantom" : "🦊 MetaMask"} Connected
              </span>
              <span className="font-mono text-[10px] text-muted-foreground truncate">
                {externalAddress ? `${externalAddress.slice(0, 6)}...${externalAddress.slice(-4)}` : ""}
              </span>
            </div>
          )}

          <div className="cosmic-card cosmic-card-cyan p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="stat-label">{activeWallet.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs text-muted-foreground" data-testid="text-wallet-address">
                    {activeWallet.address.slice(0, 10)}...{activeWallet.address.slice(-8)}
                  </span>
                  <button
                    data-testid="button-copy-address"
                    onClick={handleCopy}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Copy address"
                  >
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-neon-green" />
                <span className="text-[10px] font-heading uppercase text-neon-green">Secured</span>
              </div>
            </div>

            <div className="text-center py-4">
              <p className="stat-label mb-1">Total Value</p>
              <p className="text-3xl font-heading text-neon-cyan" data-testid="text-total-value">
                ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4">
              {TOKEN_OPTIONS.map((t) => {
                const bal = getBalance(activeWallet, t.symbol);
                return (
                  <div key={t.symbol} className="text-center p-2 sm:p-3 bg-black/30 border border-border/30 rounded-sm" data-testid={`balance-${t.symbol}`}>
                    <span className="text-base sm:text-lg">{t.icon}</span>
                    <p className={`font-heading text-[10px] sm:text-sm mt-1 text-neon-${t.color} flex flex-col sm:block`}>
                      <span>{bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {prices && (
                        <span className="text-[8px] sm:text-[9px] text-muted-foreground sm:ml-1">
                          (${(bal * prices[t.symbol as keyof typeof prices].usd).toFixed(2)})
                        </span>
                      )}
                    </p>
                    <p className="text-[8px] sm:text-[10px] text-muted-foreground font-mono">{t.symbol}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {prices && activeWallet && (
            <div className="cosmic-card cosmic-card-cyan p-4 mt-3" data-testid="card-portfolio-value">
              <span className="stat-label">Total Portfolio Value</span>
              <div className="stat-value text-neon-cyan">
                ${(
                  parseFloat(activeWallet.balanceSkynt) * prices.SKYNT.usd +
                  parseFloat(activeWallet.balanceStx) * prices.STX.usd +
                  parseFloat(activeWallet.balanceEth) * prices.ETH.usd
                ).toFixed(2)}
              </div>
              <div className="flex gap-3 mt-2">
                {(["SKYNT", "STX", "ETH"] as const).map(token => {
                  const change = prices[token].usd_24h_change;
                  return (
                    <span key={token} className={`text-[9px] font-mono ${change >= 0 ? "text-neon-green" : "text-red-400"}`}>
                      {token} {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {externalWalletConnected && externalAddress && (
            <div className="cosmic-card p-4 mt-3 border border-cyan-500/20" data-testid="card-live-chain">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-cyan-400" />
                <h3 className="font-heading text-sm uppercase tracking-wider text-cyan-400">Live Mainnet Data</h3>
                <span className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-green-400">LIVE RPC</span>
                </span>
              </div>

              {liveGas && (
                <div className="flex gap-3 mb-3 text-[10px] font-mono">
                  <span className="text-muted-foreground">Block <span className="text-cyan-400">#{liveGas.lastBlock.toLocaleString()}</span></span>
                  <span className="text-muted-foreground">Gas <span className="text-yellow-400">{parseFloat(liveGas.baseFee).toFixed(1)} gwei</span></span>
                </div>
              )}

              {liveBalanceLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                  <span className="text-xs text-muted-foreground">Fetching on-chain balances...</span>
                </div>
              ) : liveBalance ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-black/30 border border-white/5 rounded-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⟠</span>
                      <span className="text-xs font-heading text-white">ETH Balance</span>
                    </div>
                    <span className="font-mono text-xs text-cyan-400" data-testid="text-live-eth-balance">
                      {parseFloat(liveBalance.eth).toFixed(6)} ETH
                    </span>
                  </div>

                  {liveBalance.tokens.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-heading uppercase text-muted-foreground tracking-wider">ERC-20 Tokens</p>
                      {liveBalance.tokens.slice(0, 8).map((t, i) => (
                        <div key={i} className="flex items-center justify-between px-2 py-1.5 bg-black/20 border border-white/5 rounded-sm">
                          <span className="text-[10px] font-mono text-white">{t.symbol}</span>
                          <span className="text-[10px] font-mono text-cyan-400">{t.balance}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {liveBalance.nfts.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-heading uppercase text-muted-foreground tracking-wider">NFTs ({liveBalance.nfts.length})</p>
                      <div className="grid grid-cols-3 gap-1">
                        {liveBalance.nfts.slice(0, 6).map((nft, i) => (
                          <div key={i} className="p-1.5 bg-black/20 border border-white/5 rounded-sm text-center">
                            {nft.imageUrl && <img src={nft.imageUrl} alt={nft.title} className="w-full h-12 object-cover rounded-sm mb-1" />}
                            <p className="text-[8px] font-mono text-muted-foreground truncate">{nft.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {liveTxs.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[10px] font-heading uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Recent On-Chain Transactions
                  </p>
                  {liveTxs.slice(0, 5).map((tx, i) => {
                    const isSent = tx.from.toLowerCase() === externalAddress.toLowerCase();
                    return (
                      <div key={i} className="flex items-center justify-between px-2 py-1.5 bg-black/20 border border-white/5 rounded-sm" data-testid={`live-tx-${i}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isSent ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                            {isSent ? "↑" : "↓"}
                          </div>
                          <div>
                            <p className="text-[10px] font-mono text-white truncate max-w-[120px]">
                              {isSent ? `To: ${tx.to?.slice(0, 8)}...` : `From: ${tx.from.slice(0, 8)}...`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-[10px] font-mono ${isSent ? "text-red-400" : "text-green-400"}`}>
                            {isSent ? "-" : "+"}{parseFloat(tx.value).toFixed(4)} {tx.asset}
                          </p>
                          <a
                            href={`https://etherscan.io/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[8px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5 justify-end"
                          >
                            <ExternalLink className="w-2 h-2" /> Etherscan
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            {(["overview", "send", "receive", "swap"] as const).map((t) => (
              <button
                key={t}
                data-testid={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-sm text-xs font-heading uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  tab === t ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/20 text-muted-foreground border border-border/30"
                }`}
              >
                {t === "overview" && <Coins className="w-3.5 h-3.5" />}
                {t === "send" && <Send className="w-3.5 h-3.5" />}
                {t === "receive" && <ArrowDownLeft className="w-3.5 h-3.5" />}
                {t === "swap" && <ArrowLeftRight className="w-3.5 h-3.5" />}
                {t}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="cosmic-card cosmic-card-orange p-4">
              <h3 className="font-heading text-sm uppercase tracking-wider mb-4 flex items-center gap-2" data-testid="text-tx-history">
                <Clock className="w-4 h-4 text-neon-orange" /> Transaction History
              </h3>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-black/20 border border-border/30 rounded-sm" data-testid={`tx-${tx.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          tx.type === "send" ? "bg-red-500/10 text-red-400" : tx.type === "swap" ? "bg-purple-500/10 text-purple-400" : "bg-neon-green/10 text-neon-green"
                        }`}>
                          {tx.type === "send" ? <Send className="w-3.5 h-3.5" /> : tx.type === "swap" ? <ArrowLeftRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-heading text-xs uppercase">{tx.type === "send" ? "Sent" : tx.type === "reward" ? "Mining Reward" : tx.type === "swap" ? "Swap" : "Received"} {tx.token}</p>
                          <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px] sm:max-w-[160px]">
                            {tx.type === "send" ? `To: ${tx.toAddress?.slice(0, 10)}...` : tx.type === "reward" ? "Background Mining" : tx.type === "swap" ? "Token Swap" : `From: ${tx.fromAddress?.slice(0, 10)}...`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <p className={`font-mono text-xs ${tx.type === "send" ? "text-red-400" : "text-neon-green"}`}>
                            {tx.type === "send" ? "-" : "+"}{tx.amount} {tx.token}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                          </p>
                        </div>
                        {tx.explorerUrl && (
                          <a
                            data-testid={`link-explorer-${tx.id}`}
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-sm text-muted-foreground hover:text-neon-green transition-colors"
                            title="View on explorer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "send" && (
            <div className="cosmic-card cosmic-card-magenta p-5 space-y-5">
              <h3 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-neon-magenta" /> Send Tokens
              </h3>

              <>
                {externalWalletConnected && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-neon-green/5 border border-neon-green/20 text-[10px] font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                    <span className="text-neon-green">
                      Signing with {externalProvider === "phantom" ? "👻 Phantom" : "🦊 MetaMask"}: {externalAddress?.slice(0, 6)}...{externalAddress?.slice(-4)}
                    </span>
                  </div>
                )}

                {sendSuccess && lastSendReceipt && (
                  <div className="p-4 bg-neon-green/5 border border-neon-green/30 rounded-sm space-y-3" data-testid="send-receipt">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-neon-green shrink-0" />
                      <p className="text-xs font-heading text-neon-green uppercase tracking-wider">Transaction Broadcast</p>
                      <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-neon-orange/10 text-neon-orange border border-neon-orange/20">
                        {lastSendReceipt.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-[11px] font-mono">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="text-foreground font-semibold">{lastSendReceipt.amount} {lastSendReceipt.token}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">To</span>
                        <span className="text-foreground" data-testid="text-send-recipient">
                          {lastSendReceipt.toAddress ? `${lastSendReceipt.toAddress.slice(0, 8)}...${lastSendReceipt.toAddress.slice(-6)}` : "—"}
                        </span>
                      </div>
                      {lastSendReceipt.networkFee && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Est. Network Fee</span>
                          <span className="text-neon-orange">
                            {parseFloat(lastSendReceipt.networkFee).toFixed(8)} {lastSendReceipt.token === "ETH" ? "ETH" : lastSendReceipt.token === "STX" ? "STX" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    {lastSendReceipt.txHash && (
                      <div className="pt-2 border-t border-border/20 space-y-1.5">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Tx Hash</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 font-mono text-[10px] text-muted-foreground" data-testid="text-send-txhash">
                            {lastSendReceipt.txHash.slice(0, 10)}...{lastSendReceipt.txHash.slice(-8)}
                          </code>
                          <button
                            data-testid="button-copy-txhash"
                            onClick={() => navigator.clipboard.writeText(lastSendReceipt!.txHash!)}
                            className="shrink-0 p-1.5 rounded-sm bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                            title="Copy full hash"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {lastSendReceipt.explorerUrl && (
                            <a
                              data-testid="link-send-explorer"
                              href={lastSendReceipt.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1.5 rounded-sm bg-neon-green/10 hover:bg-neon-green/20 text-neon-green transition-colors"
                              title="View on block explorer"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    <button
                      data-testid="button-close-receipt"
                      onClick={() => { setSendSuccess(false); setLastSendReceipt(null); }}
                      className="w-full py-1.5 text-[10px] font-heading uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border/20 rounded-sm transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {sendError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-sm text-center">
                    <p className="text-xs text-red-400">{sendError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="stat-label">Token</label>
                  <div className="flex gap-2">
                    {TOKEN_OPTIONS.map((t) => (
                      <button
                        key={t.symbol}
                        data-testid={`send-token-${t.symbol}`}
                        onClick={() => { setSendToken(t.symbol); validateAddress(sendTo, t.symbol); }}
                        className={`flex-1 py-2 rounded-sm text-xs font-heading uppercase flex items-center justify-center gap-1.5 border transition-all ${
                          sendToken === t.symbol ? "bg-primary/20 text-primary border-primary/40" : "bg-black/20 text-muted-foreground border-border/30"
                        }`}
                      >
                        <span>{t.icon}</span> {t.symbol}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="stat-label">Recipient Address</label>
                  <input
                    data-testid="input-send-to"
                    type="text"
                    placeholder={sendToken === "STX" ? "SP... or SM..." : "0x..."}
                    value={sendTo}
                    onChange={(e) => { setSendTo(e.target.value); validateAddress(e.target.value); }}
                    className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-sm focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40"
                  />
                  {addressError && <p className="text-[10px] font-mono text-red-400 mt-1" data-testid="error-send-address">{addressError}</p>}
                </div>

                <div className="space-y-2">
                  <label className="stat-label">Amount</label>
                  <div className="relative">
                    <input
                      data-testid="input-send-amount"
                      type="number"
                      placeholder="0.00"
                      value={sendAmount}
                      onChange={(e) => { setSendAmount(e.target.value); validateSendAmount(e.target.value); }}
                      className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-lg focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-heading">{sendToken}</span>
                  </div>
                  {amountError && <p className="text-[10px] font-mono text-red-400 mt-1" data-testid="error-send-amount">{amountError}</p>}
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
                    <span>Balance: {activeWallet ? getBalance(activeWallet, sendToken).toLocaleString() : 0} {sendToken}</span>
                    <button
                      data-testid="button-send-max"
                      onClick={() => activeWallet && setSendAmount(getBalance(activeWallet, sendToken).toString())}
                      className="text-primary hover:text-primary/80"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <button
                  data-testid="button-send-submit"
                  onClick={handleSend}
                  disabled={sending || !sendTo || !sendAmount || !!addressError || !!amountError}
                  className="w-full py-4 rounded-sm bg-primary text-primary-foreground font-heading uppercase tracking-widest flex items-center justify-center gap-2 hover-elevate active-elevate-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4"
                >
                  {sending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send {sendToken}
                    </>
                  )}
                </button>

                {!externalWalletConnected && (
                  <div className="mt-6 p-4 rounded-sm border border-white/10 bg-white/5 space-y-3" data-testid="wallet-connect-optional">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">External Wallet (Optional)</p>
                    </div>
                    <p className="text-[9px] font-mono text-muted-foreground/60">
                      You can connect an external wallet for additional signing security, but it is not required for in-app transfers.
                    </p>
                    <div className="flex gap-2">
                      <ConnectWalletButton
                        showBalance={false}
                        chainStatus="icon"
                        label="Connect External Wallet"
                      />
                    </div>
                  </div>
                )}
              </>
            </div>
          )}

          {tab === "swap" && (
            <div className="cosmic-card p-5 space-y-5 border border-purple-500/20" data-testid="swap-panel">
              <h3 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-purple-400" /> Swap Tokens
                <span className="ml-auto flex items-center gap-1 text-[9px] font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> CoinGecko Live
                </span>
              </h3>

              {swapSuccess && (
                <div className="p-3 bg-neon-green/10 border border-neon-green/30 rounded-sm text-center space-y-1" data-testid="swap-success">
                  <CheckCircle className="w-5 h-5 text-neon-green mx-auto" />
                  <p className="text-xs font-heading text-neon-green">Swap Completed</p>
                </div>
              )}

              {swapError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-sm text-center" data-testid="swap-error">
                  <p className="text-xs text-red-400">{swapError}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="stat-label">From</label>
                  <div className="flex gap-2">
                    {TOKEN_OPTIONS.map((t) => (
                      <button
                        key={t.symbol}
                        data-testid={`swap-from-${t.symbol}`}
                        onClick={() => {
                          if (t.symbol === swapToToken) setSwapToToken(swapFromToken);
                          setSwapFromToken(t.symbol);
                          setSwapError("");
                        }}
                        className={`flex-1 py-2 rounded-sm text-xs font-heading uppercase flex items-center justify-center gap-1.5 border transition-all ${
                          swapFromToken === t.symbol ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-black/20 text-muted-foreground border-border/30"
                        }`}
                      >
                        <span>{t.icon}</span> {t.symbol}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="stat-label">Amount</label>
                  <div className="relative">
                    <input
                      data-testid="input-swap-amount"
                      type="number"
                      placeholder="0.00"
                      value={swapAmount}
                      onChange={(e) => { setSwapAmount(e.target.value); setSwapError(""); }}
                      className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-lg focus:outline-none focus:border-purple-500/60 transition-colors placeholder:text-muted-foreground/40"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-heading">{swapFromToken}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
                    <span>Balance: {activeWallet ? getBalance(activeWallet, swapFromToken).toLocaleString(undefined, { maximumFractionDigits: 6 }) : 0} {swapFromToken}</span>
                    <button
                      data-testid="button-swap-max"
                      onClick={() => activeWallet && setSwapAmount(getBalance(activeWallet, swapFromToken).toString())}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    data-testid="button-swap-direction"
                    onClick={() => {
                      const tmp = swapFromToken;
                      setSwapFromToken(swapToToken);
                      setSwapToToken(tmp);
                      setSwapAmount("");
                      setSwapError("");
                    }}
                    className="w-9 h-9 rounded-full border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 flex items-center justify-center text-purple-400 transition-all"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="stat-label">To</label>
                  <div className="flex gap-2">
                    {TOKEN_OPTIONS.map((t) => (
                      <button
                        key={t.symbol}
                        data-testid={`swap-to-${t.symbol}`}
                        onClick={() => {
                          if (t.symbol === swapFromToken) setSwapFromToken(swapToToken);
                          setSwapToToken(t.symbol);
                          setSwapError("");
                        }}
                        className={`flex-1 py-2 rounded-sm text-xs font-heading uppercase flex items-center justify-center gap-1.5 border transition-all ${
                          swapToToken === t.symbol ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-black/20 text-muted-foreground border-border/30"
                        }`}
                      >
                        <span>{t.icon}</span> {t.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-sm border border-purple-500/20 bg-purple-500/5 space-y-3" data-testid="swap-quote-panel">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-heading uppercase text-muted-foreground">Live Quote</span>
                  {swapQuoteLoading && <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />}
                </div>

                {swapQuote && parseFloat(swapAmount) > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">You receive</span>
                      <span className="font-heading text-sm text-purple-300" data-testid="text-swap-output">
                        {swapQuote.outputAmount.toFixed(8)} {swapToToken}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">Rate</span>
                      <span className="font-mono text-[10px] text-foreground" data-testid="text-swap-rate">
                        1 {swapFromToken} = {swapQuote.rate.toFixed(8)} {swapToToken}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">Protocol fee (0.3%)</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {swapQuote.feeAmount.toFixed(8)} {swapToToken}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">Price impact</span>
                      <span className="font-mono text-[10px] text-green-400">{swapQuote.priceImpact}</span>
                    </div>
                    <div className="pt-1 border-t border-white/5 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span className="text-[9px] font-mono text-green-400">Rates sourced live from CoinGecko market data</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] font-mono text-muted-foreground/50">
                    {parseFloat(swapAmount) > 0 ? "Fetching live rate..." : "Enter an amount to see a live quote"}
                  </p>
                )}
              </div>

              <button
                data-testid="button-swap-submit"
                onClick={() => { setSwapError(""); swapMutation.mutate(); }}
                disabled={swapMutation.isPending || !swapAmount || parseFloat(swapAmount) <= 0 || !swapQuote || swapFromToken === swapToToken}
                className="w-full py-4 rounded-sm font-heading uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(88,28,220,0.2))", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc" }}
              >
                {swapMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <><ArrowLeftRight className="w-4 h-4" /> Swap {swapFromToken} → {swapToToken}</>
                )}
              </button>
            </div>
          )}

          {tab === "receive" && (
            <div className="cosmic-card cosmic-card-green p-5 space-y-5">
              <h3 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-neon-green" /> Receive Tokens
              </h3>

              <div className="text-center py-6 space-y-4">
                <div className="w-32 h-32 mx-auto bg-white rounded-lg p-2 flex items-center justify-center">
                  <div className="w-full h-full bg-black/90 rounded flex items-center justify-center">
                    <div className="grid grid-cols-5 gap-0.5">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div key={i} className={`w-4 h-4 ${[0,1,3,4,5,7,9,10,12,14,15,17,19,20,21,23,24].includes(i) ? "bg-white" : "bg-transparent"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Scan QR or copy address below</p>
              </div>

              <div className="p-3 bg-black/30 border border-border/30 rounded-sm">
                <p className="stat-label mb-2">Your Wallet Address</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-xs text-foreground break-all" data-testid="text-receive-address">
                    {activeWallet.address}
                  </code>
                  <button
                    data-testid="button-copy-receive"
                    onClick={handleCopy}
                    className="shrink-0 p-2 rounded-sm bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-black/20 border border-border/50 rounded-sm text-xs space-y-2">
                <p className="stat-label">Supported Tokens</p>
                {TOKEN_OPTIONS.map((t) => (
                  <div key={t.symbol} className="flex items-center gap-2">
                    <span>{t.icon}</span>
                    <span className="font-heading">{t.symbol}</span>
                    <span className="text-muted-foreground">— {t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6">
        <MfaSetup />
      </div>

      {wallets.length === 0 && !loading && (
        <div className="cosmic-card p-8 text-center space-y-4">
          <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="font-heading text-sm text-muted-foreground">No Wallet Found</p>
          <p className="text-xs text-muted-foreground/60">Create your first SKYNT wallet to start managing tokens.</p>
          <button
            data-testid="button-create-first-wallet"
            onClick={() => createWalletMutation.mutate()}
            className="connect-wallet-btn px-6 py-2.5 rounded-sm font-heading text-sm tracking-wider mx-auto"
          >
            Create Wallet
          </button>
        </div>
      )}
    </div>
  );
}
