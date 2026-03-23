import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useEngineStream } from "@/hooks/use-engine-stream";
import {
  TrendingUp, TrendingDown, Flame, Zap, ArrowUpRight, Shield,
  RefreshCw, Play, Square, ExternalLink, CircleDollarSign,
  Activity, Target, Wallet, ChevronRight, AlertTriangle,
} from "lucide-react";

interface BuybackEvent {
  id: string;
  timestamp: number;
  ethSpent: number;
  skyntBought: number;
  skyntBurned: number;
  priceBeforeUsd: number;
  priceAfterUsd: number;
  priceImpactBps: number;
  txHashSwap: string | null;
  txHashBurn: string | null;
  poolFee: number;
  status: "success" | "failed" | "skipped";
  reason?: string;
}

interface PriceDriverState {
  running: boolean;
  configured: boolean;
  liveSkyntPriceEth: number;
  liveSkyntPriceUsd: number;
  targetPriceUsd: number;
  pricePressureMode: "aggressive" | "moderate" | "idle" | "target_reached";
  treasuryEthBalance: number;
  totalSkyntBought: number;
  totalSkyntBurned: number;
  totalEthSpent: number;
  epochCount: number;
  lastBuybackAt: number | null;
  nextBuybackAt: number | null;
  buybackHistory: BuybackEvent[];
  activeFee: number | null;
  currentEthPrice: number;
}

const MODE_META = {
  aggressive:     { label: "AGGRESSIVE",     color: "text-plasma-red",    bar: "bg-plasma-red",    badge: "bg-plasma-red/15 border-plasma-red/40 text-plasma-red" },
  moderate:       { label: "MODERATE",       color: "text-neon-orange",   bar: "bg-neon-orange",   badge: "bg-neon-orange/15 border-neon-orange/40 text-neon-orange" },
  idle:           { label: "IDLE",           color: "text-muted-foreground", bar: "bg-muted-foreground", badge: "bg-muted/30 border-border text-muted-foreground" },
  target_reached: { label: "TARGET REACHED", color: "text-neon-green",    bar: "bg-neon-green",    badge: "bg-neon-green/15 border-neon-green/40 text-neon-green" },
};

function shortHash(hash: string | null) {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function PriceDriver() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.isAdmin;
  const { on } = useEngineStream();

  useEffect(() => {
    return on("price_driver:buyback", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-driver/status"] });
    });
  }, [on]);

  const { data: state, isLoading } = useQuery<PriceDriverState>({
    queryKey: ["/api/price-driver/status"],
    refetchInterval: 10000,
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/price-driver/trigger", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-driver/status"] });
      toast({ title: "Buyback triggered", description: "On-chain swap + burn cycle initiated." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/price-driver/start", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-driver/status"] });
      toast({ title: "Price Driver started" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/price-driver/stop", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-driver/status"] });
      toast({ title: "Price Driver stopped" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-neon-cyan" />
      </div>
    );
  }

  const mode = state?.pricePressureMode ?? "idle";
  const meta = MODE_META[mode];
  const priceUsd = state?.liveSkyntPriceUsd ?? 0;
  const targetUsd = state?.targetPriceUsd ?? 0.65;
  const progressPct = Math.min(100, Math.round((priceUsd / targetUsd) * 100));
  const pctToTarget = targetUsd > 0 ? ((targetUsd - priceUsd) / targetUsd * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6" data-testid="price-driver-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading neon-glow-cyan flex items-center gap-2" data-testid="text-price-driver-title">
            <TrendingUp className="w-6 h-6" /> SKYNT Price Driver
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Live on-chain buyback + burn engine — Uniswap v3 Ethereum Mainnet
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button
              data-testid="button-trigger-buyback"
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending || !state?.running}
              className="connect-wallet-btn px-4 py-2 rounded-sm font-heading text-[10px] tracking-wider flex items-center gap-2"
              style={{ background: "rgba(57,255,20,0.1)", borderColor: "rgba(57,255,20,0.3)", color: "#39ff14" }}
            >
              <Zap className="w-3.5 h-3.5" />
              {triggerMutation.isPending ? "Running…" : "Trigger Now"}
            </button>
            {state?.running ? (
              <button
                data-testid="button-stop-driver"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                className="connect-wallet-btn px-4 py-2 rounded-sm font-heading text-[10px] tracking-wider flex items-center gap-2"
                style={{ background: "rgba(255,0,60,0.1)", borderColor: "rgba(255,0,60,0.3)", color: "#ff003c" }}
              >
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            ) : (
              <button
                data-testid="button-start-driver"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="connect-wallet-btn px-4 py-2 rounded-sm font-heading text-[10px] tracking-wider flex items-center gap-2"
                style={{ background: "rgba(57,255,20,0.1)", borderColor: "rgba(57,255,20,0.3)", color: "#39ff14" }}
              >
                <Play className="w-3.5 h-3.5" /> Start
              </button>
            )}
          </div>
        )}
      </div>

      {/* Config warning */}
      {!state?.configured && (
        <div className="cosmic-card border-amber-400/30 bg-amber-400/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-heading text-amber-400">READ-ONLY MODE</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              TREASURY_PRIVATE_KEY or ALCHEMY_API_KEY not configured. Price monitoring is active but on-chain swaps are disabled.
            </p>
          </div>
        </div>
      )}

      {/* Price + Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="cosmic-card cosmic-card-cyan p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-heading tracking-widest text-muted-foreground uppercase">Live SKYNT Price</span>
            <span className="text-[9px] font-mono text-muted-foreground">Uniswap v3 on-chain</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-heading text-neon-cyan" data-testid="text-live-price">
              ${priceUsd > 0 ? priceUsd.toFixed(4) : "—"}
            </span>
            {priceUsd > 0 && (
              <span className={`text-sm font-mono ${priceUsd >= targetUsd ? "text-neon-green" : "text-neon-orange"}`}>
                {priceUsd >= targetUsd
                  ? <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> At target</span>
                  : <span className="flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> {pctToTarget}% below</span>
                }
              </span>
            )}
          </div>
          <div>
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground mb-1">
              <span>${priceUsd.toFixed(4)}</span>
              <span>Target: ${targetUsd.toFixed(4)}</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${meta.bar}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          {state?.activeFee != null && (
            <p className="text-[9px] font-mono text-muted-foreground">
              Pool fee: {state.activeFee / 10000}% | ETH: ${(state.currentEthPrice ?? 3200).toLocaleString()}
            </p>
          )}
        </div>

        <div className="cosmic-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-heading tracking-widest text-muted-foreground uppercase">Buy Pressure Mode</span>
            <span className={`text-[9px] font-mono border px-2 py-0.5 rounded-sm font-heading tracking-wider ${meta.badge}`}>
              {meta.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground">Status</p>
              <p className={`font-mono text-sm flex items-center gap-1 ${state?.running ? "text-neon-green" : "text-muted-foreground"}`}>
                <Activity className="w-3 h-3" />
                {state?.running ? "Running" : "Stopped"}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Epochs Run</p>
              <p className="font-mono text-sm text-foreground" data-testid="text-epoch-count">{state?.epochCount ?? 0}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Treasury ETH</p>
              <p className="font-mono text-sm text-neon-orange" data-testid="text-treasury-eth">
                {state?.treasuryEthBalance != null ? `${state.treasuryEthBalance.toFixed(4)} ETH` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Next Cycle</p>
              <p className="font-mono text-sm text-muted-foreground">
                {state?.nextBuybackAt ? `${Math.max(0, Math.round((state.nextBuybackAt - Date.now()) / 1000))}s` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cumulative stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total ETH Spent", value: `${(state?.totalEthSpent ?? 0).toFixed(5)} ETH`, icon: Wallet, color: "text-neon-cyan" },
          { label: "SKYNT Bought", value: `${(state?.totalSkyntBought ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: ArrowUpRight, color: "text-neon-green" },
          { label: "SKYNT Burned", value: `${(state?.totalSkyntBurned ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: Flame, color: "text-plasma-red" },
          { label: "Buyback Cycles", value: `${state?.buybackHistory?.filter(e => e.status === "success").length ?? 0}`, icon: Target, color: "text-neon-magenta" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="cosmic-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-[9px] font-heading tracking-widest text-muted-foreground uppercase">{label}</span>
            </div>
            <p className={`font-mono text-base font-bold ${color}`} data-testid={`text-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Buyback history */}
      <div className="cosmic-card p-4">
        <h2 className="font-heading text-xs tracking-widest text-muted-foreground uppercase mb-4 flex items-center gap-2">
          <ChevronRight className="w-3.5 h-3.5 text-neon-cyan" /> Buyback History
        </h2>
        {(!state?.buybackHistory || state.buybackHistory.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2">
            <TrendingUp className="w-8 h-8 opacity-30" />
            <p className="text-sm font-mono">No buybacks executed yet</p>
            <p className="text-[11px]">Engine is monitoring on-chain price — cycles run every 5 minutes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {state.buybackHistory.map((ev) => (
              <div
                key={ev.id}
                data-testid={`buyback-event-${ev.id}`}
                className={`rounded-sm border p-3 text-[11px] ${
                  ev.status === "success"
                    ? "bg-neon-green/5 border-neon-green/20"
                    : ev.status === "failed"
                    ? "bg-plasma-red/5 border-plasma-red/20"
                    : "bg-white/2 border-border/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`font-heading text-[9px] tracking-wider px-1.5 py-0.5 rounded-sm border ${
                      ev.status === "success" ? "text-neon-green border-neon-green/30 bg-neon-green/10"
                      : ev.status === "failed" ? "text-plasma-red border-plasma-red/30 bg-plasma-red/10"
                      : "text-muted-foreground border-border/30"
                    }`}>
                      {ev.status.toUpperCase()}
                    </span>
                    <span className="font-mono text-muted-foreground">{timeAgo(ev.timestamp)}</span>
                    {ev.status === "success" && (
                      <>
                        <span className="text-neon-cyan font-mono">{ev.ethSpent.toFixed(5)} ETH spent</span>
                        <span className="text-neon-green font-mono">+{ev.skyntBought.toFixed(2)} SKYNT</span>
                        <span className="text-plasma-red font-mono flex items-center gap-1">
                          <Flame className="w-3 h-3" />{ev.skyntBurned.toFixed(2)} burned
                        </span>
                      </>
                    )}
                    {ev.reason && <span className="text-muted-foreground">{ev.reason}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {ev.status === "success" && (
                      <>
                        <span className={`font-mono ${ev.priceImpactBps > 0 ? "text-neon-green" : "text-muted-foreground"}`}>
                          {ev.priceImpactBps > 0 ? "+" : ""}{ev.priceImpactBps}bps impact
                        </span>
                        <span className="font-mono text-muted-foreground">
                          ${ev.priceBeforeUsd.toFixed(4)} → ${ev.priceAfterUsd.toFixed(4)}
                        </span>
                      </>
                    )}
                    <div className="flex gap-2">
                      {ev.txHashSwap && (
                        <a
                          href={`https://etherscan.io/tx/${ev.txHashSwap}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neon-cyan hover:underline font-mono flex items-center gap-1"
                          data-testid={`link-swap-tx-${ev.id}`}
                        >
                          <ExternalLink className="w-3 h-3" /> {shortHash(ev.txHashSwap)}
                        </a>
                      )}
                      {ev.txHashBurn && (
                        <a
                          href={`https://etherscan.io/tx/${ev.txHashBurn}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-plasma-red hover:underline font-mono flex items-center gap-1"
                          data-testid={`link-burn-tx-${ev.id}`}
                        >
                          <Flame className="w-3 h-3" /> {shortHash(ev.txHashBurn)}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="cosmic-card p-4">
        <h2 className="font-heading text-xs tracking-widest text-muted-foreground uppercase mb-4 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-neon-cyan" /> How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: "01",
              title: "Live On-Chain Price",
              desc: "Reads the actual SKYNT/WETH price directly from the Uniswap v3 pool using eth_call on the Quoter contract — no CoinGecko, no centralized oracles.",
              color: "text-neon-cyan",
            },
            {
              step: "02",
              title: "Buyback Execution",
              desc: "When price is below target, uses treasury ETH to execute a real swap via Uniswap v3 SwapRouter02. Slippage tolerance: 2%. Runs every 5 minutes.",
              color: "text-neon-orange",
            },
            {
              step: "03",
              title: "Burn + Deflation",
              desc: "30% of every purchased SKYNT is immediately sent to 0x000dead (burn address), permanently reducing supply and creating sustained upward price pressure.",
              color: "text-plasma-red",
            },
          ].map(({ step, title, desc, color }) => (
            <div key={step} className="space-y-2">
              <div className={`text-2xl font-heading ${color} opacity-60`}>{step}</div>
              <div className={`font-heading text-xs tracking-wider ${color}`}>{title}</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border/20 text-[10px] font-mono text-muted-foreground space-y-1">
          <p>Contract: <a href={`https://etherscan.io/address/${import.meta.env.VITE_SKYNT_CONTRACT ?? "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20"}`} target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">{import.meta.env.VITE_SKYNT_CONTRACT ?? "0xC5a47C9adaB637d1CAA791CCe193079d22C8cb20"}</a></p>
          <p>Burn address: <a href="https://etherscan.io/address/0x000000000000000000000000000000000000dEaD" target="_blank" rel="noopener noreferrer" className="text-plasma-red hover:underline">0x000000000000000000000000000000000000dEaD</a></p>
          <p>Uniswap v3 Router02: <a href="https://etherscan.io/address/0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45</a></p>
        </div>
      </div>
    </div>
  );
}
