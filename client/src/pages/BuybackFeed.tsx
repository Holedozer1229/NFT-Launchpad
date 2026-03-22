import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame, ExternalLink, Loader2, ChevronLeft, ChevronRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BuybackEvent {
  id: number;
  ethSpent: number;
  skyntBought: number;
  skyntBurned: number;
  priceBeforeUsd: number;
  priceAfterUsd: number;
  impactBps: number;
  txHashSwap: string | null;
  txHashBurn: string | null;
  poolFee: number | null;
  status: string;
  createdAt: string;
}

interface BuybackFeedResponse {
  events: BuybackEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: "db" | "memory";
}

const ETHERSCAN_TX = (hash: string) => `https://etherscan.io/tx/${hash}`;

function fmt(n: number, decimals = 4) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ImpactBadge({ bps }: { bps: number }) {
  const pct = (bps / 100).toFixed(2);
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] px-1.5 py-0.5 rounded ${bps >= 50 ? "text-neon-green bg-neon-green/10" : bps >= 20 ? "text-neon-orange bg-neon-orange/10" : "text-muted-foreground bg-white/5"}`}>
      <ArrowUpRight className="w-2.5 h-2.5" />
      +{pct}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "success";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-heading uppercase tracking-wider ${ok ? "text-neon-green bg-neon-green/10 border border-neon-green/20" : "text-plasma-red bg-plasma-red/10 border border-plasma-red/20"}`}>
      {status}
    </span>
  );
}

export default function BuybackFeed() {
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const { data, isLoading, isFetching } = useQuery<BuybackFeedResponse>({
    queryKey: ["/api/buybacks/public", page],
    queryFn: async () => {
      const res = await fetch(`/api/buybacks/public?page=${page}&limit=${LIMIT}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const totalEthSpent = events.reduce((s, e) => s + e.ethSpent, 0);
  const totalSkyntBought = events.reduce((s, e) => s + e.skyntBought, 0);
  const totalSkyntBurned = events.reduce((s, e) => s + e.skyntBurned, 0);

  return (
    <div className="space-y-6" data-testid="buyback-feed-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan flex items-center gap-2" data-testid="text-buyback-title">
            <Flame className="w-6 h-6 text-neon-orange" />
            Buyback Transparency Feed
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Public record of every SKYNT buyback &amp; burn operation
            {data?.source === "memory" && <span className="ml-2 text-[10px] text-amber-400 font-mono">(live memory — DB has no events yet)</span>}
          </p>
        </div>
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {/* ── Page Summary Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events", value: total.toLocaleString(), color: "text-neon-cyan", card: "cosmic-card-cyan", testId: "text-buyback-total-events" },
          { label: "ETH Spent (page)", value: `${fmt(totalEthSpent, 5)} ETH`, color: "text-neon-orange", card: "cosmic-card-orange", testId: "text-buyback-eth-spent" },
          { label: "SKYNT Bought (page)", value: `${fmt(totalSkyntBought, 2)}`, color: "text-neon-green", card: "cosmic-card-green", testId: "text-buyback-skynt-bought" },
          { label: "SKYNT Burned (page)", value: `${fmt(totalSkyntBurned, 2)}`, color: "text-plasma-red", card: "cosmic-card-red", testId: "text-buyback-skynt-burned" },
        ].map((s) => (
          <div key={s.label} className={`cosmic-card ${s.card} p-3`} data-testid={s.testId}>
            <div className="text-[9px] font-heading tracking-widest text-muted-foreground uppercase mb-1">{s.label}</div>
            {isLoading ? <Skeleton className="h-5 w-20" /> : <div className={`font-mono text-sm font-bold ${s.color}`}>{s.value}</div>}
          </div>
        ))}
      </div>

      {/* ── Buyback Table ─────────────────────────────────────────────────── */}
      <div className="cosmic-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-neon-cyan" />
          <h3 className="font-heading text-sm uppercase tracking-wider">Buyback Events</h3>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">Page {page} of {totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-black/30">
                <th className="text-left px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase">Time</th>
                <th className="text-right px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase">ETH Spent</th>
                <th className="text-right px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase">SKYNT Bought</th>
                <th className="text-right px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase">SKYNT Burned</th>
                <th className="text-right px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase hidden sm:table-cell">Price Before</th>
                <th className="text-right px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase hidden sm:table-cell">Price After</th>
                <th className="text-center px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase">Impact</th>
                <th className="text-center px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase">Status</th>
                <th className="text-center px-3 py-2 text-[9px] font-heading tracking-widest text-muted-foreground uppercase hidden lg:table-cell">Tx</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }, (_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      {Array.from({ length: 9 }, (__, j) => (
                        <td key={j} className="px-3 py-2.5">
                          <Skeleton className="h-3 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : events.length === 0
                ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <Flame className="w-8 h-8 opacity-20 mx-auto mb-2" />
                      <p className="text-xs font-mono">No buyback events yet</p>
                      <p className="text-[10px] mt-1">Events are recorded when the Price Driver engine executes buybacks</p>
                    </td>
                  </tr>
                )
                : events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-border/30 hover:bg-white/[0.02] transition-colors"
                    data-testid={`buyback-row-${ev.id}`}
                  >
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDateTime(ev.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right text-neon-orange">
                      {fmt(ev.ethSpent, 5)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right text-neon-green">
                      {fmt(ev.skyntBought, 2)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right text-plasma-red">
                      {fmt(ev.skyntBurned, 2)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right text-muted-foreground hidden sm:table-cell">
                      ${ev.priceBeforeUsd.toFixed(6)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right hidden sm:table-cell">
                      ${ev.priceAfterUsd.toFixed(6)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <ImpactBadge bps={ev.impactBps} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {ev.txHashSwap && (
                          <a
                            href={ETHERSCAN_TX(ev.txHashSwap)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View swap on Etherscan"
                            className="text-neon-cyan hover:text-neon-cyan/70 transition-colors"
                            data-testid={`link-etherscan-swap-${ev.id}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {ev.txHashBurn && (
                          <a
                            href={ETHERSCAN_TX(ev.txHashBurn)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View burn on Etherscan"
                            className="text-plasma-red hover:text-plasma-red/70 transition-colors"
                            data-testid={`link-etherscan-burn-${ev.id}`}
                          >
                            <Flame className="w-3 h-3" />
                          </a>
                        )}
                        {!ev.txHashSwap && !ev.txHashBurn && (
                          <span className="text-[10px] text-muted-foreground font-mono">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-black/20">
            <span className="text-[10px] font-mono text-muted-foreground">
              {total.toLocaleString()} total events
            </span>
            <div className="flex items-center gap-2">
              <button
                data-testid="button-prev-page"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono text-muted-foreground">{page} / {totalPages}</span>
              <button
                data-testid="button-next-page"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
