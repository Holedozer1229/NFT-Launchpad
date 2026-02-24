import { useState, useEffect } from "react";
import { TrendingUp, Lock, Unlock, Wallet, Coins, Percent, Clock, Zap, Shield, Gift, ArrowRight, ChevronDown } from "lucide-react";
import { useWallet } from "@/lib/mock-web3";

const POOLS = [
  {
    id: "skynt-eth",
    name: "SKYNT / ETH",
    apy: 42.8,
    tvl: "2,450,000",
    staked: "1,200",
    lockPeriod: "Flexible",
    color: "cyan",
    risk: "Low",
    rewards: "SKYNT",
    minStake: 100,
  },
  {
    id: "skynt-sol",
    name: "SKYNT / SOL",
    apy: 68.5,
    tvl: "1,180,000",
    staked: "800",
    lockPeriod: "30 Days",
    color: "green",
    risk: "Medium",
    rewards: "SKYNT + SOL",
    minStake: 250,
  },
  {
    id: "skynt-matic",
    name: "SKYNT / MATIC",
    apy: 95.2,
    tvl: "620,000",
    staked: "0",
    lockPeriod: "90 Days",
    color: "orange",
    risk: "High",
    rewards: "SKYNT + MATIC",
    minStake: 500,
  },
  {
    id: "skynt-single",
    name: "SKYNT Single Stake",
    apy: 24.6,
    tvl: "5,800,000",
    staked: "3,500",
    lockPeriod: "Flexible",
    color: "magenta",
    risk: "Low",
    rewards: "SKYNT",
    minStake: 50,
  },
];

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

export default function YieldGenerator() {
  const { isConnected, address, connect, isConnecting } = useWallet();
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [staking, setStaking] = useState(false);
  const [stakeSuccess, setStakeSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");
  const [earnedRewards, setEarnedRewards] = useState(12.847);

  useEffect(() => {
    const interval = setInterval(() => {
      setEarnedRewards((prev) => prev + Math.random() * 0.002);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const skyntBalance = "10,000";
  const totalStaked = POOLS.reduce((sum, p) => sum + parseFloat(p.staked.replace(/,/g, "")), 0);

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

  const pool = selectedPool ? POOLS.find((p) => p.id === selectedPool) : null;

  const colorClass = (c: string) => ({
    cyan: { text: "text-neon-cyan", bg: "bg-neon-cyan/10", border: "cosmic-card-cyan", glow: "neon-glow-cyan" },
    green: { text: "text-neon-green", bg: "bg-neon-green/10", border: "cosmic-card-green", glow: "neon-glow-green" },
    orange: { text: "text-neon-orange", bg: "bg-neon-orange/10", border: "cosmic-card-orange", glow: "neon-glow-orange" },
    magenta: { text: "text-neon-magenta", bg: "bg-neon-magenta/10", border: "cosmic-card-magenta", glow: "neon-glow-magenta" },
  }[c] || { text: "text-primary", bg: "bg-primary/10", border: "cosmic-card", glow: "" });

  return (
    <div className="space-y-6" data-testid="yield-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan flex items-center gap-2" data-testid="text-yield-title">
            <TrendingUp className="w-6 h-6" /> SKYNT Yield Generator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Stake SKYNT tokens to earn passive rewards</p>
        </div>
      </div>

      {!isConnected && (
        <div className="cosmic-card cosmic-card-magenta p-6 text-center space-y-3">
          <Wallet className="w-10 h-10 text-neon-magenta mx-auto" />
          <p className="text-sm font-heading">Connect MetaMask to Start Earning</p>
          <p className="text-xs text-muted-foreground">Link your wallet to stake SKYNT and generate yield.</p>
          <button
            data-testid="button-yield-connect"
            onClick={connect}
            disabled={isConnecting}
            className="connect-wallet-btn px-6 py-2.5 rounded-sm font-heading text-sm tracking-wider mx-auto"
          >
            {isConnecting ? "Connecting..." : "Connect MetaMask"}
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
            <div className="cosmic-card cosmic-card-orange p-4" data-testid="stat-avg-apy">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-neon-orange" />
                <span className="stat-label">Avg. APY</span>
              </div>
              <p className="text-lg font-heading text-neon-orange"><AnimatedCounter target={57.8} />%</p>
            </div>
            <div className="cosmic-card cosmic-card-magenta p-4" data-testid="stat-wallet-balance">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-neon-magenta" />
                <span className="stat-label">Wallet Balance</span>
              </div>
              <p className="text-lg font-heading text-neon-magenta">{skyntBalance} SKYNT</p>
              <p className="font-mono text-[10px] text-muted-foreground mt-1 truncate">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Yield Pools
              </h2>
              {POOLS.map((p) => {
                const cc = colorClass(p.color);
                const isSelected = selectedPool === p.id;
                return (
                  <button
                    key={p.id}
                    data-testid={`pool-${p.id}`}
                    onClick={() => setSelectedPool(p.id)}
                    className={`cosmic-card ${cc.border} p-4 w-full text-left transition-all ${isSelected ? "ring-1 ring-primary/60 scale-[1.01]" : "hover:scale-[1.005]"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-heading text-sm">{p.name}</span>
                      <span className={`${cc.text} ${cc.bg} px-2 py-0.5 rounded-full text-[10px] font-heading uppercase`}>{p.risk} Risk</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">APY</p>
                        <p className={`font-heading text-sm ${cc.text}`}>{p.apy}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">TVL</p>
                        <p className="font-mono text-xs">${p.tvl}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Lock</p>
                        <p className="font-mono text-xs flex items-center gap-1">
                          {p.lockPeriod === "Flexible" ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {p.lockPeriod}
                        </p>
                      </div>
                    </div>
                    {parseFloat(p.staked.replace(/,/g, "")) > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/30 flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground">Your Stake</span>
                        <span className="font-mono text-xs text-primary">{p.staked} SKYNT</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {pool ? (
                <>
                  <h2 className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-primary" /> {pool.name}
                  </h2>

                  {stakeSuccess && (
                    <div className="cosmic-card cosmic-card-green p-4 text-center space-y-1">
                      <p className="text-sm font-heading text-neon-green">Stake Successful</p>
                      <p className="text-xs text-muted-foreground">Your SKYNT tokens are now generating yield.</p>
                    </div>
                  )}

                  <div className={`cosmic-card ${colorClass(pool.color).border} p-5 space-y-5`}>
                    <div className="flex gap-2">
                      <button
                        data-testid="tab-stake"
                        onClick={() => setActiveTab("stake")}
                        className={`flex-1 py-2 rounded-sm text-xs font-heading uppercase tracking-wider transition-all ${
                          activeTab === "stake" ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/20 text-muted-foreground border border-border/30"
                        }`}
                      >
                        Stake
                      </button>
                      <button
                        data-testid="tab-unstake"
                        onClick={() => setActiveTab("unstake")}
                        className={`flex-1 py-2 rounded-sm text-xs font-heading uppercase tracking-wider transition-all ${
                          activeTab === "unstake" ? "bg-primary/20 text-primary border border-primary/40" : "bg-black/20 text-muted-foreground border border-border/30"
                        }`}
                      >
                        Unstake
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="stat-label">{activeTab === "stake" ? "Stake Amount" : "Unstake Amount"} (SKYNT)</label>
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
                        <span>{activeTab === "stake" ? `Balance: ${skyntBalance}` : `Staked: ${pool.staked}`} SKYNT</span>
                        <button
                          data-testid="button-max-stake"
                          onClick={() => setStakeAmount(activeTab === "stake" ? "10000" : pool.staked.replace(/,/g, ""))}
                          className="text-primary hover:text-primary/80"
                        >
                          MAX
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 p-3 bg-black/20 border border-border/50 rounded-sm text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Percent className="w-3 h-3" /> APY</span>
                        <span className={`font-mono ${colorClass(pool.color).text}`}>{pool.apy}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Lock Period</span>
                        <span className="font-mono">{pool.lockPeriod}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Gift className="w-3 h-3" /> Rewards</span>
                        <span className="font-mono">{pool.rewards}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Coins className="w-3 h-3" /> Min Stake</span>
                        <span className="font-mono">{pool.minStake} SKYNT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Security</span>
                        <span className="font-mono text-neon-green">Audited</span>
                      </div>
                      {stakeAmount && parseFloat(stakeAmount) > 0 && (
                        <div className="flex justify-between pt-2 border-t border-border/30">
                          <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Est. Daily Yield</span>
                          <span className="font-mono text-neon-green">
                            {((parseFloat(stakeAmount) * pool.apy) / 365 / 100).toFixed(4)} SKYNT
                          </span>
                        </div>
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
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {activeTab === "stake" ? "Staking..." : "Unstaking..."}
                          </>
                        ) : (
                          <>
                            {activeTab === "stake" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {stakeAmount && parseFloat(stakeAmount) > 0
                              ? `${activeTab === "stake" ? "Stake" : "Unstake"} ${stakeAmount} SKYNT`
                              : "Enter Amount"}
                          </>
                        )}
                      </div>
                    </button>
                  </div>

                  <div className={`cosmic-card ${colorClass(pool.color).border} p-4`}>
                    <h3 className="font-heading text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> Projected Returns
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "30 Days", multiplier: 30 },
                        { label: "90 Days", multiplier: 90 },
                        { label: "1 Year", multiplier: 365 },
                      ].map((period) => {
                        const base = parseFloat(stakeAmount || pool.staked.replace(/,/g, "") || "1000");
                        const earned = (base * pool.apy * period.multiplier) / 365 / 100;
                        return (
                          <div key={period.label} className="p-3 bg-black/30 border border-border/30 rounded-sm text-center">
                            <p className="text-[10px] text-muted-foreground">{period.label}</p>
                            <p className={`font-mono text-sm ${colorClass(pool.color).text} mt-1`}>+{earned.toFixed(2)}</p>
                            <p className="text-[9px] text-muted-foreground">SKYNT</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="cosmic-card p-8 text-center space-y-3 min-h-[300px] flex flex-col items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-muted-foreground/30" />
                  <p className="font-heading text-sm text-muted-foreground">Select a Pool</p>
                  <p className="text-xs text-muted-foreground/60">Choose a yield pool from the left to stake your SKYNT tokens.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
