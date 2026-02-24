import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Activity, Trophy, Flame, Sparkles } from "lucide-react";

const GRID_W = 24;
const GRID_H = 12;
const CHAINS = ["ETH", "SOL", "STX"] as const;
type Chain = typeof CHAINS[number];

const CHAIN_COLORS: Record<Chain, string> = {
  ETH: "hsl(185,100%,50%)",
  SOL: "hsl(280,100%,60%)",
  STX: "hsl(30,100%,55%)",
};

const CHAIN_GLOW: Record<Chain, string> = {
  ETH: "text-neon-cyan",
  SOL: "text-neon-magenta",
  STX: "text-neon-orange",
};

interface SnakeSegment { x: number; y: number; }

interface OmegaSnake {
  chain: Chain;
  segments: SnakeSegment[];
  direction: { dx: number; dy: number };
  berryPhase: number;
  ergotropy: number;
  milestoneCount: number;
  state: number[];
}

interface Treasure {
  x: number;
  y: number;
  chain: Chain;
  value: number;
}

function createSnake(chain: Chain, startY: number): OmegaSnake {
  const segments: SnakeSegment[] = [];
  for (let i = 5; i >= 0; i--) segments.push({ x: i, y: startY });
  return {
    chain,
    segments,
    direction: { dx: 1, dy: 0 },
    berryPhase: 0,
    ergotropy: 0,
    milestoneCount: 0,
    state: Array.from({ length: 6 }, () => Math.floor(Math.random() * 3) - 1),
  };
}

function spawnTreasure(snakes: OmegaSnake[]): Treasure {
  const occupied = new Set<string>();
  for (const s of snakes) for (const seg of s.segments) occupied.add(`${seg.x},${seg.y}`);
  let x: number, y: number;
  do {
    x = Math.floor(Math.random() * GRID_W);
    y = Math.floor(Math.random() * GRID_H);
  } while (occupied.has(`${x},${y}`));
  return { x, y, chain: CHAINS[Math.floor(Math.random() * 3)], value: Math.floor(Math.random() * 3) + 1 };
}

export function QuantumMiner() {
  const [isActive, setIsActive] = useState(false);
  const [snakes, setSnakes] = useState<OmegaSnake[]>(() => [
    createSnake("ETH", 2),
    createSnake("SOL", 5),
    createSnake("STX", 9),
  ]);
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [totalErgotropy, setTotalErgotropy] = useState(0);
  const [totalBerryPhase, setTotalBerryPhase] = useState(0);
  const [superMilestones, setSuperMilestones] = useState(0);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const addEvent = useCallback((msg: string) => {
    setEventLog(prev => [msg, ...prev].slice(0, 6));
  }, []);

  useEffect(() => {
    if (!isActive) return;
    if (treasures.length < 4) {
      setTreasures(prev => {
        const next = [...prev];
        while (next.length < 4) next.push(spawnTreasure(snakes));
        return next;
      });
    }
  }, [isActive, treasures.length, snakes]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setSnakes(prev => {
        const newSnakes = prev.map(snake => {
          const s = { ...snake, segments: [...snake.segments], state: [...snake.state] };
          if (Math.random() < 0.15) {
            const turns = [
              { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            ].filter(d => !(d.dx === -s.direction.dx && d.dy === -s.direction.dy));
            s.direction = turns[Math.floor(Math.random() * turns.length)];
          }

          const head = s.segments[0];
          let nx = (head.x + s.direction.dx + GRID_W) % GRID_W;
          let ny = (head.y + s.direction.dy + GRID_H) % GRID_H;

          s.segments.unshift({ x: nx, y: ny });
          s.segments.pop();

          s.state = s.state.map(v => ((v + 2) % 3) - 1);
          s.berryPhase += (2 * Math.PI / 3) * s.segments.length * 0.01;
          s.ergotropy += 0.3;

          return s;
        });

        setTreasures(prevT => {
          let remaining = [...prevT];
          for (const snake of newSnakes) {
            const head = snake.segments[0];
            const hit = remaining.findIndex(t => t.x === head.x && t.y === head.y);
            if (hit >= 0) {
              const t = remaining[hit];
              snake.berryPhase += (2 * Math.PI / 3) * t.value;
              snake.ergotropy += t.value * 10;
              snake.segments.push({ ...snake.segments[snake.segments.length - 1] });

              const prevMilestone = snake.milestoneCount;
              snake.milestoneCount = Math.floor(snake.ergotropy / 50);
              if (snake.milestoneCount > prevMilestone) {
                addEvent(`⚡ ${snake.chain} MILESTONE #${snake.milestoneCount} — NFT TRIGGER`);
              }

              addEvent(`🐍 ${snake.chain} collected ${t.chain} treasure [+${t.value}]`);
              remaining.splice(hit, 1);
              remaining.push(spawnTreasure(newSnakes));
            }
          }
          return remaining;
        });

        const totalErg = newSnakes.reduce((a, s) => a + s.ergotropy, 0);
        setTotalErgotropy(totalErg);
        setTotalBerryPhase(newSnakes.reduce((a, s) => a + s.berryPhase, 0));

        const newSuperCount = Math.floor(totalErg / 500);
        setSuperMilestones(prev => {
          if (newSuperCount > prev) {
            addEvent(`🏆 SUPER MILESTONE #${newSuperCount} — OMEGA SERPENT NFT`);
          }
          return newSuperCount;
        });

        return newSnakes;
      });
    }, 180);
    return () => clearInterval(interval);
  }, [isActive, addEvent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const cellW = rect.width / GRID_W;
    const cellH = rect.height / GRID_H;

    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "rgba(0,243,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellW, 0);
      ctx.lineTo(x * cellW, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellH);
      ctx.lineTo(rect.width, y * cellH);
      ctx.stroke();
    }

    for (const t of treasures) {
      const tx = t.x * cellW + cellW / 2;
      const ty = t.y * cellH + cellH / 2;
      const pulse = Math.sin(tick * 0.15) * 0.3 + 0.7;
      ctx.shadowColor = CHAIN_COLORS[t.chain];
      ctx.shadowBlur = 8 * pulse;
      ctx.fillStyle = CHAIN_COLORS[t.chain];
      ctx.beginPath();
      const r = Math.min(cellW, cellH) * 0.3;
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 4) + (i * Math.PI / 2);
        const px = tx + Math.cos(a) * r;
        const py = ty + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const snake of snakes) {
      const color = CHAIN_COLORS[snake.chain];
      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const seg = snake.segments[i];
        const alpha = 0.3 + 0.7 * (1 - i / snake.segments.length);
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        const pad = i === 0 ? 1 : 2;
        ctx.fillRect(seg.x * cellW + pad, seg.y * cellH + pad, cellW - pad * 2, cellH - pad * 2);

        if (i === 0) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
          ctx.fillRect(seg.x * cellW + pad, seg.y * cellH + pad, cellW - pad * 2, cellH - pad * 2);
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;

      const head = snake.segments[0];
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.min(cellW, cellH) * 0.5}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(snake.chain[0], head.x * cellW + cellW / 2, head.y * cellH + cellH / 2);
    }
  }, [snakes, treasures, tick]);

  const quantumProof = totalErgotropy > 0
    ? `0x${Math.floor((totalBerryPhase + totalErgotropy) * 1e6).toString(16).slice(0, 16)}`
    : "0x0";

  const handleToggle = () => {
    if (!isActive) {
      setSnakes([createSnake("ETH", 2), createSnake("SOL", 5), createSnake("STX", 9)]);
      setTreasures([]);
      setTotalErgotropy(0);
      setTotalBerryPhase(0);
      setSuperMilestones(0);
      setEventLog([]);
      setTick(0);
    }
    setIsActive(!isActive);
  };

  return (
    <Card className="sphinx-card bg-black/60 border-primary/20 backdrop-blur-xl relative overflow-hidden group" data-testid="omega-serpent-miner">
      <CardHeader className="border-b border-primary/10 bg-primary/5 pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            <CardTitle className="font-heading text-base tracking-widest text-primary">OMEGA SERPENT v3.0</CardTitle>
          </div>
          <Badge variant="outline" className={isActive ? "border-neon-green text-neon-green animate-pulse" : "text-muted-foreground"}>
            {isActive ? "HUNTING" : "STANDBY"}
          </Badge>
        </div>
        <CardDescription className="font-mono text-[10px] text-primary/60">
          QUTRIT SNAKE TRACKER // GHZ BERRY-PHASE MINER
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <div className="relative rounded-sm overflow-hidden border border-primary/20" style={{ aspectRatio: `${GRID_W}/${GRID_H}` }} data-testid="serpent-arena">
          <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: "pixelated" }} />
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
              <Sparkles className="w-8 h-8 text-primary mb-2 animate-pulse" />
              <span className="font-heading text-xs text-primary tracking-widest">IGNITE TO DEPLOY SERPENTS</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {snakes.map(snake => (
            <div key={snake.chain} className="p-2 bg-black/40 border border-white/5 rounded-sm" data-testid={`snake-stats-${snake.chain.toLowerCase()}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${isActive ? "animate-pulse" : ""}`} style={{ backgroundColor: CHAIN_COLORS[snake.chain] }} />
                <span className={`font-heading text-[10px] tracking-widest ${CHAIN_GLOW[snake.chain]}`}>{snake.chain}</span>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Ergotropy</span>
                  <span className="text-foreground">{snake.ergotropy.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Berry φ</span>
                  <span className="text-foreground">{(snake.berryPhase / Math.PI).toFixed(1)}π</span>
                </div>
                <div className="flex justify-between">
                  <span>Milestones</span>
                  <span className="text-foreground flex items-center gap-0.5">
                    <Trophy className="w-2.5 h-2.5 text-neon-orange" />
                    {snake.milestoneCount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono uppercase text-primary/60">
            <span>Cross-Chain Ergotropy</span>
            <span className="text-foreground">{totalErgotropy.toFixed(0)} / {(superMilestones + 1) * 500}</span>
          </div>
          <Progress
            value={(totalErgotropy % 500) / 5}
            className="h-1.5 bg-white/5 [&>div]:bg-gradient-to-r [&>div]:from-neon-cyan [&>div]:via-neon-magenta [&>div]:to-neon-orange"
          />
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-muted-foreground">Super Milestones</span>
            <span className="text-neon-orange font-bold flex items-center gap-1">
              <Flame className="w-3 h-3" /> {superMilestones}
            </span>
          </div>
        </div>

        <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
          <span>GHZ Quantum Proof</span>
          <span className="text-neon-cyan">{quantumProof}</span>
        </div>

        <div className="p-2.5 bg-black/40 border border-primary/10 rounded-sm font-mono text-[10px] relative" data-testid="serpent-terminal">
          <div className="flex justify-between items-center text-primary/40 border-b border-primary/5 pb-1 mb-1.5">
            <span>EVENT_FEED</span>
            <Activity className="w-3 h-3" />
          </div>
          <div className="h-[72px] overflow-hidden space-y-0.5">
            {eventLog.length > 0 ? eventLog.map((msg, i) => (
              <p key={i} className={`${i === 0 ? "text-neon-green" : "text-primary/50"} truncate`}>
                {">>>"} {msg}
              </p>
            )) : (
              <p className="opacity-40 italic">Awaiting serpent deployment...</p>
            )}
          </div>
        </div>

        <Button
          className={`w-full font-heading font-bold tracking-wider transition-all duration-500 ${
            isActive
              ? "bg-destructive/20 border border-destructive/40 text-destructive hover:bg-destructive/30"
              : "bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-orange text-black hover:opacity-90"
          }`}
          onClick={handleToggle}
          data-testid="button-toggle-serpent"
        >
          {isActive ? "ABORT_SERPENTS" : "DEPLOY_OMEGA_SERPENT"}
        </Button>
      </CardContent>
    </Card>
  );
}
