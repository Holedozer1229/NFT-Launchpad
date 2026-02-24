import { useState, useEffect } from "react";
import { Wallet, Send, ArrowDownLeft, Copy, Plus, RefreshCw, CheckCircle, ExternalLink, Coins, Clock, Shield, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
  createdAt: string;
}

const TOKEN_OPTIONS = [
  { symbol: "SKYNT", label: "SKYNT Token", color: "cyan", icon: "🦁" },
  { symbol: "STX", label: "Stacks", color: "orange", icon: "⟐" },
  { symbol: "ETH", label: "Ethereum", color: "magenta", icon: "⟠" },
];

export default function WalletPage() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<SphinxWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<SphinxWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "send" | "receive">("overview");
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendToken, setSendToken] = useState("SKYNT");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchWallets = async () => {
    try {
      const res = await fetch("/api/wallet/list", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWallets(data);
        if (data.length > 0 && !activeWallet) {
          setActiveWallet(data[0]);
          fetchTransactions(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch wallets", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (walletId: number) => {
    try {
      const res = await fetch(`/api/wallet/${walletId}/transactions`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const handleSelectWallet = (w: SphinxWallet) => {
    setActiveWallet(w);
    fetchTransactions(w.id);
    setTab("overview");
  };

  const handleCreateWallet = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/wallet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: `Wallet ${wallets.length + 1}` }),
      });
      if (res.ok) {
        const newWallet = await res.json();
        setWallets((prev) => [...prev, newWallet]);
        setActiveWallet(newWallet);
        setTransactions([]);
      }
    } catch (err) {
      console.error("Failed to create wallet", err);
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async () => {
    if (!activeWallet || !sendTo || !sendAmount || parseFloat(sendAmount) <= 0) return;
    setSending(true);
    setSendError("");
    setSendSuccess(false);
    try {
      const res = await fetch(`/api/wallet/${activeWallet.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toAddress: sendTo, amount: sendAmount, token: sendToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendSuccess(true);
        setSendTo("");
        setSendAmount("");
        fetchWallets();
        fetchTransactions(activeWallet.id);
        setTimeout(() => setSendSuccess(false), 4000);
      } else {
        setSendError(data.message || "Transaction failed");
      }
    } catch (err) {
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
    ? getBalance(activeWallet, "SKYNT") * 0.45 + getBalance(activeWallet, "STX") * 1.85 + getBalance(activeWallet, "ETH") * 3200
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan flex items-center gap-2" data-testid="text-wallet-title">
            <Wallet className="w-6 h-6" /> SphinxOS Wallet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your in-app crypto wallet — manage SKYNT, STX, and ETH</p>
        </div>
        <button
          data-testid="button-create-wallet"
          onClick={handleCreateWallet}
          disabled={creating}
          className="connect-wallet-btn px-4 py-2 rounded-sm font-heading text-xs tracking-wider flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> {creating ? "Creating..." : "New Wallet"}
        </button>
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

            <div className="grid grid-cols-3 gap-4 mt-4">
              {TOKEN_OPTIONS.map((t) => {
                const bal = getBalance(activeWallet, t.symbol);
                return (
                  <div key={t.symbol} className="text-center p-3 bg-black/30 border border-border/30 rounded-sm" data-testid={`balance-${t.symbol}`}>
                    <span className="text-lg">{t.icon}</span>
                    <p className={`font-heading text-sm mt-1 text-neon-${t.color}`}>{bal.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{t.symbol}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            {(["overview", "send", "receive"] as const).map((t) => (
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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === "send" ? "bg-red-500/10 text-red-400" : "bg-neon-green/10 text-neon-green"
                        }`}>
                          {tx.type === "send" ? <Send className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="font-heading text-xs uppercase">{tx.type === "send" ? "Sent" : "Received"} {tx.token}</p>
                          <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
                            {tx.type === "send" ? `To: ${tx.toAddress?.slice(0, 10)}...` : `From: ${tx.fromAddress?.slice(0, 10)}...`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-xs ${tx.type === "send" ? "text-red-400" : "text-neon-green"}`}>
                          {tx.type === "send" ? "-" : "+"}{tx.amount} {tx.token}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                        </p>
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

              {sendSuccess && (
                <div className="p-3 bg-neon-green/10 border border-neon-green/30 rounded-sm text-center space-y-1">
                  <CheckCircle className="w-5 h-5 text-neon-green mx-auto" />
                  <p className="text-xs font-heading text-neon-green">Transaction Sent</p>
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
                      onClick={() => setSendToken(t.symbol)}
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
                  placeholder="0x..."
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-sm focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40"
                />
              </div>

              <div className="space-y-2">
                <label className="stat-label">Amount</label>
                <div className="relative">
                  <input
                    data-testid="input-send-amount"
                    type="number"
                    placeholder="0.00"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-lg focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-heading">{sendToken}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
                  <span>Balance: {getBalance(activeWallet, sendToken).toLocaleString()} {sendToken}</span>
                  <button
                    data-testid="button-send-max"
                    onClick={() => setSendAmount(getBalance(activeWallet, sendToken).toString())}
                    className="text-primary hover:text-primary/80"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <button
                data-testid="button-send-tx"
                disabled={!sendTo || !sendAmount || parseFloat(sendAmount) <= 0 || sending}
                onClick={handleSend}
                className="connect-wallet-btn w-full py-3 rounded-sm font-heading text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="flex items-center justify-center gap-2">
                  {sending ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-4 h-4" /> {sendAmount ? `Send ${sendAmount} ${sendToken}` : "Enter Amount"}</>
                  )}
                </div>
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
                        <div key={i} className={`w-4 h-4 ${Math.random() > 0.4 ? "bg-white" : "bg-transparent"}`} />
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

      {wallets.length === 0 && !loading && (
        <div className="cosmic-card p-8 text-center space-y-4">
          <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="font-heading text-sm text-muted-foreground">No Wallet Found</p>
          <p className="text-xs text-muted-foreground/60">Create your first SphinxOS wallet to start managing tokens.</p>
          <button
            data-testid="button-create-first-wallet"
            onClick={handleCreateWallet}
            className="connect-wallet-btn px-6 py-2.5 rounded-sm font-heading text-sm tracking-wider mx-auto"
          >
            Create Wallet
          </button>
        </div>
      )}
    </div>
  );
}
