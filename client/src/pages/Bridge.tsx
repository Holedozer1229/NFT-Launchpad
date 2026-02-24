import { useState } from "react";
import { ArrowDownUp, Wallet, Shield, Clock, AlertTriangle, ChevronDown, Zap, ExternalLink, Coins, Users, Lock, Unlock, Fingerprint, CheckCircle, Loader2, Smartphone, DollarSign } from "lucide-react";
import { useWallet } from "@/lib/mock-web3";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isMobileDevice, openWalletApp } from "@/lib/wallet-utils";
import { usePrices } from "@/hooks/use-prices";

const chains = [
  { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "⟠", color: "hsl(210 100% 55%)" },
  { id: "sphinx", name: "SphinxSkynet", symbol: "SPX", icon: "🦁", color: "hsl(40 100% 50%)" },
  { id: "solana", name: "Solana", symbol: "SOL", icon: "◎", color: "hsl(280 100% 60%)" },
  { id: "polygon", name: "Polygon", symbol: "MATIC", icon: "⬡", color: "hsl(300 100% 60%)" },
  { id: "arbitrum", name: "Arbitrum", symbol: "ARB", icon: "🔷", color: "hsl(210 100% 55%)" },
  { id: "base", name: "Base", symbol: "BASE", icon: "🔵", color: "hsl(210 100% 55%)" },
];

interface BridgeTx {
  id: number;
  fromChain: string;
  toChain: string;
  amount: string;
  token: string;
  status: string;
  signatures: string;
  mechanism: string;
  txHash: string | null;
  createdAt: string | null;
}

interface GuardianData {
  id: number;
  guardianIndex: number;
  status: string;
  lastSignature: string | null;
  publicKey: string | null;
}

export default function Bridge() {
  const [sourceChain, setSourceChain] = useState("ethereum");
  const [destChain, setDestChain] = useState("sphinx");
  const [amount, setAmount] = useState("");
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [bridgeSuccess, setBridgeSuccess] = useState(false);
  const [amountError, setAmountError] = useState("");
  const { isConnected, address, connect, isConnecting } = useWallet();
  const queryClient = useQueryClient();
  const { data: prices } = usePrices();

  const { data: bridgeTransactions = [], isLoading: txLoading } = useQuery<BridgeTx[]>({
    queryKey: ["/api/bridge/transactions"],
    refetchInterval: 15000,
  });

  const { data: guardiansList = [], isLoading: guardiansLoading } = useQuery<GuardianData[]>({
    queryKey: ["/api/bridge/guardians"],
    refetchInterval: 30000,
  });

  const bridgeMutation = useMutation({
    mutationFn: async (data: { fromChain: string; toChain: string; amount: string; mechanism: string }) => {
      const res = await apiRequest("POST", "/api/bridge/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bridge/transactions"] });
      setBridgeSuccess(true);
      setAmount("");
      setTimeout(() => setBridgeSuccess(false), 5000);
    },
  });

  const source = chains.find((c) => c.id === sourceChain)!;
  const dest = chains.find((c) => c.id === destChain)!;

  const validateAmount = (value: string) => {
    if (!value) { setAmountError(""); return; }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { setAmountError("Enter a valid positive amount"); return; }
    if (num < 0.001) { setAmountError("Minimum bridge amount is 0.001 SKYNT"); return; }
    if (num > 1000000) { setAmountError("Maximum bridge amount is 1,000,000 SKYNT"); return; }
    setAmountError("");
  };

  const swapChains = () => {
    setSourceChain(destChain);
    setDestChain(sourceChain);
  };

  const bridgeFee = amount ? (parseFloat(amount) * 0.001).toFixed(4) : "0.0000";
  const netReceive = amount ? (parseFloat(amount) * 0.999).toFixed(4) : "0.0000";
  const estimatedTime = sourceChain === "ethereum" ? "~15 min" : "~5 min";

  const isLockMint = sourceChain !== "sphinx";
  const mechanism = isLockMint ? "Lock → Mint" : "Burn → Release";

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    bridgeMutation.mutate({
      fromChain: source.name,
      toChain: dest.name,
      amount,
      mechanism,
    });
  };

  const onlineGuardians = guardiansList.filter((g) => g.status === "online").length;

  function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "—";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto" data-testid="bridge-page">
      <div className="text-center">
        <h1 className="text-2xl font-heading neon-glow-cyan flex items-center justify-center gap-2" data-testid="text-bridge-title">
          <Coins className="w-6 h-6" /> SphinxBridge
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Cross-chain bridge with 5-of-9 guardian multi-sig validation</p>
      </div>

      <div className="flex items-center justify-center gap-4 text-[10px] font-mono">
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neon-green/10 text-neon-green rounded-full">
          <Users className="w-3 h-3" /> {onlineGuardians}/9 Guardians Online
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-neon-cyan/10 text-neon-cyan rounded-full">
          <Shield className="w-3 h-3" /> 5-of-9 Multi-Sig
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full">
          {isLockMint ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />} {mechanism}
        </span>
      </div>

      {!isConnected && (
        <div className="cosmic-card cosmic-card-magenta p-5 text-center space-y-4">
          <Lock className="w-8 h-8 text-neon-orange mx-auto" />
          <p className="text-sm font-heading">External Wallet Required for Bridging</p>
          <p className="text-xs text-muted-foreground">
            {isMobileDevice()
              ? "Connect your MetaMask or Phantom mobile wallet to sign bridge transactions. Your SKYNT wallet verifies identity, but bridging requires an external wallet."
              : "Connect MetaMask or Phantom to sign bridge transactions. Your SKYNT wallet verifies identity, but bridging requires an external wallet to authorize transfers."}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              data-testid="button-bridge-connect-metamask"
              onClick={() => {
                if (isMobileDevice()) { openWalletApp("metamask"); return; }
                connect("metamask");
              }}
              disabled={isConnecting}
              className="px-5 py-2.5 rounded-sm font-heading text-xs tracking-wider flex items-center gap-2 border border-[#E2761B]/40 bg-[#E2761B]/10 text-[#E2761B] hover:bg-[#E2761B]/20 transition-colors"
            >
              🦊 {isMobileDevice() ? "Open MetaMask" : "MetaMask"}
            </button>
            <button
              data-testid="button-bridge-connect-phantom"
              onClick={() => {
                if (isMobileDevice()) { openWalletApp("phantom"); return; }
                connect("phantom");
              }}
              disabled={isConnecting}
              className="px-5 py-2.5 rounded-sm font-heading text-xs tracking-wider flex items-center gap-2 border border-[#AB9FF2]/40 bg-[#AB9FF2]/10 text-[#AB9FF2] hover:bg-[#AB9FF2]/20 transition-colors"
            >
              👻 {isMobileDevice() ? "Open Phantom" : "Phantom"}
            </button>
          </div>
          {isMobileDevice() && (
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/60 justify-center">
              <Smartphone className="w-3 h-3" /> Opens wallet app for transaction signing
            </div>
          )}
        </div>
      )}

      {isConnected && (
        <div className="cosmic-card p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" style={{ boxShadow: "0 0 6px hsl(145 100% 50% / 0.6)" }} />
            <span className="font-mono text-[11px] text-foreground">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}</span>
          </div>
        </div>
      )}

      {bridgeSuccess && (
        <div className="cosmic-card cosmic-card-green p-4 text-center space-y-2 animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-neon-green mx-auto" />
          <p className="text-sm font-heading text-neon-green">Bridge Transaction Submitted</p>
          <p className="text-xs text-muted-foreground">Awaiting {isLockMint ? "guardian minting" : "guardian release"} (5/5 signatures required).</p>
        </div>
      )}

      <div className={`cosmic-card cosmic-card-cyan p-6 space-y-6 ${!isConnected ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="flex items-center justify-between">
          <span className="stat-label">Bridge SKYNT Token</span>
          <span className="font-mono text-[10px] text-primary px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full">{mechanism}</span>
        </div>

        <div className="space-y-2">
          <label className="stat-label">From Network</label>
          <div className="relative">
            <button
              data-testid="button-source-chain"
              onClick={() => { setShowSourceDropdown(!showSourceDropdown); setShowDestDropdown(false); }}
              className="w-full flex items-center justify-between p-3 bg-black/40 border border-border rounded-sm hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{source.icon}</span>
                <div className="text-left">
                  <div className="text-sm font-heading">{source.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{source.symbol}</div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {showSourceDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-sm shadow-lg">
                {chains.filter((c) => c.id !== destChain).map((chain) => (
                  <button key={chain.id} data-testid={`option-source-${chain.id}`} onClick={() => { setSourceChain(chain.id); setShowSourceDropdown(false); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
                    <span className="text-lg">{chain.icon}</span><span className="text-sm">{chain.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <button data-testid="button-swap-chains" onClick={swapChains}
            className="p-2 rounded-full border border-border bg-black/40 hover:bg-primary/10 hover:border-primary/40 transition-all">
            <ArrowDownUp className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="stat-label">To Network</label>
          <div className="relative">
            <button
              data-testid="button-dest-chain"
              onClick={() => { setShowDestDropdown(!showDestDropdown); setShowSourceDropdown(false); }}
              className="w-full flex items-center justify-between p-3 bg-black/40 border border-border rounded-sm hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{dest.icon}</span>
                <div className="text-left">
                  <div className="text-sm font-heading">{dest.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{dest.symbol}</div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {showDestDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-sm shadow-lg">
                {chains.filter((c) => c.id !== sourceChain).map((chain) => (
                  <button key={chain.id} data-testid={`option-dest-${chain.id}`} onClick={() => { setDestChain(chain.id); setShowDestDropdown(false); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
                    <span className="text-lg">{chain.icon}</span><span className="text-sm">{chain.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="stat-label">Amount (SKYNT)</label>
          <div className="relative">
            <input data-testid="input-bridge-amount" type="number" placeholder="0.00" value={amount}
              onChange={(e) => { setAmount(e.target.value); validateAmount(e.target.value); }}
              className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-lg focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-heading">SKYNT</span>
          </div>
          {amountError && (
            <p className="text-[10px] font-mono text-red-400 mt-1" data-testid="error-bridge-amount">{amountError}</p>
          )}
        </div>

        <div className="space-y-2 p-3 bg-black/20 border border-border/50 rounded-sm">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> Bridge Fee (0.1%)</span>
            <span className="font-mono">{bridgeFee} SKYNT</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3" /> You Receive</span>
            <span className="font-mono text-neon-green">{netReceive} SKYNT</span>
          </div>
          {prices && amount && parseFloat(amount) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> USD Value</span>
              <span className="font-mono text-primary">${(parseFloat(netReceive) * prices.SKYNT.usd).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Est. Time</span>
            <span className="font-mono">{estimatedTime}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Required Sigs</span>
            <span className="font-mono">5 of 9 guardians</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Mechanism</span>
            <span className="font-mono text-neon-cyan">{mechanism}</span>
          </div>
        </div>

        <button data-testid="button-bridge-transfer" disabled={!amount || parseFloat(amount) <= 0 || !!amountError || bridgeMutation.isPending} onClick={handleBridge}
          className="connect-wallet-btn w-full py-3 rounded-sm font-heading text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
          <div className="flex items-center justify-center gap-2">
            {bridgeMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {isLockMint ? "Locking SKYNT..." : "Burning SKYNT..."}</>
            ) : (
              <><Wallet className="w-4 h-4" /> {amount ? `${isLockMint ? "Lock" : "Burn"} ${amount} SKYNT` : "Enter Amount"}</>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 justify-center">
          <AlertTriangle className="w-3 h-3" />
          <span>Bridge transfers are irreversible. Guardians must validate before release.</span>
        </div>
      </div>

      <div className="cosmic-card p-4">
        <h3 className="font-heading text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Guardian Network (9 Validators)
        </h3>
        {guardiansLoading ? (
          <div className="flex items-center justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-9 gap-2">
            {guardiansList.map((g) => (
              <div key={g.guardianIndex} className="text-center" data-testid={`guardian-${g.guardianIndex}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto text-[10px] font-heading ${
                  g.status === "online" ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-red-400/40 bg-red-400/5 text-red-400/60"
                }`}>
                  {g.guardianIndex}
                </div>
                <p className={`text-[8px] mt-1 ${g.status === "online" ? "text-neon-green" : "text-red-400/60"}`}>{timeAgo(g.lastSignature)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cosmic-card cosmic-card-orange p-4">
        <h3 className="font-heading text-sm uppercase tracking-wider mb-4 flex items-center gap-2" data-testid="text-recent-bridges">
          <Clock className="w-4 h-4 text-neon-orange" /> Recent Bridge Transactions
        </h3>
        {txLoading ? (
          <div className="flex items-center justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-neon-orange" /></div>
        ) : bridgeTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No bridge transactions yet</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Sigs</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {bridgeTransactions.map((bridge) => (
                <tr key={bridge.id} data-testid={`row-bridge-${bridge.id}`}>
                  <td>
                    <span className="text-primary">{bridge.fromChain}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className="text-neon-green">{bridge.toChain}</span>
                  </td>
                  <td>{bridge.amount} {bridge.token}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-heading uppercase ${
                      bridge.status === "Released" || bridge.status === "Minted" ? "bg-neon-green/10 text-neon-green"
                      : bridge.status === "Locked" || bridge.status === "Burned" ? "bg-neon-orange/10 text-neon-orange"
                      : "bg-neon-cyan/10 text-neon-cyan"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        bridge.status === "Released" || bridge.status === "Minted" ? "bg-neon-green"
                        : "bg-neon-orange animate-pulse"
                      }`} />
                      {bridge.status}
                    </span>
                  </td>
                  <td className="font-mono">{bridge.signatures}</td>
                  <td className="text-muted-foreground">{timeAgo(bridge.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="cosmic-card p-4">
        <h3 className="font-heading text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
          <Fingerprint className="w-3.5 h-3.5 text-primary" /> Contract Details
        </h3>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">Contract</span><span className="text-primary">SphinxBridge.sol</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Solidity</span><span>^0.8.0</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Guardians</span><span>9 (5 required)</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span>0.1% (1/1000 basis)</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Mechanism</span><span>Lock/Mint + Burn/Release</span></div>
        </div>
      </div>
    </div>
  );
}
