import { useState } from "react";
import { ArrowDownUp, Wallet, Shield, Clock, AlertTriangle, ChevronDown, Zap } from "lucide-react";

const chains = [
  { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "⟠", color: "hsl(210 100% 55%)" },
  { id: "solana", name: "Solana", symbol: "SOL", icon: "◎", color: "hsl(280 100% 60%)" },
  { id: "polygon", name: "Polygon", symbol: "MATIC", icon: "⬡", color: "hsl(300 100% 60%)" },
  { id: "arbitrum", name: "Arbitrum", symbol: "ARB", icon: "🔷", color: "hsl(210 100% 55%)" },
  { id: "base", name: "Base", symbol: "BASE", icon: "🔵", color: "hsl(210 100% 55%)" },
];

const recentBridges = [
  { from: "Ethereum", to: "Solana", amount: "2.5 ETH", status: "completed", time: "12 min ago" },
  { from: "Polygon", to: "Ethereum", amount: "1,200 MATIC", status: "completed", time: "34 min ago" },
  { from: "Solana", to: "Arbitrum", amount: "45.2 SOL", status: "pending", time: "2 min ago" },
  { from: "Base", to: "Ethereum", amount: "0.8 ETH", status: "completed", time: "1h ago" },
];

export default function Bridge() {
  const [sourceChain, setSourceChain] = useState("ethereum");
  const [destChain, setDestChain] = useState("solana");
  const [amount, setAmount] = useState("");
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  const source = chains.find((c) => c.id === sourceChain)!;
  const dest = chains.find((c) => c.id === destChain)!;

  const swapChains = () => {
    setSourceChain(destChain);
    setDestChain(sourceChain);
  };

  const estimatedFee = amount ? (parseFloat(amount) * 0.003).toFixed(4) : "0.0000";
  const estimatedTime = sourceChain === "ethereum" ? "~15 min" : "~5 min";

  return (
    <div className="space-y-6 max-w-2xl mx-auto" data-testid="bridge-page">
      <div className="text-center">
        <h1 className="text-2xl font-heading neon-glow-cyan" data-testid="text-bridge-title">Cross-Chain Bridge</h1>
        <p className="text-sm text-muted-foreground mt-1">Transfer assets across networks securely</p>
      </div>

      <div className="cosmic-card cosmic-card-cyan p-6 space-y-6">
        <div className="space-y-2">
          <label className="stat-label">From</label>
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
                  <button
                    key={chain.id}
                    data-testid={`option-source-${chain.id}`}
                    onClick={() => { setSourceChain(chain.id); setShowSourceDropdown(false); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-lg">{chain.icon}</span>
                    <span className="text-sm">{chain.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            data-testid="button-swap-chains"
            onClick={swapChains}
            className="p-2 rounded-full border border-border bg-black/40 hover:bg-primary/10 hover:border-primary/40 transition-all"
          >
            <ArrowDownUp className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="stat-label">To</label>
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
                  <button
                    key={chain.id}
                    data-testid={`option-dest-${chain.id}`}
                    onClick={() => { setDestChain(chain.id); setShowDestDropdown(false); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-lg">{chain.icon}</span>
                    <span className="text-sm">{chain.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="stat-label">Amount</label>
          <div className="relative">
            <input
              data-testid="input-bridge-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-lg focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-heading">
              {source.symbol}
            </span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
            <span>Balance: 12.458 {source.symbol}</span>
            <button
              data-testid="button-max-amount"
              onClick={() => setAmount("12.458")}
              className="text-primary hover:text-primary/80"
            >
              MAX
            </button>
          </div>
        </div>

        <div className="space-y-2 p-3 bg-black/20 border border-border/50 rounded-sm">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> Bridge Fee</span>
            <span className="font-mono">{estimatedFee} {source.symbol}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Est. Time</span>
            <span className="font-mono">{estimatedTime}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Security</span>
            <span className="font-mono text-neon-green">ZK-Verified</span>
          </div>
        </div>

        <button
          data-testid="button-bridge-transfer"
          disabled={!amount || parseFloat(amount) <= 0}
          className="connect-wallet-btn w-full py-3 rounded-sm font-heading text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
        >
          <div className="flex items-center justify-center gap-2">
            <Wallet className="w-4 h-4" />
            {amount ? `Bridge ${amount} ${source.symbol}` : "Enter Amount"}
          </div>
        </button>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 justify-center">
          <AlertTriangle className="w-3 h-3" />
          <span>Bridge transfers are irreversible. Double-check destination chain.</span>
        </div>
      </div>

      <div className="cosmic-card cosmic-card-orange p-4">
        <h3 className="font-heading text-sm uppercase tracking-wider mb-4 flex items-center gap-2" data-testid="text-recent-bridges">
          <Clock className="w-4 h-4 text-neon-orange" /> Recent Bridges
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recentBridges.map((bridge, i) => (
              <tr key={i} data-testid={`row-bridge-${i}`}>
                <td>
                  <span className="text-primary">{bridge.from}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="text-neon-green">{bridge.to}</span>
                </td>
                <td>{bridge.amount}</td>
                <td>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-heading uppercase ${
                    bridge.status === "completed"
                      ? "bg-neon-green/10 text-neon-green"
                      : "bg-neon-orange/10 text-neon-orange"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      bridge.status === "completed" ? "bg-neon-green" : "bg-neon-orange animate-pulse"
                    }`} />
                    {bridge.status}
                  </span>
                </td>
                <td className="text-muted-foreground">{bridge.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
