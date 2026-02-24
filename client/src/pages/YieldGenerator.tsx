import { useState, useEffect } from "react";
import { TrendingUp, Lock, Unlock, Wallet, Coins, Percent, Clock, Zap, Shield, Gift, ArrowRight, Activity, CheckCircle, Fingerprint, Gauge, Loader2 } from "lucide-react";
import { useWallet } from "@/lib/mock-web3";
import { useQuery } from "@tanstack/react-query";

interface StrategyData {
  id: number;
  strategyId: string;
  name: string;
  contract: string;
  apr: string;
  riskScore: number;
  tvl: string;
  totalStaked: string;
  color: string;
  active: boolean;
  description: string;
}

interface WalletData {
  id: number;
  balanceSkynt: string;
  balanceStx: string;
  balanceEth: string;
  address: string;
}

function AnimatedCounter({ target, decimals = 2 }: { target: number; decimals?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target]);
  return <>{value.toFixed(decimals)}</>;
}

function calculatePhiBoost(phi: number): number {
  const clamped = Math.max(200, Math.min(1000, phi));
  return (10000 + (clamped - 500) * 5) / 10000;
}

function calculateTreasuryRate(phi: number): number {
  const rate = 0.05 + phi / 2000;
  return Math.min(0.30, rate);
}

export default function YieldGenerator() {
  const { isConnected, address, connect, isConnecting } = useWallet();
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [staking, setStaking] = useState(false);
  const [stakeSuccess, setStakeSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");
  const [earnedRewards, setEarnedRewards] = useState(0);
  const [phiScore, setPhiScore] = useState(650);
  const [zkVerified, setZkVerified] = useState(true);

  const { data: strategies = [], isLoading: strategiesLoading } = useQuery<StrategyData[]>({
    queryKey: ["/api/yield/strategies"],
  });

  const { data: wallets = [] } = useQuery<WalletData[]>({
    queryKey: ["/api/wallet/list"],
    enabled: isConnected,
  });

  const primaryWallet = wallets[0];
  const skyntBalance = primaryWallet?.balanceSkynt || "0";

  useEffect(() => {
    const interval = setInterval(() => {
      setEarnedRewards((prev) => prev + Math.random() * 0.002);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const totalStaked = strategies.reduce((sum, s) => sum + parseFloat(s.totalStaked || "0"), 0);
  const phiBoost = calculatePhiBoost(phiScore);
  const treasuryRate = calculateTreasuryRate(phiScore);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    setStaking(true);
    setStakeSuccess(false);
    await new Promise((r) => setTimeout(r, 2000));
    setStaking(false);
    setStakeSuccess(true);
    setStakeAmount("");
    setTimeout(() => setStakeSuccess(false), 4000);
  };

  const strategy = selectedStrategy ? strategies.find((s) => s.strategyId === selectedStrategy) : null;

  const colorClass = (c: string) => ({
    cyan: { text: "text-neon-cyan", bg: "bg-neon-cyan/10", border: "cosmic-card-cyan" },
    green: { text: "text-neon-green", bg: "bg-neon-green/10", border: "cosmic-card-green" },
    orange: { text: "text-neon-orange", bg: "bg-neon-orange/10", border: "cosmic-card-orange" },
    magenta: { text: "text-neon-magenta", bg: "bg-neon-magenta/10", border: "cosmic-card-magenta" },
  }[c] || { text: "text-primary", bg: "bg-primary/10", border: "cosmic-card" });

  return (
    <div className="space-y-6" data-testid="yield-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan flex items-center gap-2" data-testid="text-yield-title">
            <TrendingUp className="w-6 h-6" /> SKYNT Yield Generator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">SphinxYieldAggregator — zk-verified multi-chain yield optimization</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-heading uppercase ${zkVerified ? "bg-neon-green/10 text-neon-green" : "bg-red-500/10 text-red-400"}`}>
            <Fingerprint className="w-3 h-3" />
            zk-Proof {zkVerified ? "Verified" : "Pending"}
          </span>
        </div>
      </div>

      {!isConnected && (
        <div className="cosmic-card cosmic-card-magenta p-6 text-center space-y-3">
          <Wallet className="w-10 h-10 text-neon-magenta mx-auto" />
          <p className="text-sm font-heading">Connect Wallet to Start Earning</p>
          <p className="text-xs text-muted-foreground">Link your wallet to stake SKYNT and generate yield via the SphinxYieldAggregator.</p>
          <button
            data-testid="button-yield-connect"
            onClick={() => connect()}
            disabled={isConnecting}
            className="connect-wallet-btn px-6 py-2.5 rounded-sm font-heading text-sm tracking-wider mx-auto"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="cosmic-card cosmic-card-cyan p-4" data-testid="stat-total-staked">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-neon-cyan" />
                <span className="stat-label">Total Staked</span>
              </div>
              <p className="text-lg font-heading text-neon-cyan"><AnimatedCounter target={totalStaked} decimals={0} /> SKYNT</p>
            </div>
            <div className="cosmic-card cosmic-card-green p-4" data-testid="stat-earned">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-4 h-4 text-neon-green" />
                <span className="stat-label">Earned Rewards</span>
              </div>
              <p className="text-lg font-heading text-neon-green">{earnedRewards.toFixed(3)} SKYNT</p>
            </div>
            <div className="cosmic-card cosmic-card-orange p-4" data-testid="stat-phi-boost">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-neon-orange" />
                <span className="stat-label">Phi Boost</span>
              </div>
              <p className="text-lg font-heading text-neon-orange">{phiBoost.toFixed(2)}x</p>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5">Score: {phiScore}</p>
            </div>
            <div className="cosmic-card cosmic-card-magenta p-4" data-testid="stat-wallet-balance">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-neon-magenta" />
                <span className="stat-label">Wallet</span>
              </div>
              <p className="text-lg font-heading text-neon-magenta">{parseFloat(skyntBalance).toLocaleString()} SKYNT</p>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5 truncate">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}</p>
            </div>
          </div>

          <div className="cosmic-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-xs uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary" /> Phi Score (200-1000)
              </h3>
              <span className="font-mono text-xs text-primary">{phiScore}</span>
            </div>
            <input
              data-testid="input-phi-score"
              type="range"
              min="200"
              max="1000"
              value={phiScore}
              onChange={(e) => setPhiScore(parseInt(e.target.value))}
              className="w-full accent-primary h-1.5"
            />
            <div className="flex justify-between mt-2 text-[10px] font-mono text-muted-foreground">
              <span>Boost: {phiBoost.toFixed(2)}x</span>
              <span>Treasury: {(treasuryRate * 100).toFixed(1)}%</span>
              <span>R_T = min(0.30, 0.05 + Phi/2000)</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Yield Strategies
              </h2>
              {strategiesLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : strategies.map((s) => {
                const cc = colorClass(s.color);
                const isSelected = selectedStrategy === s.strategyId;
                const riskLabel = s.riskScore <= 25 ? "Low" : s.riskScore <= 50 ? "Medium" : "High";
                const apr = parseFloat(s.apr);
                return (
                  <button
                    key={s.strategyId}
                    data-testid={`strategy-${s.strategyId}`}
                    onClick={() => setSelectedStrategy(s.strategyId)}
                    className={`cosmic-card ${cc.border} p-4 w-full text-left transition-all ${isSelected ? "ring-1 ring-primary/60 scale-[1.01]" : "hover:scale-[1.005]"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-heading text-sm">{s.name}</span>
                      <span className={`${cc.text} ${cc.bg} px-2 py-0.5 rounded-full text-[10px] font-heading uppercase`}>{riskLabel} Risk</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">{s.description}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">APR</p>
                        <p className={`font-heading text-sm ${cc.text}`}>{apr}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">TVL</p>
                        <p className="font-mono text-xs">${parseInt(s.tvl).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Risk Score</p>
                        <p className="font-mono text-xs">{s.riskScore}/100</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/30 flex justify-between items-center">
                      <span className="font-mono text-[10px] text-muted-foreground truncate">{s.contract}</span>
                      {parseFloat(s.totalStaked) > 0 && (
                        <span className="font-mono text-xs text-primary">{parseFloat(s.totalStaked).toLocaleString()} SKYNT</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {strategy ? (
                <>
                  <h2 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-primary" /> {strategy.name}
                  </h2>

                  {stakeSuccess && (
                    <div className="cosmic-card cosmic-card-green p-4 text-center space-y-1">
                      <CheckCircle className="w-5 h-5 text-neon-green mx-auto" />
                      <p className="text-sm font-heading text-neon-green">Transaction Submitted</p>
                      <p className="text-xs text-muted-foreground">Your SKYNT tokens are now generating yield with {phiBoost.toFixed(2)}x Phi boost.</p>
                    </div>
                  )}

                  <div className={`cosmic-card ${colorClass(strategy.color).border} p-5 space-y-5`}>
                    <div className="flex gap-2">
                      <button
                        data-testid="tab-stake"
                        onClick={() => setActiveTab("stake")}
                        className={`flex-1 py-2 rounded-sm text-xs font-heading uppercase tracking-wider transition-all ${activeTab === "stake" ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/20 text-muted-foreground border border-border/30"}`}
                      >
                        Deposit
                      </button>
                      <button
                        data-testid="tab-unstake"
                        onClick={() => setActiveTab("unstake")}
                        className={`flex-1 py-2 rounded-sm text-xs font-heading uppercase tracking-wider transition-all ${activeTab === "unstake" ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/20 text-muted-foreground border border-border/30"}`}
                      >
                        Withdraw
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="stat-label">{activeTab === "stake" ? "Deposit" : "Withdraw"} Amount (SKYNT)</label>
                      <div className="relative">
                        <input
                          data-testid="input-stake-amount"
                          type="number"
                          placeholder="0.00"
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                          className="w-full p-3 bg-black/40 border border-border rounded-sm font-mono text-lg focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/40"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-heading">SKYNT</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
                        <span>{activeTab === "stake" ? `Balance: ${parseFloat(skyntBalance).toLocaleString()}` : `Deposited: ${parseFloat(strategy.totalStaked).toLocaleString()}`} SKYNT</span>
                        <button
                          data-testid="button-max-stake"
                          onClick={() => setStakeAmount(activeTab === "stake" ? skyntBalance : strategy.totalStaked)}
                          className="text-primary hover:text-primary/80"
                        >
                          MAX
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 p-3 bg-black/20 border border-border/50 rounded-sm text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Percent className="w-3 h-3" /> Base APR</span>
                        <span className={`font-mono ${colorClass(strategy.color).text}`}>{strategy.apr}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Gauge className="w-3 h-3" /> Phi Boosted APR</span>
                        <span className="font-mono text-neon-green">{(parseFloat(strategy.apr) * phiBoost).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" /> Risk Score</span>
                        <span className="font-mono">{strategy.riskScore}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3" /> Treasury Split</span>
                        <span className="font-mono">{(treasuryRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Fingerprint className="w-3 h-3" /> zk-Proof</span>
                        <span className="font-mono text-neon-green">{zkVerified ? "Verified" : "Pending"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Cooldown</span>
                        <span className="font-mono">1 min</span>
                      </div>
                      {stakeAmount && parseFloat(stakeAmount) > 0 && (
                        <>
                          <div className="flex justify-between pt-2 border-t border-border/30">
                            <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Est. Daily Yield</span>
                            <span className="font-mono text-neon-green">
                              {((parseFloat(stakeAmount) * parseFloat(strategy.apr) * phiBoost) / 365 / 100).toFixed(4)} SKYNT
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><Gift className="w-3 h-3" /> Your Share</span>
                            <span className="font-mono text-neon-cyan">
                              {((parseFloat(stakeAmount) * parseFloat(strategy.apr) * phiBoost * (1 - treasuryRate)) / 365 / 100).toFixed(4)} SKYNT/day
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      data-testid="button-stake"
                      disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || staking}
                      onClick={handleStake}
                      className="connect-wallet-btn w-full py-3 rounded-sm font-heading text-sm tracking-wider disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <div className="flex items-center justify-center gap-2">
                        {staking ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {activeTab === "stake" ? "Depositing..." : "Withdrawing..."}
                          </>
                        ) : (
                          <>
                            {activeTab === "stake" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {stakeAmount && parseFloat(stakeAmount) > 0
                              ? `${activeTab === "stake" ? "Deposit" : "Withdraw"} ${stakeAmount} SKYNT`
                              : "Enter Amount"}
                          </>
                        )}
                      </div>
                    </button>
                  </div>

                  <div className={`cosmic-card ${colorClass(strategy.color).border} p-4`}>
                    <h3 className="font-heading text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> Projected Returns (Phi-Boosted)
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "30 Days", days: 30 },
                        { label: "90 Days", days: 90 },
                        { label: "1 Year", days: 365 },
                      ].map((period) => {
                        const base = parseFloat(stakeAmount || strategy.totalStaked || "1000");
                        const grossYield = (base * parseFloat(strategy.apr) * phiBoost * period.days) / 365 / 100;
                        const netYield = grossYield * (1 - treasuryRate);
                        return (
                          <div key={period.label} className="p-3 bg-black/30 border border-border/30 rounded-sm text-center">
                            <p className="text-[10px] text-muted-foreground">{period.label}</p>
                            <p className={`font-mono text-sm ${colorClass(strategy.color).text} mt-1`}>+{netYield.toFixed(2)}</p>
                            <p className="text-[9px] text-muted-foreground">SKYNT (net)</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="cosmic-card p-4">
                    <h3 className="font-heading text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-primary" /> Contract Details
                    </h3>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between"><span className="text-muted-foreground">Contract</span><span className="text-primary">{strategy.contract}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Aggregator</span><span>SphinxYieldAggregator v1.0</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Solidity</span><span>^0.8.20</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Security</span><span className="text-neon-green">ReentrancyGuard + Pausable</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Access</span><span>AccessControl (RBAC)</span></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="cosmic-card p-8 text-center space-y-3 min-h-[300px] flex flex-col items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-muted-foreground/30" />
                  <p className="font-heading text-sm text-muted-foreground">Select a Strategy</p>
                  <p className="text-xs text-muted-foreground/60">Choose a yield strategy to deposit SKYNT tokens and start earning.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
