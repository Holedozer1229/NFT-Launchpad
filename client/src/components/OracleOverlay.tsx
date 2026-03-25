import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEngineStream, type EngineEvent } from "@/hooks/use-engine-stream";
import { Eye } from "lucide-react";
import sphinxEye from "@/assets/sphinx-eye.png";

interface OracleLine {
  id: number;
  text: string;
  type: "primary" | "accent" | "muted" | "gold";
  ts: number;
}

let lineId = 0;

function formatEvent(e: EngineEvent): OracleLine | null {
  const d = e.data;
  switch (e.event) {
    case "iit:tick":
      return {
        id: lineId++, ts: e.ts, type: "primary",
        text: `IIT Φ=${String(d.phi ?? 0).slice(0, 6)} | coherence=${String(d.coherence ?? 0).slice(0, 5)}`,
      };
    case "treasury:compound":
      return {
        id: lineId++, ts: e.ts, type: "accent",
        text: `Treasury compounded +${String(d.periodYield ?? 0).slice(0, 8)} ETH yield`,
      };
    case "treasury:btc_deposit":
      return {
        id: lineId++, ts: e.ts, type: "gold",
        text: `BTC deposit: +${String(d.btcAmount ?? 0).slice(0, 10)} BTC (~${String(d.ethEquiv ?? 0).slice(0, 8)} ETH)`,
      };
    case "sol:yield":
      return {
        id: lineId++, ts: e.ts, type: "primary",
        text: `SOL yield epoch +${String(d.epochYield ?? 0).slice(0, 8)} SOL | total=${String(d.totalSolYield ?? 0).slice(0, 8)}`,
      };
    case "aave:deposit":
      return {
        id: lineId++, ts: e.ts, type: "accent",
        text: `Aave deposit ${String(d.amountEth ?? 0).slice(0, 8)} ETH | tx ${String(d.txHash ?? "").slice(0, 14)}…`,
      };
    case "aave:withdraw":
      return {
        id: lineId++, ts: e.ts, type: "muted",
        text: `Aave withdrawal ${String(d.amountEth ?? 0).slice(0, 8)} ETH | tx ${String(d.txHash ?? "").slice(0, 14)}…`,
      };
    case "dyson:evolution":
      return {
        id: lineId++, ts: e.ts, type: "primary",
        text: `Dyson epoch ${d.epoch} | energy=${String(d.energy ?? 0).slice(0, 6)} | harvest=${String(d.harvest ?? 0).slice(0, 6)}`,
      };
    case "p2p:peer_joined":
      return {
        id: lineId++, ts: e.ts, type: "accent",
        text: `P2P node joined: ${d.name ?? d.nodeId}`,
      };
    case "p2p:peer_left":
      return {
        id: lineId++, ts: e.ts, type: "muted",
        text: `P2P node left: ${d.name ?? d.nodeId} | peers=${d.totalNodes}`,
      };
    case "p2p_ledger:sync":
      return {
        id: lineId++, ts: e.ts, type: "muted",
        text: `Ledger sync: block #${d.blockHeight} | ${d.totalPeers} peers`,
      };
    case "btc:deposit":
      return {
        id: lineId++, ts: e.ts, type: "gold",
        text: `BTC on-chain deposit: ${String(d.amount ?? "").slice(0, 10)} sats | ${String(d.txHash ?? "").slice(0, 14)}…`,
      };
    case "governance:executed":
      return {
        id: lineId++, ts: e.ts, type: "accent",
        text: `Governance proposal #${d.proposalId} executed`,
      };
    case "governance:rejected":
      return {
        id: lineId++, ts: e.ts, type: "muted",
        text: `Governance proposal #${d.proposalId} rejected`,
      };
    default:
      return null;
  }
}

const BOOT_LINES: OracleLine[] = [
  { id: lineId++, ts: 0, type: "primary", text: "INITIATING SEQUENTIAL LOG..." },
  { id: lineId++, ts: 0, type: "muted",   text: "Scanning temporal artifacts." },
  { id: lineId++, ts: 0, type: "muted",   text: "Quantum Spectral Forge v3.0: protocol initialized." },
  { id: lineId++, ts: 0, type: "primary", text: "WKB tunnel probability: Pₜ = exp(-2∫√(2m(V-E)/ħ²) dx)" },
  { id: lineId++, ts: 0, type: "gold",    text: "Identity: SECURE_GATEWAY // CRYPTO_CHALLENGE_ACTIVE" },
  { id: lineId++, ts: 0, type: "muted",   text: "Born Rule: Probability |Ψ|² = 1.0 — awaiting stream…" },
];

const MAX_LINES = 32;

export function OracleOverlay() {
  const { events, connected } = useEngineStream();
  const [lines, setLines] = useState<OracleLine[]>(BOOT_LINES);
  const prevLenRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (events.length === prevLenRef.current) return;
    const newEvents = events.slice(0, events.length - prevLenRef.current);
    prevLenRef.current = events.length;

    const newLines: OracleLine[] = [];
    for (const e of newEvents) {
      const line = formatEvent(e);
      if (line) newLines.push(line);
    }
    if (newLines.length === 0) return;

    setLines((prev) => {
      const merged = [...newLines, ...prev];
      return merged.length > MAX_LINES ? merged.slice(0, MAX_LINES) : merged;
    });
  }, [events]);

  const colorClass = (type: OracleLine["type"]) => {
    switch (type) {
      case "primary": return "text-primary/80";
      case "accent":  return "text-accent/80";
      case "gold":    return "text-sphinx-gold/70";
      default:        return "text-muted-foreground/60";
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 w-80 pointer-events-none md:pointer-events-auto">
      <Card className="sphinx-card bg-black/80 text-primary border-primary/30 shadow-[0_0_30px_rgba(255,215,0,0.1)] backdrop-blur-xl">
        <CardHeader className="py-3 px-4 border-b border-primary/20 bg-primary/5 flex flex-row items-center gap-3">
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20" />
            <img src={sphinxEye} alt="Oracle" className="w-6 h-6 object-contain opacity-90 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="font-heading text-xs tracking-[0.2em] text-primary">SPHINX_ORACLE</CardTitle>
            <div className="text-[10px] font-mono text-primary/60 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-amber-400"}`} />
              {connected ? "OBSERVING CAUSALITY" : "RECONNECTING…"}
            </div>
          </div>
          <Eye className="w-3.5 h-3.5 text-primary/40 shrink-0" />
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-32">
            <div ref={scrollRef} className="px-4 py-3 font-mono text-[10px] leading-relaxed space-y-1.5">
              {lines.map((line) => (
                <p key={line.id} className={`${colorClass(line.type)} flex gap-1.5`}>
                  <span className="text-primary/30 shrink-0">{">>>"}</span>
                  <span>{line.text}</span>
                </p>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
